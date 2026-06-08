from django.conf import settings
from django.db import models

from SmartLearning.security import validate_hex_color


class Subject(models.Model):
    """Uma matéria da faculdade. Serve como tag para filtrar anotações."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subjects",
    )
    name = models.CharField("Matéria", max_length=120)
    professor = models.CharField("Professor(a)", max_length=120, blank=True)
    color = models.CharField(
        "Cor", max_length=7, default="#0D9488",
        validators=[validate_hex_color],
        help_text="Cor da tag/matéria (hex).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("owner", "name")
        verbose_name = "Matéria"
        verbose_name_plural = "Matérias"

    def __str__(self):
        return self.name


class Note(models.Model):
    """Anotação acadêmica: estudo, trabalho ou prova."""

    class Category(models.TextChoices):
        TRABALHO = "trabalho", "Trabalho"
        PROVA = "prova", "Prova"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="academic_notes",
    )
    category = models.CharField(
        "Categoria", max_length=10, choices=Category.choices, default=Category.TRABALHO
    )
    title = models.CharField("Título", max_length=200)
    content = models.TextField("Conteúdo", blank=True)
    subject = models.ForeignKey(
        Subject,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notes",
        verbose_name="Matéria",
    )
    workspace_page = models.ForeignKey(
        "notes.Page",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="academic_notes",
        verbose_name="Página do workspace",
    )

    professor = models.CharField("Professor(a)", max_length=120, blank=True)
    due_date = models.DateField("Data de entrega/realização", null=True, blank=True)
    is_done = models.BooleanField("Terminado", default=False)
    
    difficulty = models.IntegerField("Dificuldade (1-5)", default=3)
    estimated_time = models.IntegerField("Tempo estimado (min)", default=60)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Anotação"
        verbose_name_plural = "Anotações"

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"

    @property
    def is_task(self):
        """Trabalho e prova têm prazo/professor/status; estudo não."""
        return self.category in (self.Category.TRABALHO, self.Category.PROVA)
