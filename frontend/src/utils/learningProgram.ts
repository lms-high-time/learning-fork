// A Learning program — courses in a set order — as its page draws it
// (learning-services#417). The server says which course is eligible; the page
// turns that into one status per step and the one action worth taking.

export type ProgramCourse = {
	name: string
	title: string
	short_introduction?: string | null
	upcoming?: 0 | 1 | boolean
	eligible?: boolean
	membership?: { progress?: number } | null
}

export type ProgramDetails = {
	name: string
	title?: string | null
	description?: string | null
	enforce_course_order?: 0 | 1 | boolean
	is_member?: boolean
	progress?: number | null
	courses: ProgramCourse[]
}

export type StepStatus =
	| 'upcoming'
	| 'completed'
	| 'locked'
	| 'in_progress'
	| 'open'

export const stepStatus = (
	course: ProgramCourse,
	program: ProgramDetails
): StepStatus => {
	if (course.upcoming) return 'upcoming'
	const progress = course.membership?.progress ?? 0
	if (course.membership && progress >= 100) return 'completed'
	// The order binds members only (the owner's decision, #405).
	if (program.is_member && program.enforce_course_order && !course.eligible)
		return 'locked'
	return course.membership ? 'in_progress' : 'open'
}

export const stepLabel = (status: StepStatus, previous?: number): string =>
	({
		upcoming: __('In the works'),
		completed: __('Course passed'),
		locked: __('Opens after course {0}').format(previous ?? 1),
		in_progress: __('In progress'),
		open: __('Available to take'),
	}[status])

// Courses the server could not show (unpublished for this viewer) come back
// empty and are left out of the path.
export const pathOf = (program: ProgramDetails): ProgramCourse[] =>
	program.courses.filter((course) => course?.name)

// Where a member goes next: the first course they can take and have not
// passed. None while every open step is passed, shut or still in the works.
export const nextStep = (program: ProgramDetails): ProgramCourse | null =>
	pathOf(program).find((course) =>
		['in_progress', 'open'].includes(stepStatus(course, program))
	) ?? null

// Joining a program whose first course is an announcement is, for now,
// asking to hear when it opens.
export const firstUpcoming = (program: ProgramDetails): ProgramCourse | null => {
	const first = pathOf(program)[0]
	return first?.upcoming ? first : null
}
