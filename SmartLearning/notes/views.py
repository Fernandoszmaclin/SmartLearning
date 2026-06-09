import json

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models import F, Max, Prefetch
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.http import content_disposition_header, urlencode
from django.utils.text import get_valid_filename
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from SmartLearning.security import validate_workspace_file

from .models import Block, Page


# ---------- helpers ----------

def _json(request):
    try:
        return json.loads(request.body or "{}")
    except (ValueError, TypeError):
        return {}


def _page_payload(page):
    return {
        "id": page.id,
        "title": page.display_title,
        "icon": page.icon,
        "is_favorite": page.is_favorite,
        "is_folder": page.is_folder,
        "parent": page.parent_id,
    }


def _block_payload(block):
    return {
        "id": block.id,
        "kind": block.kind,
        "text": block.text,
        "checked": block.checked,
        "position": block.position,
        "file_url": block.file.url if block.file else None,
        "file_name": block.file.name.split("/")[-1] if block.file else None,
    }


def _user_page(request, page_id):
    return get_object_or_404(Page, id=page_id, owner=request.user)


def _valid_kind(value):
    """Devolve um Block.Kind válido ou None (descarta valores fora das choices)."""
    return value if value in Block.Kind.values else None


def _to_position(value):
    """Converte um valor para posição (inteiro >= 0); None se inválido."""
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None


# ---------- workspace shell ----------

@login_required
@ensure_csrf_cookie
def workspace(request, page_id=None):
    roots = (
        Page.objects.filter(owner=request.user, parent__isnull=True)
        .select_related("subject")
        .prefetch_related(
            Prefetch("children", queryset=Page.objects.select_related("subject"))
        )
    )
    favorites = Page.objects.filter(owner=request.user, is_favorite=True).select_related("subject")

    current = None
    blocks = []
    trail = []
    if page_id is not None:
        current = _user_page(request, page_id)
        if current.is_folder:
            return redirect("workspace")
        blocks = list(current.blocks.all())
        # Trilha de ancestrais (raiz → página atual), estilo Notion.
        node, seen = current, set()
        while node is not None and node.id not in seen:
            seen.add(node.id)
            trail.append(node)
            node = node.parent
        trail.reverse()
    else:
        first = Page.objects.filter(owner=request.user, is_folder=False).first()
        if first:
            url = reverse("workspace_page", args=[first.id])
            params = {k: request.GET[k] for k in ("tasks", "cat") if request.GET.get(k)}
            if params:
                url = f"{url}?{urlencode(params)}"
            return redirect(url)

    from pomodoro.models import PomodoroSession

    today = timezone.localdate()
    todays = PomodoroSession.objects.filter(
        user=request.user,
        completed=True,
        mode=PomodoroSession.Mode.WORK,
        ended_at__date=today,
    )
    focus_minutes = sum(s.minutes for s in todays)

    # ----- Gaveta "Anotações" (trabalhos e provas) integrada -----
    # Estudos = páginas do workspace (árvore ao lado). A gaveta cuida só de
    # trabalho/prova. Mandamos as anotações de uma vez e o JS filtra por
    # tipo/matéria/terminadas — troca de aba instantânea, sem recarregar o editor.
    from academics.models import Note, Subject

    ac_subjects = Subject.objects.filter(owner=request.user)
    ac_notes = (
        Note.objects.filter(owner=request.user)
        .select_related("subject", "workspace_page")
        .order_by("-created_at")
    )
    # Quantos trabalhos/provas seguem pendentes → badge no botão "Anotações".
    task_pending_count = Note.objects.filter(
        owner=request.user,
        category__in=[Note.Category.TRABALHO, Note.Category.PROVA],
        is_done=False,
    ).count()
    # Anotação acadêmica vinculada à página aberta → chip de contexto no editor.
    current_note = current.academic_notes.first() if current else None

    return render(request, "notes/workspace.html", {
        "roots": roots,
        "favorites": favorites,
        "current": current,
        "trail": trail,
        "blocks": blocks,
        "block_kinds": Block.Kind.choices,
        "focus_sessions_today": todays.count(),
        "focus_minutes_today": focus_minutes,
        "pomodoro_page_id": current.id if current else "",
        "pomodoro_open": False,
        # Gaveta de anotações (trabalho/prova)
        "ac_subjects": ac_subjects,
        "ac_notes": ac_notes,
        "task_pending_count": task_pending_count,
        "current_note": current_note,
        "today": today,
    })


# ---------- pages API ----------

@login_required
@require_http_methods(["POST"])
def api_page_create(request):
    data = _json(request)
    parent = _user_page(request, data["parent"]) if data.get("parent") else None
    
    if parent and not parent.is_folder:
        return JsonResponse({"error": "Somente pastas podem abrigar outras páginas/pastas."}, status=400)

    nxt = Page.objects.filter(owner=request.user, parent=parent).aggregate(
        m=Max("position")
    )["m"]
    page = Page.objects.create(
        owner=request.user,
        parent=parent,
        is_folder=bool(data.get("is_folder", False)),
        title=data.get("title") or ("Nova Pasta" if data.get("is_folder") else "Untitled"),
        icon=data.get("icon") or ("📁" if data.get("is_folder") else "📄"),
        position=(nxt or 0) + 1,
    )
    return JsonResponse(_page_payload(page), status=201)


@login_required
@require_http_methods(["POST"])
def api_page_move(request, page_id):
    """Move/reordena uma página: define o pai (pasta) e a ordem entre irmãos.

    body: {"parent": <id|null>, "order": [ids...]}  (order opcional)
    """
    page = _user_page(request, page_id)
    data = _json(request)

    parent_id = data.get("parent")
    new_parent = _user_page(request, parent_id) if parent_id else None

    if new_parent and not new_parent.is_folder:
        return JsonResponse(
            {"error": "Somente pastas podem abrigar outras páginas/pastas."},
            status=400,
        )

    # Impede mover uma página para dentro dela mesma ou de uma descendente.
    anc = new_parent
    while anc is not None:
        if anc.id == page.id:
            return JsonResponse(
                {"error": "Não dá para mover uma página para dentro dela mesma."},
                status=400,
            )
        anc = anc.parent

    page.parent = new_parent
    order = data.get("order") or []
    if order:
        position = {int(pid): i for i, pid in enumerate(order)}
        page.position = position.get(page.id, 0)
        page.save()
        for pid, i in position.items():
            if pid != page.id:
                Page.objects.filter(id=pid, owner=request.user).update(position=i)
    else:
        nxt = (
            Page.objects.filter(owner=request.user, parent=new_parent)
            .exclude(id=page.id)
            .aggregate(m=Max("position"))["m"]
        )
        page.position = (nxt or 0) + 1
        page.save()
    return JsonResponse({"ok": True, "parent": new_parent.id if new_parent else None})


@login_required
@require_http_methods(["PATCH", "DELETE"])
def api_page_detail(request, page_id):
    page = _user_page(request, page_id)
    if request.method == "DELETE":
        page.delete()
        return JsonResponse({"deleted": page_id})

    data = _json(request)
    if "title" in data:
        page.title = data["title"]
    if data.get("icon"):
        page.icon = data["icon"][:8]
    if "is_favorite" in data:
        page.is_favorite = bool(data["is_favorite"])
    if "parent" in data:
        page.parent = _user_page(request, data["parent"]) if data["parent"] else None
    page.save()
    return JsonResponse(_page_payload(page))


# ---------- blocks API ----------

@login_required
@require_http_methods(["POST"])
def api_block_create(request, page_id):
    page = _user_page(request, page_id)
    data = _json(request)
    position = _to_position(data.get("position"))
    if position is None:
        nxt = page.blocks.aggregate(m=Max("position"))["m"]
        position = (nxt or 0) + 1
    else:
        # make room: push existing blocks at/after this position down by one
        Block.objects.filter(page=page, position__gte=position).update(
            position=F("position") + 1
        )
    block = Block.objects.create(
        page=page,
        kind=_valid_kind(data.get("kind")) or Block.Kind.PARAGRAPH,
        text=data.get("text", ""),
        position=position,
    )
    return JsonResponse(_block_payload(block), status=201)


@login_required
@require_http_methods(["POST"])
def api_block_reorder(request, page_id):
    page = _user_page(request, page_id)
    order = _json(request).get("order", [])
    for index, block_id in enumerate(order):
        Block.objects.filter(id=block_id, page=page).update(position=index)
    return JsonResponse({"ok": True})


@login_required
@require_http_methods(["PATCH", "DELETE", "POST"])
def api_block_detail(request, block_id):
    block = get_object_or_404(Block, id=block_id, page__owner=request.user)
    if request.method == "DELETE":
        block.delete()
        return JsonResponse({"deleted": block_id})

    # For file uploads, we might use POST with multipart data
    if request.method == "POST" and request.FILES:
        if "file" in request.FILES:
            uploaded_file = request.FILES["file"]
            try:
                validate_workspace_file(uploaded_file)
            except ValidationError as exc:
                return JsonResponse({"error": exc.messages[0]}, status=400)
            block.file = uploaded_file
            block.kind = Block.Kind.FILE
            block.save()
        return JsonResponse(_block_payload(block))

    data = _json(request)
    if "text" in data:
        block.text = data["text"]
    if "kind" in data and _valid_kind(data["kind"]):
        block.kind = data["kind"]
    if "checked" in data:
        block.checked = bool(data["checked"])
    if "position" in data and (pos := _to_position(data["position"])) is not None:
        block.position = pos
    block.save()
    return JsonResponse(_block_payload(block))


# ---------- exports & backup ----------

@login_required
def export_markdown(request, page_id):
    page = _user_page(request, page_id)
    blocks = page.blocks.all()
    md_lines = [f"# {page.display_title}", ""]
    
    for b in blocks:
        if b.kind == Block.Kind.HEADING1:
            md_lines.append(f"# {b.text}")
        elif b.kind == Block.Kind.HEADING2:
            md_lines.append(f"## {b.text}")
        elif b.kind == Block.Kind.HEADING3:
            md_lines.append(f"### {b.text}")
        elif b.kind == Block.Kind.BULLET:
            md_lines.append(f"- {b.text}")
        elif b.kind == Block.Kind.TODO:
            checked = "x" if b.checked else " "
            md_lines.append(f"- [{checked}] {b.text}")
        elif b.kind == Block.Kind.QUOTE:
            md_lines.append(f"> {b.text}")
        elif b.kind == Block.Kind.CODE:
            md_lines.append("```\n" + b.text + "\n```")
        elif b.kind == Block.Kind.DIVIDER:
            md_lines.append("---")
        else:
            md_lines.append(b.text)
        md_lines.append("")  # space between blocks

    content = "\n".join(md_lines)
    response = HttpResponse(content, content_type="text/markdown; charset=utf-8")
    filename = get_valid_filename(page.display_title.replace(" ", "_")) or "workspace"
    response["Content-Disposition"] = content_disposition_header(
        as_attachment=True,
        filename=f"{filename}.md",
    )
    return response


@login_required
def export_backup(request):
    """Exporta todos os dados da workspace (páginas e blocos) do usuário em JSON."""
    pages = Page.objects.filter(owner=request.user).prefetch_related("blocks")
    data = []
    for p in pages:
        page_data = {
            "id": p.id,
            "parent_id": p.parent_id,
            "title": p.title,
            "icon": p.icon,
            "is_favorite": p.is_favorite,
            "position": p.position,
            "created_at": p.created_at.isoformat(),
            "blocks": []
        }
        for b in p.blocks.all():
            page_data["blocks"].append({
                "id": b.id,
                "kind": b.kind,
                "text": b.text,
                "checked": b.checked,
                "position": b.position,
            })
        data.append(page_data)

    response = HttpResponse(json.dumps(data, indent=2, ensure_ascii=False), content_type="application/json; charset=utf-8")
    filename = f"workspace_backup_{timezone.now().strftime('%Y%m%d')}.json"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
