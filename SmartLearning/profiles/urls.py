from django.urls import path

from . import views

urlpatterns = [
    path("", views.profile_edit, name="profile_edit"),
    path("tema/", views.profile_toggle_theme, name="profile_toggle_theme"),
]
