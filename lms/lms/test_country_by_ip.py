# High Time: страна пользователя не определяется по IP
# (lms-high-time/learning-services#466).
from unittest.mock import patch

import frappe
from frappe.tests import UnitTestCase

from lms.lms.utils import check_multicurrency, get_country_code


class TestCountryByIp(UnitTestCase):
	"""IP пользователя не уходит во внешний сервис геолокации.

	Why: `get_country_code` отправлял IP на ip-api.com по открытому HTTP и без
	таймаута. IP — персональные данные, а зависший сервис вешал страницу с ценой.
	"""

	def test_country_is_not_requested_by_ip(self):
		with patch("lms.lms.utils.requests.get") as request_get:
			self.assertIsNone(get_country_code())
		request_get.assert_not_called()

	def test_price_without_profile_country_skips_network(self):
		previous_user = frappe.session.user
		frappe.set_user("Guest")
		try:
			with patch("lms.lms.utils.requests.get") as request_get:
				self.assertEqual(check_multicurrency(100, "RUB"), (100, "RUB"))
			request_get.assert_not_called()
		finally:
			frappe.set_user(previous_user)
