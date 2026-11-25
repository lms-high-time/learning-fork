/**
 * useCourseMap: the course page's map request and its timing.
 *
 * The map comes from our own app, not from Learning: it is the only place the
 * page can get objectives and their coverage, its documents and its skills,
 * and a guest is allowed to see it. The page asks for it once and hands it to
 * the overview and the tabs (learning-services#854). It must follow the same
 * timing rule as the outline — firing with an undefined course name is what
 * produced the 500 the overview's outline tests exist for.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useCourseMap } from '@/composables/useCourseMap'

type ResourceOpts = {
	url: string
	method?: string
	auto?: boolean
	makeParams?: () => Record<string, unknown>
}

const resources: Array<
	ResourceOpts & {
		fetch: ReturnType<typeof vi.fn>
		reset: ReturnType<typeof vi.fn>
		fetched: boolean
		error: unknown
	}
> = []

// The learner's space (learning-services#347): a personal space with no
// organization, which is Learning as it was before spaces.
vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
	}),
}))

vi.mock('frappe-ui', () => ({
	createResource: (opts: ResourceOpts) => {
		const resource = reactive({
			...opts,
			data: null,
			fetched: false,
			error: null as unknown,
			// The real fetch() returns a promise; a double that returns undefined
			// hides every mistake in how its result is handled.
			fetch: vi.fn(() => Promise.resolve()),
			reset: vi.fn(),
		})
		resources.push(resource)
		return resource
	},
}))

const mapResource = () =>
	resources.find((r) => r.url === 'lms_frappe_app.api.public.course_map')!

// Mirrors the real page: `data` is null until the course request resolves.
const useMap = (course: { data: { name: string } | null }) =>
	effectScope().run(() => useCourseMap(() => course.data?.name))!

beforeEach(() => {
	resources.length = 0
})

describe('useCourseMap', () => {
	it('does not fire while the course is still loading', () => {
		useMap(reactive({ data: null }))

		const map = mapResource()
		expect(map.auto).toBe(false)
		expect(map.fetch).not.toHaveBeenCalled()
	})

	it('fires once the course name arrives, with the real course in params', async () => {
		const course = reactive<{ data: { name: string } | null }>({ data: null })
		useMap(course)

		course.data = { name: 'COURSE-1' }
		await nextTick()
		await flushPromises()

		const map = mapResource()
		expect(map.fetch).toHaveBeenCalledTimes(1)
		// The documents' fill is the chosen space's (learning-services#347).
		expect(map.makeParams!()).toEqual({ course: 'COURSE-1', space: 'personal' })
	})

	it("drops the previous course's map when the page moves to another", async () => {
		// The page is reused from course to course (learning-services#636).
		const course = reactive<{ data: { name: string } | null }>({
			data: { name: 'COURSE-1' },
		})
		useMap(course)
		await flushPromises()

		course.data = { name: 'COURSE-2' }
		await nextTick()
		await flushPromises()

		const map = mapResource()
		expect(map.reset).toHaveBeenCalledTimes(2)
		expect(map.fetch).toHaveBeenCalledTimes(2)
	})

	it('handles a failing request, because the app it calls may not be installed', async () => {
		// frappe-ui's createResource rethrows in handleError unconditionally, so
		// whatever fetch() returns has to be handled here. On a Learning site
		// without lms_frappe_app the server answers AppNotInstalledError, and
		// that unhandled rejection took down three Cypress specs — every one
		// that opens a course page. A site without our app must show no map,
		// quietly.
		//
		// The fetch runs after the space is loaded, inside a promise chain, so
		// the failure arrives as a rejection of that chain. Left unhandled,
		// vitest reports it and fails this test on its own.
		const course = reactive<{ data: { name: string } | null }>({ data: null })
		useMap(course)

		const map = mapResource()
		map.fetch.mockImplementationOnce(() =>
			Promise.reject(new Error('AppNotInstalledError'))
		)

		course.data = { name: 'COURSE-1' }
		await flushPromises()

		expect(map.fetch).toHaveBeenCalledTimes(1)
	})

	it('asks over GET, which is the only verb the endpoint answers', () => {
		// The whitelist on the server side is GET-only, and createResource
		// defaults to POST: the stand answered 403 to every request until this
		// was set. Server tests call the function directly and these tests mock
		// the resource, so nothing else covers the verb between them.
		useMap(reactive({ data: null }))

		expect(mapResource().method).toBe('GET')
	})

	it('is settled once the map answers, or fails to', () => {
		// The page holds the overview back until then: the answer decides
		// whether there are tabs (learning-services#854).
		const { mapSettled } = useMap(reactive({ data: null }))
		const map = mapResource()

		expect(mapSettled.value).toBe(false)
		map.error = new Error('AppNotInstalledError')
		expect(mapSettled.value).toBe(true)
		map.error = null
		map.fetched = true
		expect(mapSettled.value).toBe(true)
	})
})
