from django.contrib.auth.decorators import login_required
from django.db.models import Count, Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from notes.models import Page
from SmartLearning.http import parse_json_body

from .models import PomodoroSession


def _stats(user):
    today = timezone.localdate()
    agg = PomodoroSession.objects.filter(
        user=user, completed=True, mode=PomodoroSession.Mode.WORK,
        ended_at__date=today,
    ).aggregate(sessions=Count("id"), minutes=Sum("minutes"))
    return {
        "sessions_today": agg["sessions"],
        "minutes_today": agg["minutes"] or 0,
    }


@login_required
@require_http_methods(["POST"])
def api_log_session(request):
    """Record a completed pomodoro interval."""
    data = parse_json_body(request)
    page = None
    if data.get("page"):
        page = get_object_or_404(Page, id=data["page"], owner=request.user)
    try:
        minutes = int(data.get("minutes", 25))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Minutos invalidos."}, status=400)
    if not 1 <= minutes <= 240:
        return JsonResponse({"error": "Minutos deve estar entre 1 e 240."}, status=400)
    mode = data.get("mode", PomodoroSession.Mode.WORK)
    if mode not in PomodoroSession.Mode.values:
        return JsonResponse({"error": "Modo invalido."}, status=400)
    PomodoroSession.objects.create(
        user=request.user,
        page=page,
        mode=mode,
        label=data.get("label", "")[:200],
        minutes=minutes,
        completed=True,
        ended_at=timezone.now(),
    )
    return JsonResponse(_stats(request.user), status=201)


@login_required
@require_http_methods(["GET"])
def api_stats(request):
    return JsonResponse(_stats(request.user))
