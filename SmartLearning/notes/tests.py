from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from academics.models import Note
from notes.models import Block, Page
from SmartLearning.security import validate_profile_photo, validate_workspace_file


class SecurityRegressionTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="alice",
            password="safe-test-password",
        )
        self.client.force_login(self.user)

    def test_profile_next_rejects_external_redirect(self):
        response = self.client.post(
            reverse("profile_toggle_theme"),
            {"next": "https://evil.example/phish"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("workspace"))

    def test_note_toggle_next_rejects_external_redirect(self):
        note = Note.objects.create(
            owner=self.user,
            category=Note.Category.TRABALHO,
            title="Entrega",
        )

        response = self.client.post(
            reverse("academic_note_toggle", args=[note.pk]),
            {"next": "https://evil.example/phish"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], f"{reverse('workspace')}?tasks=open")

    def test_workspace_upload_rejects_html(self):
        uploaded = SimpleUploadedFile(
            "payload.html",
            b"<script>alert(1)</script>",
            content_type="text/html",
        )

        with self.assertRaises(ValidationError):
            validate_workspace_file(uploaded)

    def test_profile_photo_rejects_svg(self):
        uploaded = SimpleUploadedFile(
            "avatar.svg",
            b"<svg><script>alert(1)</script></svg>",
            content_type="image/svg+xml",
        )

        with self.assertRaises(ValidationError):
            validate_profile_photo(uploaded)

    def test_export_markdown_sanitizes_filename_header(self):
        page = Page.objects.create(
            owner=self.user,
            title='bad"name\r\nx',
        )
        Block.objects.create(page=page, text="conteudo")

        response = self.client.get(reverse("workspace_page_export_md", args=[page.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("\r", response["Content-Disposition"])
        self.assertNotIn("\n", response["Content-Disposition"])
        self.assertIn("attachment", response["Content-Disposition"])
