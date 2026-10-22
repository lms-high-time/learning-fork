# Copyright (c) 2026, NikoMusaev and Contributors
# See license.txt

"""Bounds on what an uploaded ZIP may unpack to: SCORM packages and course imports.

The upload itself is capped by the web server, but a ZIP of that size can
unpack to many times more. The check reads only the central directory. The
declared sizes it sums are binding: `zipfile` stops reading an entry at its
declared size and fails the CRC check, so an entry cannot unpack to more
than it claims.

Refs lms-high-time/learning-services#693
"""

import zipfile

import frappe
from frappe import _

#: Generous for a SCORM package with media: authoring tools export a few
#: hundred to a few thousand files.
MAX_FILES = 10_000

#: Ten times the 50 MB upload limit: room for text-heavy packages, which
#: compress well, without filling the disk.
MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024


MB = 1024 * 1024


def validate_zip_limits(zip_file: zipfile.ZipFile, max_entry_bytes: int | None = None) -> None:
	"""Reject the archive before anything is unpacked or removed.

	`max_entry_bytes` caps each entry, for callers that read entries into
	memory whole (the course import) rather than streaming them to disk.
	"""
	entries = zip_file.infolist()
	if len(entries) > MAX_FILES:
		frappe.throw(_("The archive contains more than {0} files.").format(MAX_FILES))
	if sum(entry.file_size for entry in entries) > MAX_UNCOMPRESSED_BYTES:
		frappe.throw(_("The archive unpacks to more than {0} MB.").format(MAX_UNCOMPRESSED_BYTES // MB))
	if max_entry_bytes is not None and any(entry.file_size > max_entry_bytes for entry in entries):
		frappe.throw(_("A file in the archive is larger than {0} MB.").format(max_entry_bytes // MB))
