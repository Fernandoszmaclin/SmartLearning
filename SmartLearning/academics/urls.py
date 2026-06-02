from django.urls import path
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    path('', RedirectView.as_view(pattern_name='workspace', permanent=False)),
    path('minha-area/', views.dashboard, name='dashboard'),
    path('calendario/', views.calendar_view, name='academic_calendar'),
    path('nova/', views.note_create, name='academic_note_create'),
    path('<int:pk>/editar/', views.note_edit, name='academic_note_edit'),
    path('<int:pk>/apagar/', views.note_delete, name='academic_note_delete'),
    path('<int:pk>/toggle/', views.note_toggle_done, name='academic_note_toggle'),
    path('plano-semanal/', views.weekly_plan, name='academic_weekly_plan'),
    
    path('materia/', views.subject_list, name='subject_list'),
    path('materia/nova/', views.subject_create, name='academic_subject_create'),
    path('materia/<int:pk>/', views.subject_detail, name='subject_detail'),
    path('materia/<int:pk>/editar/', views.subject_edit, name='subject_edit'),
    path('materia/<int:pk>/apagar/', views.subject_delete, name='subject_delete'),
]
