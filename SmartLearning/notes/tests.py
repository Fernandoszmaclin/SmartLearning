from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from academics.models import Note, Subject
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


class PageApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="alice",
            password="safe-test-password",
        )
        self.other = get_user_model().objects.create_user(
            username="bob",
            password="safe-test-password",
        )
        self.client.force_login(self.user)

    def _post(self, url, payload):
        return self.client.post(url, payload, content_type="application/json")

    def _patch(self, url, payload):
        return self.client.patch(url, payload, content_type="application/json")

    def test_create_requires_login(self):
        self.client.logout()
        response = self._post(reverse("api_page_create"), {})
        self.assertEqual(response.status_code, 302)

    def test_create_page_and_folder(self):
        response = self._post(reverse("api_page_create"), {"title": "Plano"})
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()["is_folder"])

        response = self._post(reverse("api_page_create"), {"is_folder": True})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["is_folder"])

    def test_create_rejects_non_folder_parent(self):
        page = Page.objects.create(owner=self.user, title="Solta")
        response = self._post(reverse("api_page_create"), {"parent": page.pk})
        self.assertEqual(response.status_code, 400)

    def test_move_rejects_non_folder_parent(self):
        a = Page.objects.create(owner=self.user, title="A")
        b = Page.objects.create(owner=self.user, title="B")
        response = self._post(reverse("api_page_move", args=[a.pk]), {"parent": b.pk})
        self.assertEqual(response.status_code, 400)

    def test_move_rejects_cycle(self):
        folder = Page.objects.create(owner=self.user, title="Pasta", is_folder=True)
        child = Page.objects.create(owner=self.user, title="Sub", is_folder=True, parent=folder)
        response = self._post(reverse("api_page_move", args=[folder.pk]), {"parent": child.pk})
        self.assertEqual(response.status_code, 400)

    def test_move_into_folder(self):
        folder = Page.objects.create(owner=self.user, title="Pasta", is_folder=True)
        page = Page.objects.create(owner=self.user, title="Nota")
        response = self._post(reverse("api_page_move", args=[page.pk]), {"parent": folder.pk})
        self.assertEqual(response.status_code, 200)
        page.refresh_from_db()
        self.assertEqual(page.parent_id, folder.pk)

    def test_patch_parent_rejects_non_folder(self):
        a = Page.objects.create(owner=self.user, title="A")
        b = Page.objects.create(owner=self.user, title="B")
        response = self._patch(reverse("api_page_detail", args=[a.pk]), {"parent": b.pk})
        self.assertEqual(response.status_code, 400)
        a.refresh_from_db()
        self.assertIsNone(a.parent_id)

    def test_patch_parent_rejects_cycle(self):
        folder = Page.objects.create(owner=self.user, title="Pasta", is_folder=True)
        response = self._patch(
            reverse("api_page_detail", args=[folder.pk]), {"parent": folder.pk}
        )
        self.assertEqual(response.status_code, 400)

    def test_patch_updates_fields(self):
        page = Page.objects.create(owner=self.user, title="Antes")
        response = self._patch(
            reverse("api_page_detail", args=[page.pk]),
            {"title": "Depois", "is_favorite": True},
        )
        self.assertEqual(response.status_code, 200)
        page.refresh_from_db()
        self.assertEqual(page.title, "Depois")
        self.assertTrue(page.is_favorite)

    def test_patch_subject_links_and_unlinks(self):
        subject = Subject.objects.create(owner=self.user, name="Cálculo I")
        page = Page.objects.create(owner=self.user, title="Resumo")

        response = self._patch(
            reverse("api_page_detail", args=[page.pk]), {"subject": subject.pk}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["subject"]["id"], subject.pk)
        page.refresh_from_db()
        self.assertEqual(page.subject, subject)

        response = self._patch(
            reverse("api_page_detail", args=[page.pk]), {"subject": None}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["subject"])
        page.refresh_from_db()
        self.assertIsNone(page.subject)

    def test_patch_subject_rejects_other_users_subject(self):
        subject = Subject.objects.create(owner=self.other, name="Física")
        page = Page.objects.create(owner=self.user, title="Resumo")

        response = self._patch(
            reverse("api_page_detail", args=[page.pk]), {"subject": subject.pk}
        )
        self.assertEqual(response.status_code, 400)
        page.refresh_from_db()
        self.assertIsNone(page.subject)

    def test_patch_subject_rejects_invalid_value(self):
        page = Page.objects.create(owner=self.user, title="Resumo")
        response = self._patch(
            reverse("api_page_detail", args=[page.pk]), {"subject": "abc"}
        )
        self.assertEqual(response.status_code, 400)

    def test_cannot_touch_other_users_page(self):
        page = Page.objects.create(owner=self.other, title="Alheia")
        response = self._patch(reverse("api_page_detail", args=[page.pk]), {"title": "x"})
        self.assertEqual(response.status_code, 404)
        response = self.client.delete(reverse("api_page_detail", args=[page.pk]))
        self.assertEqual(response.status_code, 404)

    def test_delete_page(self):
        page = Page.objects.create(owner=self.user, title="Tchau")
        response = self.client.delete(reverse("api_page_detail", args=[page.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Page.objects.filter(pk=page.pk).exists())


class BlockApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="alice",
            password="safe-test-password",
        )
        self.other = get_user_model().objects.create_user(
            username="bob",
            password="safe-test-password",
        )
        self.client.force_login(self.user)
        self.page = Page.objects.create(owner=self.user, title="Caderno")

    def _post(self, url, payload):
        return self.client.post(url, payload, content_type="application/json")

    def _patch(self, url, payload):
        return self.client.patch(url, payload, content_type="application/json")

    def test_create_block_defaults_to_paragraph(self):
        response = self._post(
            reverse("api_block_create", args=[self.page.pk]),
            {"kind": "invalida", "text": "oi"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["kind"], Block.Kind.PARAGRAPH)

    def test_create_block_at_position_shifts_others(self):
        first = Block.objects.create(page=self.page, text="um", position=0)
        response = self._post(
            reverse("api_block_create", args=[self.page.pk]),
            {"text": "zero", "position": 0},
        )
        self.assertEqual(response.status_code, 201)
        first.refresh_from_db()
        self.assertEqual(first.position, 1)

    def test_patch_block_ignores_invalid_kind(self):
        block = Block.objects.create(page=self.page, text="oi")
        response = self._patch(
            reverse("api_block_detail", args=[block.pk]),
            {"kind": "invalida", "checked": True},
        )
        self.assertEqual(response.status_code, 200)
        block.refresh_from_db()
        self.assertEqual(block.kind, Block.Kind.PARAGRAPH)
        self.assertTrue(block.checked)

    def test_reorder_blocks(self):
        a = Block.objects.create(page=self.page, text="a", position=0)
        b = Block.objects.create(page=self.page, text="b", position=1)
        response = self._post(
            reverse("api_block_reorder", args=[self.page.pk]),
            {"order": [b.pk, a.pk]},
        )
        self.assertEqual(response.status_code, 200)
        a.refresh_from_db()
        b.refresh_from_db()
        self.assertEqual((b.position, a.position), (0, 1))

    def test_cannot_touch_other_users_block(self):
        other_page = Page.objects.create(owner=self.other, title="Alheia")
        block = Block.objects.create(page=other_page, text="segredo")
        response = self._patch(reverse("api_block_detail", args=[block.pk]), {"text": "x"})
        self.assertEqual(response.status_code, 404)

    def test_backup_export(self):
        Block.objects.create(page=self.page, text="conteudo")
        response = self.client.get(reverse("workspace_backup"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response["Content-Disposition"])
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["blocks"][0]["text"], "conteudo")


class WorkspaceViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="alice",
            password="safe-test-password",
        )
        self.client.force_login(self.user)

    def test_renders_subject_chip_and_picker_data(self):
        subject = Subject.objects.create(owner=self.user, name="Cálculo I")
        page = Page.objects.create(owner=self.user, title="Resumo", subject=subject)

        response = self.client.get(reverse("workspace_page", args=[page.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="page-subject-chip"')
        self.assertContains(response, 'id="ws-subjects"')
        self.assertContains(response, "Cálculo I")
        self.assertContains(response, 'id="ctx-rename-page"')

    def test_renders_empty_chip_without_subject(self):
        page = Page.objects.create(owner=self.user, title="Solta")

        response = self.client.get(reverse("workspace_page", args=[page.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Vincular matéria")

    def test_readonly_hides_interactive_chip(self):
        page = Page.objects.create(owner=self.user, title="Leitura")

        response = self.client.get(
            reverse("workspace_page", args=[page.pk]), {"readonly": "1"}
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'id="page-subject-chip"')
