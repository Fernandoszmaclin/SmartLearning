import calendar
from collections import Counter
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import NoteForm, SubjectForm
from .models import Note, Subject

MONTHS_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]
MONTHS_ABBR_PT = [
    "", "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
]
WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

# Quantas semanas o heatmap de estudo (estilo GitHub) mostra.
HEATMAP_WEEKS = 26

# Rótulos de dia da semana exibidos à esquerda do heatmap (Dom..Sáb).
# Só Seg/Qua/Sex recebem texto, como no GitHub.
HEATMAP_DAY_LABELS = ["", "Seg", "", "Qua", "", "Sex", ""]


def _subject_professors(user):
    return {
        str(subject.id): subject.professor
        for subject in Subject.objects.filter(owner=user).only("id", "professor")
        if subject.professor
    }


def _inherit_subject_professor(note):
    if note.is_task and note.subject and note.subject.professor:
        note.professor = note.subject.professor


@login_required
def note_list(request):
    category = request.GET.get("category", Note.Category.ESTUDO)
    if category not in Note.Category.values:
        category = Note.Category.ESTUDO
    subject_id = request.GET.get("subject") or ""
    # ?all=1 → mostra tudo (até terminados). Caminho padrão esconde terminados.
    show_all = request.GET.get("all") == "1"

    is_task_cat = category in (Note.Category.TRABALHO, Note.Category.PROVA)

    notes = (
        Note.objects.filter(owner=request.user, category=category)
        .select_related("subject")
    )
    if is_task_cat and not show_all:
        notes = notes.filter(is_done=False)
    if subject_id:
        notes = notes.filter(subject_id=subject_id)

    base = Note.objects.filter(owner=request.user)

    def _count(cat):
        qs = base.filter(category=cat)
        if cat in (Note.Category.TRABALHO, Note.Category.PROVA) and not show_all:
            qs = qs.filter(is_done=False)
        return qs.count()

    counts = {c: _count(c) for c, _ in Note.Category.choices}

    return render(request, "academics/note_list.html", {
        "notes": notes,
        "category": category,
        "categories": Note.Category.choices,
        "counts": counts,
        "subjects": Subject.objects.filter(owner=request.user),
        "selected_subject": subject_id,
        "subject_form": SubjectForm(),
        "today": timezone.localdate(),
        "show_all": show_all,
        "is_task_cat": is_task_cat,
    })


@login_required
def note_create(request):
    initial = {}
    cat = request.GET.get("category")
    if cat in Note.Category.values:
        initial["category"] = cat
    subject_id = request.GET.get("subject")
    if subject_id and Subject.objects.filter(owner=request.user, id=subject_id).exists():
        initial["subject"] = subject_id

    if request.method == "POST":
        form = NoteForm(request.POST, owner=request.user)
        if form.is_valid():
            note = form.save(commit=False)
            note.owner = request.user
            _inherit_subject_professor(note)
            note.save()
            return redirect(f"{reverse('academic_notes')}?category={note.category}")
    else:
        form = NoteForm(owner=request.user, initial=initial)

    return render(request, "academics/note_form.html", {
        "form": form,
        "mode": "new",
        "subject_professors": _subject_professors(request.user),
    })


@login_required
def note_edit(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    if request.method == "POST":
        form = NoteForm(request.POST, instance=note, owner=request.user)
        if form.is_valid():
            form.save()
            return redirect(f"{reverse('academic_notes')}?category={note.category}")
    else:
        form = NoteForm(instance=note, owner=request.user)
    return render(request, "academics/note_form.html", {
        "form": form,
        "mode": "edit",
        "note": note,
        "subject_professors": _subject_professors(request.user),
    })


@login_required
@require_POST
def note_delete(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    category = note.category
    note.delete()
    return redirect(f"{reverse('academic_notes')}?category={category}")


@login_required
@require_POST
def note_toggle_done(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    note.is_done = not note.is_done
    note.save(update_fields=["is_done", "updated_at"])
    nxt = request.POST.get("next") or f"{reverse('academic_notes')}?category={note.category}"
    return redirect(nxt)


@login_required
@require_POST
def subject_create(request):
    form = SubjectForm(request.POST)
    if form.is_valid():
        subject = form.save(commit=False)
        subject.owner = request.user
        # ignore duplicates silently
        if not Subject.objects.filter(owner=request.user, name=subject.name).exists():
            subject.save()
    return redirect(request.POST.get("next") or "academic_notes")


@login_required
def dashboard(request):
    """Minha área: panorama de estudos do usuário."""
    user = request.user
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())  # segunda
    week_end = week_start + timedelta(days=6)

    C = Note.Category
    base = Note.objects.filter(owner=user)
    # Totais por categoria (incluem terminados — contam aqui em "Minha área").
    counts = {c: base.filter(category=c).count() for c, _ in C.choices}
    total_notes = base.count()

    tasks = base.filter(category__in=[C.TRABALHO, C.PROVA]).select_related("subject")
    week_tasks = tasks.filter(
        is_done=False, due_date__gte=week_start, due_date__lte=week_end
    ).order_by("due_date")
    overdue = tasks.filter(is_done=False, due_date__lt=today).order_by("due_date")

    # Heatmap de estudo estilo GitHub: um quadradinho por dia, últimas N semanas.
    # Semana começa no domingo (igual ao calendário). today.weekday(): Seg=0..Dom=6.
    this_sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    grid_start = this_sunday - timedelta(weeks=HEATMAP_WEEKS - 1)

    per_day = Counter()
    for created in base.filter(
        category=C.ESTUDO, created_at__date__gte=grid_start
    ).values_list("created_at", flat=True):
        per_day[timezone.localdate(created)] += 1

    heat_weeks = []          # lista de colunas; cada coluna = 7 dias (Dom..Sáb)
    heat_months = []         # rótulos de mês: {"label", "span"}
    heat_total = 0
    for w in range(HEATMAP_WEEKS):
        col_start = grid_start + timedelta(weeks=w)
        col = []
        for d in range(7):
            day = col_start + timedelta(days=d)
            cnt = per_day.get(day, 0)
            if day > today:
                level = -1            # dia futuro: célula apagada
            elif cnt == 0:
                level = 0
            elif cnt == 1:
                level = 1
            elif cnt == 2:
                level = 2
            elif cnt <= 4:
                level = 3
            else:
                level = 4
            if day <= today:
                heat_total += cnt
            col.append({"date": day, "count": cnt, "level": level})
        heat_weeks.append(col)

        month = col_start.month
        if heat_months and heat_months[-1]["month"] == month:
            heat_months[-1]["span"] += 1
        else:
            heat_months.append(
                {"month": month, "label": MONTHS_ABBR_PT[month], "span": 1}
            )

    # Matérias com suas anotações de estudo
    subjects = list(
        Subject.objects.filter(owner=user).prefetch_related(
            Prefetch("notes", queryset=Note.objects.order_by("-created_at"))
        )
    )
    for s in subjects:
        notes = list(s.notes.all())
        s.estudo_notes = [n for n in notes if n.category == C.ESTUDO][:4]
        s.estudo_count = sum(1 for n in notes if n.category == C.ESTUDO)
        s.task_count = sum(1 for n in notes if n.category in (C.TRABALHO, C.PROVA))

    return render(request, "academics/dashboard.html", {
        "display_name": user.get_full_name() or user.username,
        "counts": counts,
        "total_notes": total_notes,
        "week_tasks": week_tasks,
        "overdue": overdue,
        "overdue_count": overdue.count(),
        "heat_weeks": heat_weeks,
        "heat_months": heat_months,
        "heat_total": heat_total,
        "heat_weeks_n": HEATMAP_WEEKS,
        "heat_day_labels": HEATMAP_DAY_LABELS,
        "subjects": subjects,
        "today": today,
        "week_start": week_start,
        "week_end": week_end,
    })


@login_required
def calendar_view(request):
    today = timezone.localdate()
    try:
        year = int(request.GET.get("year", today.year))
        month = int(request.GET.get("month", today.month))
    except (TypeError, ValueError):
        year, month = today.year, today.month
    if not (1 <= month <= 12):
        year, month = today.year, today.month

    tasks = (
        Note.objects.filter(
            owner=request.user,
            category__in=[Note.Category.TRABALHO, Note.Category.PROVA],
            due_date__year=year,
            due_date__month=month,
        )
        .select_related("subject")
        .order_by("due_date")
    )
    by_day = {}
    for t in tasks:
        by_day.setdefault(t.due_date.day, []).append(t)

    cal = calendar.Calendar(firstweekday=6)  # domingo primeiro
    weeks = []
    for week in cal.monthdatescalendar(year, month):
        cells = []
        for d in week:
            cells.append({
                "date": d,
                "in_month": d.month == month,
                "is_today": d == today,
                "tasks": by_day.get(d.day, []) if d.month == month else [],
            })
        weeks.append(cells)

    # mês anterior / próximo
    if month == 1:
        prev_y, prev_m = year - 1, 12
    else:
        prev_y, prev_m = year, month - 1
    if month == 12:
        next_y, next_m = year + 1, 1
    else:
        next_y, next_m = year, month + 1

    return render(request, "academics/calendar.html", {
        "weeks": weeks,
        "year": year,
        "month": month,
        "month_name": MONTHS_PT[month],
        "weekdays": WEEKDAYS_PT,
        "prev": {"year": prev_y, "month": prev_m},
        "next": {"year": next_y, "month": next_m},
        "task_count": tasks.count(),
        "today": today,
    })
