from django.urls import path

from . import views

urlpatterns = [
    path("api/pomodoro/log/", views.api_session_log, name="pomodoro_log"),
    path("api/pomodoro/stats/", views.api_session_stats, name="pomodoro_stats"),
]
