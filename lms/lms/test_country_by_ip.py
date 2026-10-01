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

	def test_страна_по_ip_не_запрашивается(self):
		with patch("lms.lms.utils.requests.get") as запрос:
			self.assertIsNone(get_country_code())
		запрос.assert_not_called()

	def test_цена_без_страны_в_профиле_не_ходит_в_сеть(self):
		frappe.set_user("Guest")
		try:
			with patch("lms.lms.utils.requests.get") as запрос:
				self.assertEqual(check_multicurrency(100, "RUB"), (100, "RUB"))
			запрос.assert_not_called()
		finally:
			frappe.set_user("Administrator")
