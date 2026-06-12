from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    # Páginas abertas e marketing
    path('', views.landing, name='landing'),
    path('termos/', views.terms, name='terms'),
    path('privacidade/', views.privacy, name='privacy'),

    # Busca global
    path('busca/', views.search, name='search'),

    # Autenticação (login, logout, reset de senha)
    path('accounts/signup/', views.signup, name='signup'),
    path('accounts/', include('django.contrib.auth.urls')),

    # Perfis
    path('perfil/', include('profiles.urls')),

    # Workspace principal (estilo Notion)
    path('workspace/', include('notes.urls')),

    # Redireciona rotas antigas
    path('courses/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),
    path('academico/estudos/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),
    path('materias/', RedirectView.as_view(pattern_name='subject_list', permanent=True)),

    # Apps acadêmicos / matérias
    path('academico/', include('academics.urls')),             # anotações, calendário, matérias

    # Pomodoro nativo
    path('pomodoro/', include('pomodoro.urls')),


    path('admin/', admin.site.urls),
]

# Em desenvolvimento, o runserver precisa servir os uploads (/media/).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
