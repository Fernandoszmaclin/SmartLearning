from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    # Rotas de pginas abertas e marketing
    path('', views.landing_page, name='landing'),
    path('termos/', views.terms_view, name='terms'),
    path('privacidade/', views.privacy_view, name='privacy'),

    # Autenticao (login, logout, password_reset, etc.)
    path('accounts/', include('django.contrib.auth.urls')),
    path('accounts/signup/', views.signup, name='signup'),

    # Perfis
    path('perfil/', include('profiles.urls')),

    # Workspace principal (Notion-like)
    path('workspace/', include('notes.urls')),

    # Apps acadmicos / matrias
    path('academico/', include('academics.urls')),             # anotaes, minha-rea, calendrio, matrias

    # Pomodoro nativo
    path('pomodoro/', include('pomodoro.urls')),

    # Redirecionamentos de rotas antigas
    path('courses/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),
    path('academico/estudos/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),
    path('materias/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),

    path('admin/', admin.site.urls),
]
