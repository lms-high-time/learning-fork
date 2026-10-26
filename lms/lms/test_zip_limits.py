# Copyright (c) 2026, NikoMusaev and Contributors
# See license.txt

"""Bounds on what an uploaded ZIP may unpack to: SCORM packages and course imports.

Refs lms-high-time/learning-services#693
"""

import os
import shutil
import tempfile
import unittest
import zipfile
from unittest.mock import patch

import frappe

from lms.lms import zip_limits
from lms.lms.api import extract_package
from lms.lms.course_import_export import import_course_zip


def make_zip(path, entries):
	with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
		for name, content in entries:
			zf.writestr(name, content)


class TestZipLimits(unittest.TestCase):
	def setUp(self):
		self._tmp = tempfile.mkdtemp()
		self.zip_path = os.path.join(self._tmp, "pkg.zip")

	def tearDown(self):
		shutil.rmtree(self._tmp, ignore_errors=True)

	def check(self, entries):
		make_zip(self.zip_path, entries)
		with zipfile.ZipFile(self.zip_path) as zf:
			zip_limits.validate_zip_limits(zf)

	def test_archive_within_limits_passes(self):
		with patch.object(zip_limits, "MAX_FILES", 2), patch.object(zip_limits, "MAX_UNCOMPRESSED_BYTES", 10):
			self.check([("a.html", "12345"), ("b.html", "12345")])

	def test_too_many_entries_are_rejected(self):
		with patch.object(zip_limits, "MAX_FILES", 2):
			with self.assertRaises(frappe.exceptions.ValidationError):
				self.check([("a", "1"), ("b", "2"), ("c", "3")])

	def test_entry_size_is_bounded_when_asked(self):
		make_zip(self.zip_path, [("course.json", "0" * 2048)])
		with zipfile.ZipFile(self.zip_path) as zf:
			zip_limits.validate_zip_limits(zf)
			zip_limits.validate_zip_limits(zf, max_entry_bytes=2048)
			with self.assertRaises(frappe.exceptions.ValidationError):
				zip_limits.validate_zip_limits(zf, max_entry_bytes=2047)

	def test_unpacked_size_is_bounded(self):
		# Highly compressible content: small on disk, large once unpacked.
		with patch.object(zip_limits, "MAX_UNCOMPRESSED_BYTES", 1024 * 1024):
			with self.assertRaises(frappe.exceptions.ValidationError):
				self.check([("big.html", "0" * (1024 * 1024 + 1))])
		self.assertLess(os.path.getsize(self.zip_path), 64 * 1024)


class TestZipLimitsApplied(unittest.TestCase):
	"""Both unpacking paths check the limits before writing anything."""

	COURSE = "ct-zip-limits-course"

	def setUp(self):
		self.scorm_root = os.path.realpath(frappe.get_site_path("private", "scorm"))
		self.import_path = os.path.join(
			"private", "files", f"ct-zip-limits-{frappe.generate_hash(length=8)}.zip"
		)
		os.makedirs(frappe.get_site_path("private", "files"), exist_ok=True)

	def tearDown(self):
		shutil.rmtree(os.path.join(self.scorm_root, self.COURSE), ignore_errors=True)
		if os.path.exists(frappe.get_site_path(self.import_path)):
			os.remove(frappe.get_site_path(self.import_path))

	def test_scorm_package_over_the_limit_is_not_extracted(self):
		path = frappe.get_site_path(self.import_path)
		make_zip(path, [("index.html", "ok"), ("a.html", "1"), ("b.html", "2")])
		package = frappe._dict(get_full_path=lambda: path)
		with (
			patch.object(zip_limits, "MAX_FILES", 2),
			patch("lms.lms.api.frappe.get_doc", return_value=package),
		):
			with self.assertRaises(frappe.exceptions.ValidationError):
				extract_package(self.COURSE, "chapter-1", frappe._dict(name="dummy"))
		self.assertFalse(os.path.exists(os.path.join(self.scorm_root, self.COURSE, "chapter-1")))

	def test_rejected_replacement_keeps_the_previous_package(self):
		previous = os.path.join(self.scorm_root, self.COURSE, "chapter-1")
		os.makedirs(previous)
		with open(os.path.join(previous, "index.html"), "w") as f:
			f.write("previous")
		path = frappe.get_site_path(self.import_path)
		make_zip(path, [("index.html", "new"), ("a.html", "1"), ("b.html", "2")])
		package = frappe._dict(get_full_path=lambda: path)
		with (
			patch.object(zip_limits, "MAX_FILES", 2),
			patch("lms.lms.api.frappe.get_doc", return_value=package),
		):
			with self.assertRaises(frappe.exceptions.ValidationError):
				extract_package(self.COURSE, "chapter-1", frappe._dict(name="dummy"))
		with open(os.path.join(previous, "index.html")) as f:
			self.assertEqual(f.read(), "previous")

	def test_course_import_over_the_limit_is_rejected(self):
		entries = [("course.json", '{"title": "Limits"}'), ("a", "1"), ("b", "2")]
		make_zip(frappe.get_site_path(self.import_path), entries)
		# Past the check the import would start creating documents.
		stop = AssertionError("the import went past the limits")
		with (
			patch.object(zip_limits, "MAX_FILES", 2),
			patch("lms.lms.course_import_export.create_assets", side_effect=stop),
		):
			with self.assertRaises(frappe.exceptions.ValidationError):
				import_course_zip(self.import_path)

	def test_course_import_caps_each_entry_at_the_upload_limit(self):
		entries = [("course.json", '{"title": "Limits"}'), ("assets/big.png", "0" * 4096)]
		make_zip(frappe.get_site_path(self.import_path), entries)
		stop = AssertionError("the import went past the limits")
		with (
			patch("lms.lms.course_import_export.get_max_file_size", return_value=1024),
			patch("lms.lms.course_import_export.create_assets", side_effect=stop),
		):
			with self.assertRaises(frappe.exceptions.ValidationError):
				import_course_zip(self.import_path)
