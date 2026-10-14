import json
from pathlib import Path

import frappe

from lms.lms.api import get_pwa_manifest
from lms.lms.test_helpers import BaseTestUtils


def _manifest():
	response = get_pwa_manifest()
	return json.loads(response.get_data(as_text=True))


class TestPWAManifest(BaseTestUtils):
	def test_served_as_a_manifest(self):
		response = get_pwa_manifest()

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.headers["Content-Type"], "application/manifest+json")

	def test_declares_standalone_display(self):
		"""Without this the installed app opens inside full browser chrome."""
		self.assertEqual(_manifest()["display"], "standalone")

	def test_scope_and_id_track_the_lms_route(self):
		manifest = _manifest()

		self.assertEqual(manifest["scope"], manifest["start_url"])
		self.assertEqual(manifest["id"], manifest["start_url"])

	def test_declares_colours_for_the_os_chrome(self):
		manifest = _manifest()

		self.assertEqual(manifest["theme_color"], "#FFFFFF")
		self.assertEqual(manifest["background_color"], "#FFFFFF")

	def test_ships_both_icon_sizes(self):
		sizes = {icon["sizes"] for icon in _manifest()["icons"]}

		self.assertEqual(sizes, {"192x192", "512x512"})

	def test_separates_maskable_from_any(self):
		"""A single 'maskable any' entry gets cropped wherever 'any' is used."""
		purposes = [icon["purpose"] for icon in _manifest()["icons"]]

		self.assertIn("any", purposes)
		self.assertIn("maskable", purposes)
		self.assertNotIn("maskable any", purposes)

	def test_any_and_maskable_are_different_images(self):
		"""A full-bleed maskable image in the 'any' slot is shown uncropped, as a
		hard tile next to rounded icons with margins."""
		icons = _manifest()["icons"]
		any_sources = {icon["src"] for icon in icons if icon["purpose"] == "any"}
		maskable_sources = {icon["src"] for icon in icons if icon["purpose"] == "maskable"}

		self.assertTrue(any_sources)
		self.assertTrue(maskable_sources)
		self.assertFalse(any_sources & maskable_sources)

	def test_icons_exist_in_the_frontend_bundle(self):
		"""The icons are copied files; a renamed or dropped one would 404 silently."""
		public = Path(frappe.get_app_path("lms", "..", "frontend", "public", "manifest"))
		for icon in _manifest()["icons"]:
			name = icon["src"].rsplit("/", 1)[-1]
			self.assertTrue((public / name).is_file(), name)

	def test_banner_image_is_not_used_as_an_icon(self):
		"""It is a wide banner, and was being declared as a 192x192 square."""
		frappe.db.set_single_value("Website Settings", "banner_image", "/files/wide-banner.png")

		sources = [icon["src"] for icon in _manifest()["icons"]]

		for src in sources:
			self.assertTrue(src.startswith("/assets/lms/frontend/manifest/"))

	def test_name_follows_website_settings(self):
		frappe.db.set_single_value("Website Settings", "app_name", "Acme Academy")

		manifest = _manifest()

		self.assertEqual(manifest["name"], "Acme Academy")
		self.assertEqual(manifest["short_name"], "Acme Academy")
