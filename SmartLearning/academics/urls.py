from django.urls import path

from . import views

urlpatterns = [
    path("minha-area/", views.dashboard, name="dashboard"),
    path("", views.note_list, name="academic_notes"),
    path("calendario/", views.calendar_view, name="academic_calendar"),
    path("nova/", views.note_create, name="academic_note_create"),
    path("<int:pk>/editar/", views.note_edit, name="academic_note_edit"),
    path("<int:pk>/apagar/", views.note_delete, name="academic_note_delete"),
    path("<int:pk>/toggle/", views.note_toggle_done, name="academic_note_toggle"),
    path("cadeira/nova/", views.subject_create, name="academic_subject_create"),
]
