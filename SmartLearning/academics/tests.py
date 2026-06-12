from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from notes.models import Page

from .models import Note, Subject


class AcademicsViewTests(TestCase):
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

    def test_note_edit_of_other_user_is_404(self):
        note = Note.objects.create(
            owner=self.other, category=Note.Category.PROVA, title="Alheia"
        )
        response = self.client.get(reverse("academic_note_edit", args=[note.pk]))
        self.assertEqual(response.status_code, 404)

    def test_subject_detail_only_lists_own_pages(self):
        subject = Subject.objects.create(owner=self.user, name="Cálculo")
        mine = Page.objects.create(owner=self.user, subject=subject, title="Minha")
        leaked = Page.objects.create(owner=self.other, subject=subject, title="Vazada")

        response = self.client.get(reverse("subject_detail", args=[subject.pk]))

        self.assertEqual(response.status_code, 200)
        estudos = dict((key, qs) for key, _, qs in response.context["groups"])["estudo"]
        self.assertIn(mine, estudos)
        self.assertNotIn(leaked, estudos)

    def test_subject_detail_of_other_user_is_404(self):
        subject = Subject.objects.create(owner=self.other, name="Alheia")
        response = self.client.get(reverse("subject_detail", args=[subject.pk]))
        self.assertEqual(response.status_code, 404)

    def test_weekly_plan_clamps_available_time(self):
        response = self.client.get(
            reverse("academic_weekly_plan"), {"available_time": "-5"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["available_time"], 15)

        response = self.client.get(
            reverse("academic_weekly_plan"), {"available_time": "abc"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["available_time"], 120)

    def test_calendar_falls_back_on_invalid_month(self):
        response = self.client.get(
            reverse("academic_calendar"), {"year": "2026", "month": "13"}
        )
        self.assertEqual(response.status_code, 200)

    def test_subject_create_ignores_duplicate_name(self):
        Subject.objects.create(owner=self.user, name="Física")
        response = self.client.post(
            reverse("academic_subject_create"), {"name": "Física", "color": "#3b82f6"}
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            Subject.objects.filter(owner=self.user, name="Física").count(), 1
        )

    def test_dashboard_renders(self):
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)
