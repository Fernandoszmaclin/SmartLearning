from django.urls import path
from django.views.generic import RedirectView

from . import views

# Caminhos padronizados em dois grupos claros: "anotacoes/" (trabalho/prova) e
# "materias/". Verbos sempre em português (nova/editar/apagar/concluir) e listas
# no plural. Os name= são mantidos, então templates e JS continuam válidos.
urlpatterns = [
    path('', RedirectView.as_view(pattern_name='workspace', permanent=False)),

    # Painéis
    path('minha-area/', views.dashboard, name='dashboard'),
    path('calendario/', views.calendar_view, name='academic_calendar'),
    path('plano-semanal/', views.weekly_plan, name='academic_weekly_plan'),

    # Anotações (trabalho / prova)
    path('anotacoes/nova/', views.note_create, name='academic_note_create'),
    path('anotacoes/<int:pk>/editar/', views.note_edit, name='academic_note_edit'),
    path('anotacoes/<int:pk>/apagar/', views.note_delete, name='academic_note_delete'),
    path('anotacoes/<int:pk>/concluir/', views.note_toggle_done, name='academic_note_toggle'),

    # Matérias
    path('materias/', views.subject_list, name='subject_list'),
    path('materias/nova/', views.subject_create, name='academic_subject_create'),
    path('materias/<int:pk>/', views.subject_detail, name='subject_detail'),
    path('materias/<int:pk>/editar/', views.subject_edit, name='subject_edit'),
    path('materias/<int:pk>/apagar/', views.subject_delete, name='subject_delete'),

    # Redirecionamentos das rotas antigas (mantém links/favoritos salvos)
    path('nova/', RedirectView.as_view(pattern_name='academic_note_create', permanent=False, query_string=True)),
    path('<int:pk>/editar/', RedirectView.as_view(pattern_name='academic_note_edit', permanent=False, query_string=True)),
    path('<int:pk>/apagar/', RedirectView.as_view(pattern_name='academic_note_delete', permanent=False, query_string=True)),
    path('<int:pk>/toggle/', RedirectView.as_view(pattern_name='academic_note_toggle', permanent=False, query_string=True)),
    path('materia/', RedirectView.as_view(pattern_name='subject_list', permanent=False, query_string=True)),
    path('materia/nova/', RedirectView.as_view(pattern_name='academic_subject_create', permanent=False, query_string=True)),
    path('materia/<int:pk>/', RedirectView.as_view(pattern_name='subject_detail', permanent=False, query_string=True)),
    path('materia/<int:pk>/editar/', RedirectView.as_view(pattern_name='subject_edit', permanent=False, query_string=True)),
    path('materia/<int:pk>/apagar/', RedirectView.as_view(pattern_name='subject_delete', permanent=False, query_string=True)),
]
