from django.conf import settings
from django.db import models


class PomodoroSession(models.Model):
    """A single focus or break interval logged by a user."""

    class Mode(models.TextChoices):
        WORK = "work", "Focus"
        SHORT_BREAK = "short_break", "Short break"
        LONG_BREAK = "long_break", "Long break"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pomodoro_sessions",
    )
    page = models.ForeignKey(
        "notes.Page",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="pomodoro_sessions",
    )
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.WORK)
    label = models.CharField(max_length=200, blank=True)
    minutes = models.PositiveIntegerField(default=25)
    completed = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.get_mode_display()} {self.minutes}m ({self.user})"
