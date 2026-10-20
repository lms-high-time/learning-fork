/**
 * Rules behind the course program: its chapters, lessons and where the student is.
 *
 * Kept out of the components so the rules that matter are pinned by tests: which
 * status a lesson shows, and that only covered topics count as mastered — a topic
 * touched in passing is not progress, and counting it would show a course further
 * along than it is (learning-services#322).
 */

export type ProgramObjective = {
	text: string
	/** Absent for a guest and for a topic never reported on. */
	status?: 'covered' | 'touched'
}

/** A block of the course's document built in a lesson (learning-services#340). */
export type ProgramBlock = {
	artifact: string
	key: string
	title: string
	/** What the block is for, written for the student (learning-services#515). */
	description?: string | null
	/** Present only for an enrolled student. */
	filled?: boolean
}

/** A document the course builds; the counts only for an enrolled student. */
export type ProgramDocument = {
	artifact: string
	title: string
	blocks_total?: number
	blocks_filled?: number
}

export type ProgramLesson = {
	id: string
	number: number
	title: string
	/** The lesson's opening, addressed to the student; null when the author left it empty. */
	hook: string | null
	objectives: ProgramObjective[]
	/** Present only for an enrolled student. */
	completed?: boolean
	/** The document blocks built in this lesson. */
	blocks?: ProgramBlock[]
}

/** Where an enrolled student stands in a chapter (learning-services#547). */
export type ChapterStatus = 'not_started' | 'in_progress' | 'passed'

export type ProgramChapter = {
	title: string
	/** What the chapter is about, from the course's release; null without one. */
	description?: string | null
	/** Present only for an enrolled student, as `course_outline` counts them. */
	status?: ChapterStatus
	lessons_total?: number
	lessons_passed?: number
	lessons: ProgramLesson[]
}

export type ProgramData = {
	course: string
	title: string
	chapters: ProgramChapter[]
	/** Present only for an enrolled student; null once every lesson is closed. */
	next_lesson?: string | null
	documents?: ProgramDocument[]
	/** An announced course (learning-services#389): no programme, only the
	 * course objectives, and whether the viewer asked to hear of its release. */
	upcoming?: boolean
	objectives?: string[]
	/** Absent for a guest. */
	notify?: boolean
	/** The viewer tests the course before publication (learning-services#393). */
	tester?: boolean
}

export type LessonStatus =
	| 'completed'
	| 'in-progress'
	| 'next'
	| 'ahead'
	| 'none'

/** Every lesson in program order, each with its chapter's title and index. */
export function flattenLessons(
	chapters: ProgramChapter[]
): (ProgramLesson & { chapter: string; chapterIndex: number })[] {
	return chapters.flatMap((chapter, chapterIndex) =>
		chapter.lessons.map((lesson) => ({
			...lesson,
			chapter: chapter.title,
			chapterIndex,
		}))
	)
}

/**
 * The status a lesson shows. `none` is a guest's: there is no progress to show.
 *
 * Closed wins over next: a closed lesson is never the next one anyway, and a
 * lesson with a report but still open is in progress even when it is next.
 */
export function lessonStatus(
	lesson: ProgramLesson,
	nextLesson: string | null | undefined
): LessonStatus {
	if (lesson.completed === undefined) return 'none'
	if (lesson.completed) return 'completed'
	const reported = lesson.objectives.some((objective) => objective.status)
	if (reported) return 'in-progress'
	if (lesson.id === nextLesson) return 'next'
	return 'ahead'
}

/** Covered topics out of all of them; touched ones do not count. */
export function topicCount(objectives: ProgramObjective[]): {
	covered: number
	total: number
} {
	return {
		covered: objectives.filter((objective) => objective.status === 'covered')
			.length,
		total: objectives.length,
	}
}

/** Share of covered topics, 0..1; a lesson without topics has none to cover. */
export function coverage(objectives: ProgramObjective[]): number {
	const { covered, total } = topicCount(objectives)
	return total ? covered / total : 0
}

/**
 * An enrolled student's progress in a chapter: lessons passed out of all of
 * them, and whether the chapter is passed. Null for a visitor — the server
 * sends no counts to one.
 */
export function chapterProgress(
	chapter: ProgramChapter
): { passed: number; total: number; done: boolean } | null {
	if (chapter.status === undefined || chapter.lessons_total === undefined)
		return null
	return {
		passed: chapter.lessons_passed ?? 0,
		total: chapter.lessons_total,
		done: chapter.status === 'passed',
	}
}

/**
 * The chapter the programme opens on: the one with the next lesson for an
 * enrolled student, the first one for a visitor. A finished course opens on
 * none — every chapter is passed and nothing in it calls (learning-services#636).
 */
export function openChapter(
	chapters: ProgramChapter[],
	nextLesson: string | null | undefined
): number | null {
	if (!chapters.length) return null
	const enrolled = chapters.some((chapter) => chapter.status !== undefined)
	if (!enrolled) return 0
	const index = nextLesson
		? chapters.findIndex((chapter) =>
				chapter.lessons.some((lesson) => lesson.id === nextLesson)
		  )
		: -1
	if (index >= 0) return index
	// No next lesson named: the first chapter not passed yet, or none at all
	// once every chapter is.
	const open = chapters.findIndex((chapter) => chapter.status !== 'passed')
	return open >= 0 ? open : null
}

/** Where an enrolled student is in the course; null for a visitor. */
export type CoursePath = {
	/** Lessons closed out of all of them. */
	passed: number
	total: number
	chapters: number
	/** The next lesson's chapter (1-based) and its number across the whole
	 * course — «lesson 9 of 21», not within the chapter; null once there is none. */
	chapter: number | null
	lesson: number | null
	/** Every lesson closed. */
	done: boolean
	/** Anything studied: a lesson closed or a topic reported on. */
	started: boolean
}

export function coursePath(data: ProgramData): CoursePath | null {
	const lessons = flattenLessons(data.chapters)
	if (!lessons.length || lessons.some((l) => l.completed === undefined))
		return null
	const passed = lessons.filter((lesson) => lesson.completed).length
	const next = lessons.findIndex((lesson) => lesson.id === data.next_lesson)
	return {
		passed,
		total: lessons.length,
		chapters: data.chapters.length,
		chapter: next >= 0 ? lessons[next].chapterIndex + 1 : null,
		lesson: next >= 0 ? next + 1 : null,
		done: passed === lessons.length,
		started:
			passed > 0 ||
			lessons.some((lesson) =>
				lesson.objectives.some((objective) => objective.status)
			),
	}
}
