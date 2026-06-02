from django.urls import path

from . import views

urlpatterns = [
    path("novo/", views.course_create, name="course_create"),
    path("<int:pk>/", views.subject_detail, name="subject_detail"),
    path("<int:pk>/editar/", views.subject_edit, name="subject_edit"),
    path("<int:pk>/apagar/", views.course_delete, name="course_delete"),
]
