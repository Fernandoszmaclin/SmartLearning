from django.urls import path

from . import views

urlpatterns = [
    path("api/pomodoro/log/", views.api_log_session, name="pomodoro_log"),
    path("api/pomodoro/stats/", views.api_stats, name="pomodoro_stats"),
]
