"""
URL configuration for SmartLearning project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from django.views.generic import RedirectView, TemplateView

from courses import views as course_views
from . import views

urlpatterns = [
    path('', TemplateView.as_view(template_name='landing.html'), name='landing'),
    path('privacidade/', TemplateView.as_view(
        template_name='legal.html',
        extra_context={'titulo': 'Política de Privacidade'}), name='privacidade'),
    path('termos/', TemplateView.as_view(
        template_name='legal.html',
        extra_context={'titulo': 'Termos de Uso'}), name='termos'),

    # Busca global (anotações + páginas + matérias)
    path('buscar/', views.search, name='search'),

    # Auth
    path('accounts/signup/', views.signup, name='signup'),
    path('accounts/profile/', include('profiles.urls')),
    path('accounts/', include('django.contrib.auth.urls')),

    # App padronizado sob /academico/
    path('academico/workspace/', include('notes.urls')),       # workspace + API
    path('academico/workspace/', include('pomodoro.urls')),    # API do pomodoro
    path('academico/materia/', course_views.course_list, name='course_list'),
    path('academico/materia/', include('courses.urls')),       # matérias
    path('academico/', include('academics.urls')),             # anotações, minha-área, calendário

    # Redirects das URLs antigas -> novas (não quebra favoritos)
    path('app/', RedirectView.as_view(pattern_name='workspace', permanent=True)),
    path('app/p/<int:page_id>/', RedirectView.as_view(pattern_name='workspace_page', permanent=True)),
    path('courses/', RedirectView.as_view(pattern_name='course_list', permanent=True)),
    path('academico/estudos/', RedirectView.as_view(pattern_name='course_list', permanent=True)),
    path('materias/', RedirectView.as_view(pattern_name='course_list', permanent=True)),

    path('admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
