import frappe


def execute():
	"""Move self-enrolled program members into the program's members table.

	enroll_in_program saved them with parentfield "members", while the LMS Program
	table is program_members: the program document did not see them, its form did
	not list them, and member_count stayed 0 (learning-services#417). Recounting
	every program also repairs counts left behind by those rows.
	"""
	frappe.db.set_value(
		"LMS Program Member",
		{"parenttype": "LMS Program", "parentfield": "members"},
		"parentfield",
		"program_members",
		update_modified=False,
	)
	from lms.lms.utils import update_program_member_count

	for program in frappe.get_all("LMS Program", pluck="name"):
		update_program_member_count(program)
