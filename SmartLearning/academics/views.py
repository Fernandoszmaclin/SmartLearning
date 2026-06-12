import calendar
from collections import Counter
from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Count, F, Prefetch, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from SmartLearning.security import safe_redirect_url
from notes.models import Page

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

# Semanas exibidas no heatmap de estudo (estilo GitHub).
HEATMAP_WEEKS = 26

# Rótulos à esquerda do heatmap (Dom..Sáb); só Seg/Qua/Sex, como no GitHub.
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


def _safe_next(request):
    """Devolve o ?next= se for URL interna; senão None."""
    return safe_redirect_url(request, request.POST.get("next") or request.GET.get("next"))


def _post_save_redirect(note, next_url=None):
    """Depois de salvar: volta para o ``next`` quando houver; senão abre a gaveta."""
    if next_url:
        return redirect(next_url)
    return redirect(f"{reverse('workspace')}?tasks=open")


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
            return _post_save_redirect(note, _safe_next(request))
    else:
        form = NoteForm(owner=request.user, initial=initial)

    return render(request, "academics/note_form.html", {
        "form": form,
        "mode": "new",
        "subject_professors": _subject_professors(request.user),
        "safe_next": _safe_next(request),
    })


@login_required
def note_edit(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    if request.method == "POST":
        form = NoteForm(request.POST, instance=note, owner=request.user)
        if form.is_valid():
            form.save()
            return _post_save_redirect(note, _safe_next(request))
    else:
        form = NoteForm(instance=note, owner=request.user)
    return render(request, "academics/note_form.html", {
        "form": form,
        "mode": "edit",
        "note": note,
        "subject_professors": _subject_professors(request.user),
        "safe_next": _safe_next(request),
    })


@login_required
@require_POST
def note_delete(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    note.delete()
    return redirect(_safe_next(request) or f"{reverse('workspace')}?tasks=open")


@login_required
@require_POST
def note_toggle_done(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    note.is_done = not note.is_done
    note.save(update_fields=["is_done", "updated_at"])
    nxt = _safe_next(request) or f"{reverse('workspace')}?tasks=open"
    return redirect(nxt)


@login_required
@require_POST
def subject_create(request):
    form = SubjectForm(request.POST)
    if form.is_valid():
        subject = form.save(commit=False)
        subject.owner = request.user
        # ignora duplicatas silenciosamente
        if not Subject.objects.filter(owner=request.user, name=subject.name).exists():
            subject.save()
    return redirect(_safe_next(request) or "subject_list")


def _heat_level(count, day, today):
    """Intensidade 0-4 da célula; -1 apaga dias futuros."""
    if day > today:
        return -1
    if count <= 2:
        return count
    return 3 if count <= 4 else 4


def _heatmap(pages, today):
    """Grade estilo GitHub: colunas de 7 dias (Dom..Sáb) com rótulos de mês.

    Devolve (weeks, months, total criado no período).
    """
    this_sunday = today - timedelta(days=(today.weekday() + 1) % 7)
    grid_start = this_sunday - timedelta(weeks=HEATMAP_WEEKS - 1)

    per_day = Counter()
    for created in pages.filter(
        created_at__date__gte=grid_start
    ).values_list("created_at", flat=True):
        per_day[timezone.localdate(created)] += 1

    weeks, months, total = [], [], 0
    for w in range(HEATMAP_WEEKS):
        col_start = grid_start + timedelta(weeks=w)
        col = []
        for d in range(7):
            day = col_start + timedelta(days=d)
            cnt = per_day.get(day, 0)
            if day <= today:
                total += cnt
            col.append({"date": day, "count": cnt, "level": _heat_level(cnt, day, today)})
        weeks.append(col)

        month = col_start.month
        if months and months[-1]["month"] == month:
            months[-1]["span"] += 1
        else:
            months.append({"month": month, "label": MONTHS_ABBR_PT[month], "span": 1})
    return weeks, months, total


def _pages_by_subject(pages):
    """Agrupa páginas por matéria: a da própria página ou a da pasta-mãe."""
    folder_subject = {p.id: p.subject_id for p in pages if p.subject_id}
    grouped = {}
    for p in pages:
        sid = p.subject_id or folder_subject.get(p.parent_id)
        if sid:
            grouped.setdefault(sid, []).append(p)
    return grouped


@login_required
def dashboard(request):
    """Minha área: panorama de estudos do usuário."""
    user = request.user
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())  # segunda
    week_end = week_start + timedelta(days=6)

    C = Note.Category
    base = Note.objects.filter(owner=user)
    pages_base = Page.objects.filter(owner=user)
    # Totais por categoria (incluem terminados).
    counts = {c: base.filter(category=c).count() for c, _ in C.choices}
    counts["estudo"] = pages_base.count()  # Estudos são Páginas do workspace
    total_notes = base.count() + pages_base.count()

    tasks = base.select_related("subject")
    week_tasks = tasks.filter(
        is_done=False, due_date__gte=week_start, due_date__lte=week_end
    ).order_by("due_date")
    overdue = tasks.filter(is_done=False, due_date__lt=today).order_by("due_date")

    heat_weeks, heat_months, heat_total = _heatmap(pages_base, today)

    all_pages = list(pages_base.order_by("-created_at"))
    pages_by_subject = _pages_by_subject(all_pages)

    # Matérias com suas anotações e páginas vinculadas.
    subjects = list(
        Subject.objects.filter(owner=user).prefetch_related(
            Prefetch("notes", queryset=Note.objects.order_by("-created_at"))
        )
    )
    for s in subjects:
        subject_pages = pages_by_subject.get(s.id, [])
        s.estudo_notes = subject_pages[:4]
        s.estudo_count = len(subject_pages)
        s.task_count = len(s.notes.all())

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


@login_required
def weekly_plan(request):
    """Distribui tarefas pendentes nos próximos 7 dias por urgência, dificuldade e tempo."""
    today = timezone.localdate()

    # Minutos disponíveis por dia (default 120, mínimo 15).
    try:
        available_time_per_day = max(15, int(request.GET.get("available_time", 120)))
    except (TypeError, ValueError):
        available_time_per_day = 120

    tasks = Note.objects.filter(
        owner=request.user, 
        category__in=[Note.Category.TRABALHO, Note.Category.PROVA], 
        is_done=False
    ).select_related("subject")
    
    task_list = []
    for t in tasks:
        days_left = max(0, (t.due_date - today).days) if t.due_date else 14
        urgency_score = 10.0 / (days_left + 1)
        score = urgency_score * t.difficulty
        task_list.append({
            "obj": t,
            "days_left": days_left,
            "score": score,
            "time": t.estimated_time
        })
    
    task_list.sort(key=lambda x: x["score"], reverse=True)
    
    days = []
    for i in range(7):
        date = today + timedelta(days=i)
        days.append({
            "date": date,
            "weekday": WEEKDAYS_PT[(date.weekday() + 1) % 7],
            "tasks": [],
            "time_used": 0,
            "time_available": available_time_per_day
        })
        
    unassigned = []
    for item in task_list:
        assigned = False
        for day in days:
            if item["obj"].due_date and day["date"] > item["obj"].due_date:
                continue
            if day["time_used"] + item["time"] <= day["time_available"]:
                day["tasks"].append(item["obj"])
                day["time_used"] += item["time"]
                assigned = True
                break
        
        if not assigned:
            valid_days = [d for d in days if not item["obj"].due_date or d["date"] <= item["obj"].due_date]
            if valid_days:
                best_day = min(valid_days, key=lambda d: d["time_used"])
                best_day["tasks"].append(item["obj"])
                best_day["time_used"] += item["time"]
            else:
                unassigned.append(item["obj"])
                
    return render(request, "academics/weekly_plan.html", {
        "days": days,
        "unassigned": unassigned,
        "available_time": available_time_per_day,
        "today": today,
    })


def _subjects_with_counts(user):
    return (
        Subject.objects.filter(owner=user)
        .annotate(
            estudo_count=Count("folders", distinct=True),
            trabalho_count=Count("notes", filter=Q(notes__category=Note.Category.TRABALHO)),
            prova_count=Count("notes", filter=Q(notes__category=Note.Category.PROVA)),
        )
        .order_by("name")
    )


def _notes_for_subject(subject, sort):
    notes = subject.notes.select_related("workspace_page")
    if sort == "upcoming":
        task_order = ["is_done", F("due_date").asc(nulls_last=True), "-created_at"]
        return {
            Note.Category.PROVA: notes.filter(category=Note.Category.PROVA).order_by(*task_order),
            Note.Category.TRABALHO: notes.filter(category=Note.Category.TRABALHO).order_by(*task_order),
        }
    return {
        category: notes.filter(category=category).order_by("-created_at")
        for category in Note.Category.values
    }


@login_required
def subject_list(request):
    return render(request, "academics/subject_list.html", {
        "subjects": _subjects_with_counts(request.user),
        "subject_form": SubjectForm(),
    })


@login_required
def subject_detail(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    sort = request.GET.get("sort") or "upcoming"
    if sort not in {"upcoming", "recent"}:
        sort = "upcoming"

    grouped = _notes_for_subject(subject, sort)
    estudos = (
        Page.objects.filter(owner=request.user)
        .filter(Q(subject=subject) | Q(parent__subject=subject))
        .order_by("-created_at")
    )
    return render(request, "academics/subject_detail.html", {
        "subject": subject,
        "sort": sort,
        "groups": [
            ("estudo", "Estudo", estudos),
            ("prova", "Prova", grouped[Note.Category.PROVA]),
            ("trabalho", "Trabalho", grouped[Note.Category.TRABALHO]),
        ],
    })


@login_required
def subject_edit(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    if request.method == "POST":
        form = SubjectForm(request.POST, instance=subject)
        if form.is_valid():
            form.save()
            return redirect("subject_detail", pk=subject.pk)
    else:
        form = SubjectForm(instance=subject)
    return render(request, "academics/subject_form.html", {
        "form": form,
        "subject": subject,
    })


@login_required
@require_POST
def subject_delete(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    subject.delete()
    return redirect("subject_list")
