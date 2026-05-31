from django.contrib import admin

from .models import Note, Subject


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "professor", "color")
    search_fields = ("name", "professor")


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "subject", "owner", "due_date", "is_done", "created_at")
    list_filter = ("category", "is_done", "subject")
    search_fields = ("title", "content", "professor")
    date_hierarchy = "created_at"
