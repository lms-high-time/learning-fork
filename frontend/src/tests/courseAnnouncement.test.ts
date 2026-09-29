/**
 * An announced course (learning-services#389) on its page and in the catalog:
 * the page lists the course objectives in place of the programme and the
 * outline, and the catalog card says the course is in the works.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'

const mapData: { value: unknown } = { value: null }

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
	Tooltip: { template: '<span><slot /></span>' },
	createResource: (opts: { url: string }) =>
		reactive({
			...opts,
			data:
				opts.url === 'lms_frappe_app.api.public.course_map'
					? mapData.value
					: null,
			loading: false,
			fetch: vi.fn(() => Promise.resolve()),
			reload: vi.fn(),
		}),
}))
vi.mock('@/utils/', () => ({
	formatAmount: (a: unknown) => String(a),
	formatRating: (r: unknown) => String(r),
}))
vi.mock('@/utils', () => ({
	formatAmount: (a: unknown) => String(a),
	formatRating: (r: unknown) => String(r),
}))
vi.mock('@/utils/theme', () => ({ theme: { value: 'light' } }))
vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (h: string) => h,
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: null }),
}))
vi.mock('@/components/CourseCardOverlay.vue', () => ({
	default: { props: ['course', 'notify'], template: '<div data-testid="overlay" :data-notify="String(notify)" />' },
}))
vi.mock('@/components/CourseOutline.vue', () => ({
	default: { template: '<div data-testid="outline" />' },
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
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RelatedCourses.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/ProgressBar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseProgram/CourseProgram.vue', () => ({
	default: { template: '<div data-testid="program" />' },
}))

vi.stubGlobal('__', (s: string) => s)

import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import CourseCard from '@/components/CourseCard.vue'

const mountOverview = (course: Record<string, unknown>) =>
	mount(CourseOverview, {
		props: { course: reactive({ data: { instructors: [], ...course } }) },
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
			stubs: { CourseDocumentCard: true },
		},
	})

describe('CourseOverview of an announced course', () => {
	it('lists the course objectives in place of the programme', async () => {
		mapData.value = {
			data: {
				course: 'ops',
				title: 'Стыки',
				upcoming: true,
				notify: true,
				objectives: ['Описать процесс', 'Найти стыки'],
				chapters: [],
				documents: [],
			},
		}
		const wrapper = mountOverview({ name: 'ops', title: 'Стыки', upcoming: 1 })
		await flushPromises()

		const section = wrapper.get('[data-testid="course-announcement"]')
		expect(section.findAll('li').map((li) => li.text())).toEqual([
			'Описать процесс',
			'Найти стыки',
		])
		expect(wrapper.find('[data-testid="outline"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="program"]').exists()).toBe(false)
		expect(
			wrapper.findAll('[data-testid="overlay"]').map((o) => o.attributes('data-notify'))
		).toContain('true')
	})

	it('hides the outline before the map arrives', async () => {
		mapData.value = null
		const wrapper = mountOverview({ name: 'ops', title: 'Стыки', upcoming: 1 })
		await flushPromises()

		expect(wrapper.find('[data-testid="course-announcement"]').exists()).toBe(true)
		expect(wrapper.find('[data-testid="outline"]').exists()).toBe(false)
	})

	it('keeps the outline for the course author', async () => {
		mapData.value = null
		const wrapper = mountOverview({
			name: 'ops',
			title: 'Стыки',
			upcoming: 1,
			instructors: [{ name: 'a@b.c' }],
		})
		await flushPromises()

		expect(wrapper.find('[data-testid="course-announcement"]').exists()).toBe(false)
	})

	it('keeps the course as it was for a published course', async () => {
		mapData.value = null
		const wrapper = mountOverview({ name: 'p3', title: 'P3', upcoming: 0 })
		await flushPromises()

		expect(wrapper.find('[data-testid="course-announcement"]').exists()).toBe(false)
	})
})

describe('CourseCard of an announced course', () => {
	const mountCard = (course: Record<string, unknown>) =>
		shallowMount(CourseCard, {
			props: { course: { title: 'Стыки', instructors: [], ...course } },
			global: { mocks: { __: (s: string) => s } },
		})

	it('says the course is in the works', () => {
		expect(mountCard({ upcoming: 1 }).find('[data-testid="course-card-upcoming"]').exists()).toBe(true)
		expect(mountCard({ upcoming: 0 }).find('[data-testid="course-card-upcoming"]').exists()).toBe(false)
	})
})
