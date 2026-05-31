from django.conf import settings
from django.db import models


class Profile(models.Model):
    class Theme(models.TextChoices):
        LIGHT = "light", "Claro"
        DARK = "dark", "Escuro"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    photo = models.FileField(upload_to="profile_photos/", blank=True)
    bio = models.CharField("Bio", max_length=180, blank=True)
    theme = models.CharField(
        "Tema", max_length=10, choices=Theme.choices, default=Theme.LIGHT
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Perfil de {self.user}"
