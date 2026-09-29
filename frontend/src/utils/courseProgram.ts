/**
 * Rules behind the course program: the navigation dots and the lesson slides.
 *
 * Kept out of the components so the rules that matter are pinned by tests: which
 * status a lesson shows, and that only covered topics count as mastered — a topic
 * touched in passing is not progress, and counting it would show a course further
 * along than it is (learning-services#322).
 */

export type ProgramObjective = {
	text: string
	/** Absent for a guest and for a topic never reported on. */
	status?: 'covered' | 'touched' | 'skipped'
}

/** A block of the course's document built in a lesson (learning-services#340). */
export type ProgramBlock = {
	artifact: string
	key: string
	title: string
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

export type ProgramChapter = {
	title: string
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

/** Covered topics out of all of them; touched and skipped do not count. */
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
 * The slide to open on: the next lesson for an enrolled student, the first
 * lesson otherwise — including a finished course, where there is no next one.
 */
export function startIndex(
	lessons: { id: string }[],
	nextLesson: string | null | undefined
): number {
	const index = lessons.findIndex((lesson) => lesson.id === nextLesson)
	return index >= 0 ? index : 0
}
