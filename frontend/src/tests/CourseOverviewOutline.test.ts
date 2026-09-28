/**
 * CourseOverview.vue: outline fetch timing.
 *
 * The outline resource used to be `auto: true`, so on a cold load it fired
 * while the parent's course resource was still in flight. `course.data?.name`
 * was undefined, JSON.stringify dropped the key, and the server raised
 * TypeError (missing required arg `course`) → 500. Nothing re-fired the
 * resource, so `hasCourseContent` stayed false and the page rendered
 * "Course Content coming soon!" forever. Navigating away and back masked it:
 * the course resource was cached by then, so the first call had a real name.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import CourseOverview from '@/pages/Courses/CourseOverview.vue'

type ResourceOpts = {
	url: string
	auto?: boolean
	cache?: unknown
	makeParams?: () => Record<string, unknown>
}

// Every createResource() call in the component lands here so the test can assert
// what fired, when, and with which params.
const resources: Array<
	ResourceOpts & {
		fetch: ReturnType<typeof vi.fn>
		reload: ReturnType<typeof vi.fn>
	}
> = []

// The learner's space (learning-services#347): a personal space with no
// organization, which is Learning as it was before spaces.
vi.mock('@/stores/space', () => ({
	PERSONAL: 'personal',
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
		enrolFor: () => 'personal',
		isOrganization: false,
		hasOrganizations: false,
		current: 'personal',
		spaces: [],
		myCourseIds: [],
		catalogIds: [],
	}),
}))

vi.mock('frappe-ui', () => ({
	Badge: { template: '<span><slot /></span>' },
	createResource: (opts: ResourceOpts) => {
		const resource = {
			...opts,
			data: null,
			loading: false,
			// The real fetch() returns a promise; a double that returns undefined
			// hides every mistake in how its result is handled.
			fetch: vi.fn(() => Promise.resolve()),
			reload: vi.fn(),
		}
		resources.push(resource)
		return resource
	},
}))
vi.mock('@/utils/', () => ({
	formatAmount: (a: unknown) => String(a),
	formatRating: (r: unknown) => String(r),
}))
vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (h: string) => h,
}))

// shallowMount still *imports* every child; some pull in frappe-ui deep paths
// that don't resolve under vitest. Stub them at the module level. (vi.mock is
// hoisted, so each factory has to be inline.)
vi.mock('@/components/CourseCardOverlay.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseOutline.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/SkeletonLoader.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseReviews.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseInstructors.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseCreatorCard.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RelatedCourses.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseProgram/CourseProgram.vue', () => ({
	default: { template: '<div />' },
}))

vi.stubGlobal('__', (s: string) => s)

const outlineResource = () =>
	resources.find((r) => r.url === 'lms.lms.utils.get_course_outline')!

// Mirrors the real parent: `data` is null until the course request resolves.
const mountOverview = (course: { data: { name: string } | null }) =>
	shallowMount(CourseOverview, {
		props: { course },
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
		},
	})

beforeEach(() => {
	resources.length = 0
})

describe('CourseOverview outline resource', () => {
	it('does not fire while the parent course resource is still loading', () => {
		mountOverview(reactive({ data: null }))

		const outline = outlineResource()
		expect(outline.auto).toBe(false)
		expect(outline.fetch).not.toHaveBeenCalled()
	})

	it('fires once the course name arrives, with the real course in params', async () => {
		const course = reactive<{ data: { name: string } | null }>({ data: null })
		mountOverview(course)

		course.data = { name: 'COURSE-1' }
		await nextTick()

		const outline = outlineResource()
		expect(outline.fetch).toHaveBeenCalledTimes(1)
		expect(outline.makeParams!()).toEqual({
			course: 'COURSE-1',
			progress: false,
		})
	})

	it('fires immediately when the course is already cached at mount', () => {
		mountOverview(reactive({ data: { name: 'COURSE-1' } }))

		expect(outlineResource().fetch).toHaveBeenCalledTimes(1)
	})

	// A `cache` key would be snapshotted at setup (undefined on a cold load),
	// and frappe-ui shares one instance per key, so a fixed key here leaks one
	// course's outline into another. The resource must be created without one.
	it('does not register a global cache key', () => {
		mountOverview(reactive({ data: null }))

		expect(outlineResource().cache).toBeUndefined()
	})
})

describe('CourseOverview course map resource', () => {
	// The map comes from our own app, not from Learning: it is the only place
	// the page can get objectives and their coverage, and a guest is allowed to
	// see it. It must follow the same timing rule as the outline — firing with
	// an undefined course name is what produced the 500 this suite exists for.
	const mapResource = () =>
		resources.find((r) => r.url === 'lms_frappe_app.api.public.course_map')!

	it('does not fire while the parent course resource is still loading', () => {
		mountOverview(reactive({ data: null }))

		const map = mapResource()
		expect(map.auto).toBe(false)
		expect(map.fetch).not.toHaveBeenCalled()
	})

	it('fires once the course name arrives, with the real course in params', async () => {
		const course = reactive<{ data: { name: string } | null }>({ data: null })
		mountOverview(course)

		course.data = { name: 'COURSE-1' }
		await nextTick()

		await flushPromises()
		const map = mapResource()
		expect(map.fetch).toHaveBeenCalledTimes(1)
		// The documents' fill is the chosen space's (learning-services#347).
		expect(map.makeParams!()).toEqual({ course: 'COURSE-1', space: 'personal' })
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
		mountOverview(course)

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
		mountOverview(reactive({ data: null }))

		expect(mapResource().method).toBe('GET')
	})
})
