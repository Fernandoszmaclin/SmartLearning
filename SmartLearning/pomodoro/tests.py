import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from notes.models import Page

from .models import PomodoroSession


class PomodoroApiTests(TestCase):
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

    def _log(self, payload):
        return self.client.post(
            reverse("pomodoro_log"),
            json.dumps(payload),
            content_type="application/json",
        )

    def test_log_session(self):
        response = self._log({"minutes": 25, "label": "Foco"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["sessions_today"], 1)
        self.assertEqual(response.json()["minutes_today"], 25)

    def test_log_links_own_page(self):
        page = Page.objects.create(owner=self.user, title="Estudo")
        response = self._log({"minutes": 25, "page": page.pk})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(PomodoroSession.objects.get().page_id, page.pk)

    def test_log_rejects_other_users_page(self):
        page = Page.objects.create(owner=self.other, title="Alheia")
        response = self._log({"minutes": 25, "page": page.pk})
        self.assertEqual(response.status_code, 404)

    def test_log_rejects_invalid_page_type(self):
        response = self._log({"minutes": 25, "page": "abc"})
        self.assertEqual(response.status_code, 400)

    def test_log_rejects_minutes_out_of_range(self):
        self.assertEqual(self._log({"minutes": 0}).status_code, 400)
        self.assertEqual(self._log({"minutes": 241}).status_code, 400)
        self.assertEqual(self._log({"minutes": "abc"}).status_code, 400)

    def test_log_rejects_invalid_mode(self):
        response = self._log({"minutes": 25, "mode": "ferias"})
        self.assertEqual(response.status_code, 400)

    def test_log_coerces_non_string_label(self):
        response = self._log({"minutes": 25, "label": 123})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(PomodoroSession.objects.get().label, "123")

    def test_stats_counts_only_todays_work_sessions(self):
        self._log({"minutes": 25})
        self._log({"minutes": 10, "mode": PomodoroSession.Mode.SHORT_BREAK})
        response = self.client.get(reverse("pomodoro_stats"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"sessions_today": 1, "minutes_today": 25})
