# Copyright (c) 2024, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils
from lms.lms.utils import enroll_in_program, get_program_details
from lms.patches.v2_0.fix_program_member_parentfield import execute as fix_parentfield


class TestLMSProgram(BaseTestUtils):
	"""Joining a program by one's own hand (learning-services#417)."""

	def setUp(self):
		super().setUp()
		# Rolled back rather than deleted: a program with members does not
		# delete cleanly, and the shared instructor must outlive this test.
		self.addCleanup(frappe.db.rollback)
		self.addCleanup(frappe.set_user, "Administrator")
		suffix = frappe.generate_hash(length=6)
		if not frappe.db.exists("User", "frappe@example.com"):
			self._create_user("frappe@example.com", "Frappe", "Instructor", ["Course Creator"])
		self.student = self._create_user(
			f"program-student-{suffix}@example.com", "Program", "Student", ["LMS Student"]
		).name
		course = self._create_course(f"Program Utility Course {suffix}")
		self.program = frappe.get_doc(
			{
				"doctype": "LMS Program",
				"title": f"Program Utility Path {suffix}",
				"description": "Two courses, in order.",
				"published": 1,
				"enforce_course_order": 1,
				"program_courses": [{"course": course.name}],
			}
		).insert(ignore_permissions=True)
		self.cleanup_items.clear()

	def test_joining_lands_in_the_members_table_and_is_counted(self):
		frappe.set_user(self.student)
		enroll_in_program(self.program.name)
		frappe.set_user("Administrator")

		program = frappe.get_doc("LMS Program", self.program.name)
		self.assertEqual([row.member for row in program.program_members], [self.student])
		self.assertEqual(program.member_count, 1)

	def test_details_say_whether_the_viewer_is_a_member(self):
		frappe.set_user(self.student)
		before = get_program_details(self.program.name)
		enroll_in_program(self.program.name)
		after = get_program_details(self.program.name)

		self.assertFalse(before.is_member)
		self.assertTrue(after.is_member)
		self.assertEqual(after.description, "Two courses, in order.")

	def test_patch_moves_rows_saved_under_the_wrong_field(self):
		frappe.get_doc(
			{
				"doctype": "LMS Program Member",
				"parent": self.program.name,
				"parenttype": "LMS Program",
				"parentfield": "members",
				"member": self.student,
			}
		).insert(ignore_permissions=True)

		fix_parentfield()

		program = frappe.get_doc("LMS Program", self.program.name)
		self.assertEqual([row.member for row in program.program_members], [self.student])
		self.assertEqual(program.member_count, 1)
