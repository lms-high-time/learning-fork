// «Команда» (learning-services#358): the organization's members and the
// documents they build in its space. Shapes and wording live here so they are
// tested without a server; the page only draws them.

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
