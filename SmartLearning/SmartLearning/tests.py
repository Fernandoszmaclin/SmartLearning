from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from academics.models import Note, Subject
from notes.models import Block, Page


class PublicPagesTests(TestCase):
    def test_terms_page_has_title(self):
        response = self.client.get(reverse("terms"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Termos de Uso")

    def test_privacy_page_has_title(self):
        response = self.client.get(reverse("privacy"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Política de Privacidade")

    def test_landing_renders(self):
        response = self.client.get(reverse("landing"))
        self.assertEqual(response.status_code, 200)


class SearchTests(TestCase):
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

    def test_search_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("search"), {"q": "x"})
        self.assertEqual(response.status_code, 302)

    def test_search_finds_own_content_only(self):
        page = Page.objects.create(owner=self.user, title="Grafos")
        Block.objects.create(page=page, text="árvores e grafos")
        Note.objects.create(
            owner=self.user, category=Note.Category.PROVA, title="Prova de grafos"
        )
        Subject.objects.create(owner=self.user, name="Teoria dos Grafos")
        Page.objects.create(owner=self.other, title="Grafos do bob")
        Subject.objects.create(owner=self.other, name="Grafos do bob")

        response = self.client.get(
            reverse("search"), {"q": "grafos", "format": "json"}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["pages"]), 1)
        self.assertEqual(len(data["notes"]), 1)
        self.assertEqual(len(data["subjects"]), 1)
        self.assertEqual(data["total"], 3)

    def test_search_escapes_html_in_results(self):
        Page.objects.create(owner=self.user, title="<script>alert(1)</script>")
        response = self.client.get(reverse("search"), {"q": "script"})
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "<script>alert(1)</script>")


class SignupTests(TestCase):
    def test_signup_creates_user_and_logs_in(self):
        response = self.client.post(reverse("signup"), {
            "username": "novo",
            "password1": "senha-bem-forte-123",
            "password2": "senha-bem-forte-123",
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], reverse("workspace"))
        self.assertTrue(get_user_model().objects.filter(username="novo").exists())
