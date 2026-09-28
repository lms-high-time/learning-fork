import { defineStore } from 'pinia'
import { computed } from 'vue'
import { call, createResource, toast } from 'frappe-ui'

// The learner's spaces: personal, and every organization they belong to
// (learning-services#346). Progress is one per person; courses and documents
// belong to a space. The choice lives on the server, not in the browser — the
// learner's agent and the web chat read the same choice, and they have no
// switcher to look at.

export const PERSONAL = 'personal'

export type DocumentsVisibleTo = 'only_me' | 'managers' | 'members'

export type Space = {
	id: string
	title: string | null
	role: string | null
	suspended: boolean
	documents_visible_to: DocumentsVisibleTo
}

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

type SpacesData = { current: string; spaces: Space[] }
type CoursesData = { courses: { id: string }[] }

export const useSpace = defineStore('space', () => {
	const spacesResource = createResource({
		url: 'lms_frappe_app.api.student.my_spaces',
		auto: false,
	})
	// Only an organization narrows the lists: the personal space holds every
	// course of the learner and the whole catalog (owner's decision, #346), so
	// there is nothing to fetch for it.
	const coursesResource = createResource({
		url: 'lms_frappe_app.api.student.list_my_courses',
		auto: false,
	})
	const catalogResource = createResource({
		url: 'lms_frappe_app.api.student.list_catalog',
		auto: false,
	})

	const answer = computed(
		() => spacesResource.data as Answer<SpacesData> | null
	)
	const spaces = computed<Space[]>(() =>
		answer.value?.ok ? answer.value.data?.spaces ?? [] : []
	)
	const current = computed<string>(() =>
		answer.value?.ok ? answer.value.data?.current ?? PERSONAL : PERSONAL
	)
	const currentSpace = computed(() =>
		spaces.value.find((space: Space) => space.id === current.value)
	)
	// One entry is the personal space alone: without an organization there is
	// nothing to switch between, and the switcher stays out of the way.
	const hasOrganizations = computed(() => spaces.value.length > 1)
	const isOrganization = computed(() => current.value !== PERSONAL)

	const ids = (resource: typeof coursesResource) => {
		const data = resource.data as Answer<CoursesData> | null
		return data?.ok ? (data.data?.courses ?? []).map((course) => course.id) : []
	}
	const myCourseIds = computed(() => ids(coursesResource))
	const catalogIds = computed(() => ids(catalogResource))

	let loading: Promise<void> | undefined

	// Loaded once per page: the pages that narrow their lists wait for it, and
	// the rest read what is already there. A failure (a site without
	// lms_frappe_app, a guest) leaves the personal space — Learning as it was.
	function load(): Promise<void> {
		loading ??= fetchSpace()
		return loading
	}

	async function fetchSpace(): Promise<void> {
		try {
			await spacesResource.reload()
			if (!isOrganization.value) return
			await Promise.all([
				coursesResource.reload({ space: current.value }),
				catalogResource.reload({ space: current.value }),
			])
		} catch {
			// Personal space: every list stays as Learning draws it.
		}
	}

	async function choose(space: string): Promise<void> {
		if (space === current.value) return
		const result = (await call('lms_frappe_app.api.student.set_space', {
			space,
		})) as Answer<{ current: string }>
		if (!result?.ok) {
			toast.error(result?.error?.message ?? __('Could not switch the space'))
			return
		}
		// Every list on the page belongs to the space it was drawn in. A reload
		// redraws all of them at once instead of each page learning to refetch.
		window.location.reload()
	}

	// The `space` a page passes for one course. The switcher wins over the
	// server's own guess (an open lesson in another space): a learner who picked
	// "Personal" expects the personal document. A course the chosen organization
	// does not hold gets no parameter — the server then falls back to the
	// personal space, where every course of the learner is.
	function paramFor(course?: string | null): string | undefined {
		if (!answer.value?.ok) return undefined
		if (!isOrganization.value) return PERSONAL
		return course && myCourseIds.value.includes(course)
			? current.value
			: undefined
	}

	// Where enrolling from the course page lands. The chosen organization, when
	// it opened the course — the enrolment is then its allocation and on its
	// bill; otherwise the personal space, where any published course may be
	// taken. The learner never meets `course_not_allowed` for a course the page
	// offered them.
	function enrolFor(course: string): string {
		return isOrganization.value && catalogIds.value.includes(course)
			? current.value
			: PERSONAL
	}

	return {
		spaces,
		current,
		currentSpace,
		hasOrganizations,
		isOrganization,
		myCourseIds,
		catalogIds,
		load,
		choose,
		paramFor,
		enrolFor,
	}
})
