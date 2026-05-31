import json

from django.contrib.auth.decorators import login_required
from django.db.models import F, Max
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

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
        "parent": page.parent_id,
    }


def _block_payload(block):
    return {
        "id": block.id,
        "kind": block.kind,
        "text": block.text,
        "checked": block.checked,
        "position": block.position,
    }


def _user_page(request, page_id):
    return get_object_or_404(Page, id=page_id, owner=request.user)


# ---------- workspace shell ----------

@login_required
@ensure_csrf_cookie
def workspace(request, page_id=None):
    roots = (
        Page.objects.filter(owner=request.user, parent__isnull=True)
        .prefetch_related("children")
    )
    favorites = Page.objects.filter(owner=request.user, is_favorite=True)

    current = None
    blocks = []
    if page_id is not None:
        current = _user_page(request, page_id)
        blocks = list(current.blocks.all())
    else:
        first = Page.objects.filter(owner=request.user).first()
        if first:
            return redirect("workspace_page", page_id=first.id)

    from pomodoro.models import PomodoroSession

    today = timezone.localdate()
    todays = PomodoroSession.objects.filter(
        user=request.user,
        completed=True,
        mode=PomodoroSession.Mode.WORK,
        ended_at__date=today,
    )
    focus_minutes = sum(s.minutes for s in todays)

    return render(request, "notes/workspace.html", {
        "roots": roots,
        "favorites": favorites,
        "current": current,
        "blocks": blocks,
        "block_kinds": Block.Kind.choices,
        "focus_sessions_today": todays.count(),
        "focus_minutes_today": focus_minutes,
        "pomodoro_page_id": current.id if current else "",
        "pomodoro_open": False,
    })


# ---------- pages API ----------

@login_required
@require_http_methods(["POST"])
def api_page_create(request):
    data = _json(request)
    parent = _user_page(request, data["parent"]) if data.get("parent") else None
    nxt = Page.objects.filter(owner=request.user, parent=parent).aggregate(
        m=Max("position")
    )["m"]
    page = Page.objects.create(
        owner=request.user,
        parent=parent,
        title=data.get("title") or "Untitled",
        position=(nxt or 0) + 1,
    )
    return JsonResponse(_page_payload(page), status=201)


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
    position = data.get("position")
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
        kind=data.get("kind", Block.Kind.PARAGRAPH),
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
@require_http_methods(["PATCH", "DELETE"])
def api_block_detail(request, block_id):
    block = get_object_or_404(Block, id=block_id, page__owner=request.user)
    if request.method == "DELETE":
        block.delete()
        return JsonResponse({"deleted": block_id})

    data = _json(request)
    if "text" in data:
        block.text = data["text"]
    if "kind" in data:
        block.kind = data["kind"]
    if "checked" in data:
        block.checked = bool(data["checked"])
    if "position" in data:
        block.position = data["position"]
    block.save()
    return JsonResponse(_block_payload(block))
