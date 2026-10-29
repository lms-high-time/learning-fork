# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

"""The language Learning speaks to a request (learning-services#765).

The public site keeps the visitor's choice in the `preferred_language` cookie.
Frappe already honours it for a guest in `frappe.local.lang`; Learning's
catalogue and `<html lang>` did not — a guest read the system language whatever
the cookie said, and a user with an empty language got no catalogue at all.
Pinned here: one resolution behind `get_translations` and the boot.
"""

from unittest.mock import patch

import frappe
from frappe.translate import get_language
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request

from lms.lms.api import get_translations
from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import get_reader_lang
from lms.www._lms import get_boot


def _request(cookie: str | None = None, accept_language: str = "ru"):
	"""A request as nginx hands it on: Accept-Language forced to Russian."""
	builder = EnvironBuilder(path="/lms", headers={"Accept-Language": accept_language})
	if cookie:
		builder.headers["Cookie"] = f"preferred_language={cookie}"
	return Request(builder.get_environ())


class TestReaderLang(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.saved = (frappe.session.user, frappe.local.lang, getattr(frappe.local, "request", None))
		self.system = frappe.get_system_settings("language") or "en"

	def tearDown(self):
		user, lang, request = self.saved
		frappe.set_user(user)
		frappe.local.lang = lang
		frappe.local.request = request
		super().tearDown()

	def _as_guest(self, cookie=None):
		"""A guest's request: Frappe sets `frappe.local.lang` as it does on every one."""
		frappe.set_user("Guest")
		frappe.local.request = _request(cookie)
		frappe.local.lang = get_language()

	def _user(self, language):
		email = f"reader-lang-{language or 'none'}@example.com"
		user = self._create_user(email, "Reader", "Lang", ["LMS Student"])
		frappe.db.set_value("User", user.name, "language", language or "")
		frappe.clear_cache(user=user.name)
		return user.name

	def _catalogue_language(self):
		with patch("lms.lms.api.get_all_translations", return_value={}) as catalogue:
			get_translations()
		return catalogue.call_args.args[0]

	def _boot_language(self):
		with patch("frappe.sessions.get_csrf_token", return_value="token"):
			return get_boot().lang

	def test_guest_with_the_english_cookie_reads_english(self):
		self._as_guest(cookie="en")

		self.assertEqual(get_reader_lang(), "en")
		self.assertEqual(self._catalogue_language(), "en")
		self.assertEqual(self._boot_language(), "en")

	def test_guest_without_a_cookie_reads_the_request_language(self):
		self._as_guest()

		self.assertEqual(get_reader_lang(), "ru")
		self.assertEqual(self._catalogue_language(), "ru")
		self.assertEqual(self._boot_language(), "ru")

	def test_user_with_a_language_reads_it_over_the_request(self):
		frappe.set_user(self._user("en"))
		frappe.local.lang = "ru"

		self.assertEqual(get_reader_lang(), "en")
		self.assertEqual(self._catalogue_language(), "en")
		self.assertEqual(self._boot_language(), "en")

	def test_user_without_a_language_reads_the_request_language(self):
		frappe.set_user(self._user(None))
		frappe.local.lang = "en"

		self.assertEqual(get_reader_lang(), "en")
		# Not an empty catalogue, as `get_all_translations(None)` gave.
		self.assertEqual(self._catalogue_language(), "en")
		self.assertEqual(self._boot_language(), "en")

	def test_the_system_language_closes_the_list(self):
		frappe.set_user(self._user(None))
		frappe.local.lang = None

		self.assertEqual(get_reader_lang(), self.system)
