import re
from html import escape

from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.db.models import Q
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.safestring import mark_safe

# Máximo de resultados por seção (busca global).
SEARCH_LIMIT = 8


def _highlight(text, query, snippet=False, width=160):
    """Escapa o texto e envolve as ocorrências de `query` em <mark>.

    Com snippet=True, recorta uma janela em torno da primeira ocorrência.
    Retorna HTML seguro (já escapado) pronto para o template.
    """
    if not text:
        return ""
    esc = escape(text)
    if not query:
        return mark_safe(esc)
    pattern = re.compile(re.escape(escape(query)), re.IGNORECASE)
    match = pattern.search(esc)
    if snippet and match:
        start = max(0, match.start() - width // 3)
        end = min(len(esc), match.start() + width)
        esc = esc[start:end]
        if start > 0:
            esc = "… " + esc
        if end < len(text):
            esc = esc + " …"
    return mark_safe(pattern.sub(lambda m: f"<mark>{m.group(0)}</mark>", esc))


@login_required
def search(request):
    """Busca global: anotações acadêmicas + páginas do workspace + matérias."""
    from academics.models import Note, Subject
    from notes.models import Page

    query = request.GET.get("q", "").strip()
    notes, pages, subjects = [], [], []
    total = 0

    if query:
        user = request.user

        note_qs = (
            Note.objects.filter(owner=user)
            .filter(Q(title__icontains=query) | Q(content__icontains=query))
            .select_related("subject")
            .order_by("-updated_at")[:SEARCH_LIMIT]
        )
        for n in note_qs:
            notes.append({
                "title": _highlight(n.title, query),
                "snippet": _highlight(n.content, query, snippet=True),
                "category": n.get_category_display(),
                "category_value": n.category,
                "subject": n.subject.name if n.subject else "",
                "url": reverse("academic_note_edit", args=[n.pk]) + "?readonly=1",
            })

        page_qs = (
            Page.objects.filter(owner=user)
            .filter(Q(title__icontains=query) | Q(blocks__text__icontains=query))
            .distinct()
            .order_by("-updated_at")[:SEARCH_LIMIT]
        )
        for p in page_qs:
            block = p.blocks.filter(text__icontains=query).first()
            pages.append({
                "title": _highlight(p.display_title, query),
                "icon": p.icon or "📄",
                "snippet": _highlight(block.text, query, snippet=True) if block else "",
                "url": reverse("workspace_page", args=[p.pk]),
            })

        subject_qs = (
            Subject.objects.filter(owner=user)
            .filter(Q(name__icontains=query) | Q(professor__icontains=query))
            .order_by("name")[:SEARCH_LIMIT]
        )
        for s in subject_qs:
            subjects.append({
                "name": _highlight(s.name, query),
                "professor": _highlight(s.professor, query) if s.professor else "",
                "color": s.color,
                "url": reverse("subject_detail", args=[s.pk]),
            })

        total = len(notes) + len(pages) + len(subjects)

    if request.headers.get("Accept") == "application/json" or request.GET.get("format") == "json":
        from django.http import JsonResponse
        return JsonResponse({
            "notes": notes,
            "pages": pages,
            "subjects": subjects,
            "total": total,
        })

    return render(request, "search.html", {
        "query": query,
        "notes": notes,
        "pages": pages,
        "subjects": subjects,
        "total": total,
    })


def signup(request):
    """Create an account, log the user in, and send them to the workspace."""
    if request.user.is_authenticated:
        return redirect("workspace")

    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("workspace")
    else:
        form = UserCreationForm()

    return render(request, "registration/signup.html", {"form": form})
