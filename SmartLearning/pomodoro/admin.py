from django.contrib import admin

from .models import PomodoroSession


@admin.register(PomodoroSession)
class PomodoroSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "mode", "minutes", "completed", "label", "started_at")
    list_filter = ("mode", "completed")
    search_fields = ("label", "user__username")
