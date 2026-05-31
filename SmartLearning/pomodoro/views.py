import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from notes.models import Page

from .models import PomodoroSession


def _json(request):
    try:
        return json.loads(request.body or "{}")
    except (ValueError, TypeError):
        return {}


def _stats(user):
    today = timezone.localdate()
    todays = PomodoroSession.objects.filter(
        user=user, completed=True, mode=PomodoroSession.Mode.WORK,
        ended_at__date=today,
    )
    return {
        "sessions_today": todays.count(),
        "minutes_today": sum(s.minutes for s in todays),
    }


@login_required
@require_http_methods(["POST"])
def api_log_session(request):
    """Record a completed pomodoro interval."""
    data = _json(request)
    page = None
    if data.get("page"):
        page = get_object_or_404(Page, id=data["page"], owner=request.user)
    PomodoroSession.objects.create(
        user=request.user,
        page=page,
        mode=data.get("mode", PomodoroSession.Mode.WORK),
        label=data.get("label", "")[:200],
        minutes=int(data.get("minutes", 25)),
        completed=True,
        ended_at=timezone.now(),
    )
    return JsonResponse(_stats(request.user), status=201)


@login_required
@require_http_methods(["GET"])
def api_stats(request):
    return JsonResponse(_stats(request.user))
