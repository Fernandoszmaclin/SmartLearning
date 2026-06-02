from django.conf import settings
from django.db import models


class Page(models.Model):
    """A Notion-like document. Pages can nest inside other pages."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pages",
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    title = models.CharField(max_length=200, default="Untitled", blank=True)
    icon = models.CharField(
        max_length=8, blank=True, default="📄",
        help_text="A single emoji used as the page icon (page content, not UI chrome).",
    )
    subject = models.ForeignKey(
        "academics.Subject",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="folders",
        help_text="Quando preenchido numa página raiz, ela é a pasta dessa matéria.",
    )
    is_favorite = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "created_at"]

    def __str__(self):
        return self.title or "Untitled"

    @property
    def display_title(self):
        return self.title.strip() or "Untitled"


class Block(models.Model):
    """A single editable block inside a Page (Notion-style)."""

    class Kind(models.TextChoices):
        PARAGRAPH = "paragraph", "Text"
        HEADING1 = "heading1", "Heading 1"
        HEADING2 = "heading2", "Heading 2"
        HEADING3 = "heading3", "Heading 3"
        TODO = "todo", "To-do"
        BULLET = "bullet", "Lista"
        QUOTE = "quote", "Quote"
        CODE = "code", "Code"
        DIVIDER = "divider", "Divider"
        FILE = "file", "Arquivo"

    page = models.ForeignKey(
        Page, on_delete=models.CASCADE, related_name="blocks"
    )
    kind = models.CharField(
        max_length=20, choices=Kind.choices, default=Kind.PARAGRAPH
    )
    text = models.TextField(blank=True)
    file = models.FileField(upload_to="blocks/files/", null=True, blank=True)
    checked = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.get_kind_display()} @ {self.page_id}"
