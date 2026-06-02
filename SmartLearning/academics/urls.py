from django.urls import path
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    path("", RedirectView.as_view(pattern_name="workspace", permanent=False)),
    path("minha-area/", views.dashboard, name="dashboard"),
    path("calendario/", views.calendar_view, name="academic_calendar"),
    path("nova/", views.note_create, name="academic_note_create"),
    path("<int:pk>/editar/", views.note_edit, name="academic_note_edit"),
    path("<int:pk>/apagar/", views.note_delete, name="academic_note_delete"),
    path("<int:pk>/toggle/", views.note_toggle_done, name="academic_note_toggle"),
    path("cadeira/nova/", views.subject_create, name="academic_subject_create"),
    path("plano-semanal/", views.weekly_plan, name="academic_weekly_plan"),
]
