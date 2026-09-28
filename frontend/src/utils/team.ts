// «Команда» (learning-services#358): the organization's members and the
// documents they build in its space. Shapes and wording live here so they are
// tested without a server; the page only draws them.

import { plural, type PluralForms } from '@/utils/plural'

export type TeamMember = {
	user: string
	full_name: string | null
	role: string
	left: boolean
	left_on: string | null
}

export type TeamCourse = {
	id: string
	title: string | null
	documents: { artifact: string; title: string }[]
}

export type TeamData = {
	organization: string
	title: string | null
	can_see_report: boolean
	can_manage: boolean
	can_change_roles: boolean
	// Places in an organization we have not verified; null — no limit (#379).
	member_limit?: number | null
	members: TeamMember[]
	courses: TeamCourse[]
}

export type TeamEntry = {
	user: string
	full_name: string | null
	left: boolean
	filled: boolean
	content: string
	file: { name: string; url: string } | null
	url: string | null
	table_markdown: string | null
}

export type TeamDocuments = {
	title: string
	authors: {
		user: string
		full_name: string | null
		left: boolean
		blocks_filled: number
		blocks_total: number
	}[]
	blocks: { key: string; title: string; entries: TeamEntry[] }[]
}

export type ReportRow = {
	user: string
	full_name: string | null
	course: string
	status: 'not_started' | 'in_progress' | 'completed'
	progress: number
	deadline: string | null
	overdue: boolean
	document: { blocks_total: number; blocks_filled: number }
	quiz: { passed: number; first_try: number }
}

const ROLES: Record<string, string> = {
	Member: 'Member',
	Manager: 'Manager',
	'Org Admin': 'Administrator',
}

export const roleLabel = (role: string): string => __(ROLES[role] ?? role)

export const statusLabel = (status: ReportRow['status']): string =>
	({
		not_started: __('Not started'),
		in_progress: __('In progress'),
		completed: __('Completed'),
	}[status] ?? status)

export const percent = (share: number): string => `${Math.round(share * 100)}%`

// The first course that builds a document, and its first document: the page
// opens on something to compare rather than on two empty pickers.
export const firstDocument = (
	courses: TeamCourse[]
): { course: string; artifact: string } | null => {
	const course = courses.find((item) => item.documents.length)
	return course
		? { course: course.id, artifact: course.documents[0].artifact }
		: null
}

// An entry with nothing in it is still shown — who has not filled a block is
// part of the comparison — but drawn as a gap, not as an empty card.
export const isEmpty = (entry: TeamEntry): boolean =>
	!entry.filled &&
	!entry.content.trim() &&
	!entry.file &&
	!entry.url &&
	!entry.table_markdown

export const ROLE_VALUES = ['Member', 'Manager', 'Org Admin'] as const

// Who marks whom as gone (learning-services#363): a manager marks members, an
// administrator anyone. The server enforces it; the page offers no button
// the server would refuse.
export const canRemove = (member: TeamMember, team: TeamData): boolean =>
	!member.left &&
	team.can_manage &&
	(member.role === 'Member' || team.can_change_roles)

// What the invitation page tells before joining: who will read the documents.
export const readersBeforeJoining = (
	visibleTo: 'managers' | 'members' | 'only_me',
	title: string
): string =>
	visibleTo === 'members'
		? __(
				'Your documents for the courses of {0} will be visible to everyone in it.'
		  ).format(title)
		: __(
				'Your documents for the courses of {0} will be visible to its managers.'
		  ).format(title)

export type Allocation = {
	id: string
	course: string
	title: string | null
	whole_team: boolean
	members: string[]
	deadline: string | null
	mandatory: boolean
	chosen_by_member: boolean
}

// Who an assignment is for, in a line (learning-services#365).
export const audienceText = (
	item: Allocation,
	names: Record<string, string>
): string => {
	if (item.chosen_by_member) return __('Taken by the member from the catalog')
	if (item.whole_team) return __('The whole team')
	return item.members.map((user) => names[user] || user).join(', ')
}

// Who is still in the team comes first, who left after (learning-services#378).
export const presentFirst = <T extends { left: boolean }>(items: T[]): T[] =>
	[...items].sort((a, b) => Number(a.left) - Number(b.left))

export const memberName = (item: {
	user: string
	full_name: string | null
}): string => item.full_name || item.user

export type BlockView = {
	key: string
	title: string
	// What to draw: every filled entry, or one when they are all the same.
	filled: TeamEntry[]
	// Everyone whose entry is that same one — a preset nobody changed.
	sameFor: TeamEntry[]
	// Gaps go in a line of names, not in empty cards.
	missing: TeamEntry[]
}

const sameText = (entry: TeamEntry): string =>
	JSON.stringify([
		entry.content.trim(),
		entry.table_markdown ?? '',
		entry.file?.url ?? '',
		entry.url ?? '',
	])

// One block as the page draws it (learning-services#378): a block of thirteen
// people repeated the same preset table thirteen times, and the gaps took as
// much room as the answers.
export const blockView = (
	block: TeamDocuments['blocks'][number],
	person: string | null
): BlockView => {
	const entries = presentFirst(
		block.entries.filter((entry) => !person || entry.user === person)
	)
	const filled = entries.filter((entry) => !isEmpty(entry))
	const same =
		filled.length > 1 &&
		filled.every((entry) => sameText(entry) === sameText(filled[0]))
	return {
		key: block.key,
		title: block.title,
		filled: same ? [filled[0]] : filled,
		sameFor: same ? filled : [],
		missing: entries.filter(isEmpty),
	}
}

// Dates the way the reader writes them, not ISO (learning-services#379).
export const formatDay = (
	iso: string | null,
	lang: string = (typeof document !== 'undefined' &&
		document.documentElement.lang) ||
		'ru'
): string => {
	if (!iso) return '—'
	const day = new Date(`${iso.slice(0, 10)}T00:00:00`)
	if (Number.isNaN(day.getTime())) return iso
	const options = { day: 'numeric', month: 'long', year: 'numeric' } as const
	try {
		return new Intl.DateTimeFormat(lang, options).format(day)
	} catch {
		// Not a language tag (a page without boot data): the browser's own.
		return new Intl.DateTimeFormat(undefined, options).format(day)
	}
}

export const DAYS_LEFT: PluralForms = {
	one: 'in {0} day',
	few: 'in {0} days [few]',
	many: 'in {0} days [many]',
	other: 'in {0} days',
}

export const DAYS_OVERDUE: PluralForms = {
	one: '{0} day overdue',
	few: '{0} days overdue [few]',
	many: '{0} days overdue [many]',
	other: '{0} days overdue',
}

// How far the deadline is: a manager reads "in 5 days", not a date to count
// from. Days between calendar dates, so the hour of the day does not matter.
export const daysUntil = (deadline: string, today: Date = new Date()): number => {
	const end = Date.UTC(
		Number(deadline.slice(0, 4)),
		Number(deadline.slice(5, 7)) - 1,
		Number(deadline.slice(8, 10))
	)
	const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
	return Math.round((end - start) / 86_400_000)
}

export const deadlineText = (
	row: Pick<ReportRow, 'deadline' | 'status'>,
	today: Date = new Date()
): string => {
	if (!row.deadline) return '—'
	if (row.status === 'completed') return formatDay(row.deadline)
	const days = daysUntil(row.deadline, today)
	if (days === 0) return __('Due today')
	return days > 0 ? plural(days, DAYS_LEFT) : plural(-days, DAYS_OVERDUE)
}

// The line above the report: how many rows are done, going, overdue.
export const reportSummary = (rows: ReportRow[]) => ({
	total: rows.length,
	completed: rows.filter((row) => row.status === 'completed').length,
	overdue: rows.filter((row) => row.overdue).length,
})

export type ReportSort = 'member' | 'status' | 'deadline' | 'progress'

const STATUS_ORDER: Record<ReportRow['status'], number> = {
	not_started: 0,
	in_progress: 1,
	completed: 2,
}

// Sorting the report by a column; empty deadlines go last either way.
export const sortReport = (
	rows: ReportRow[],
	key: ReportSort,
	ascending: boolean
): ReportRow[] => {
	const value = (row: ReportRow): string | number | null => {
		if (key === 'member') return (row.full_name || row.user).toLowerCase()
		if (key === 'status') return STATUS_ORDER[row.status]
		if (key === 'progress') return row.progress
		return row.deadline
	}
	return [...rows].sort((a, b) => {
		const x = value(a)
		const y = value(b)
		if (x === y) return 0
		if (x === null) return 1
		if (y === null) return -1
		const order = x < y ? -1 : 1
		return ascending ? order : -order
	})
}
