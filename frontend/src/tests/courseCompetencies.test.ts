/**
 * «What you'll learn» on the course page (learning-services#843): the
 * competencies of a course on the competency catalog, above its programme —
 * the integrative ones with their parts folded under each, then the base ones
 * no integrative one takes in. A course without them shows no block.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { CourseCompetency, ProgramData } from '@/utils/courseProgram'

const mapData: { value: unknown } = { value: null }

vi.mock('vue-router', () => ({
	useRoute: () => ({ query: {} }),
	useRouter: () => ({ replace: vi.fn() }),
}))

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
	call: vi.fn(() => Promise.resolve({ ok: true })),
	Badge: { template: '<span><slot /></span>' },
	createResource: (opts: { url: string }) =>
		reactive({
			...opts,
			data:
				opts.url === 'lms_frappe_app.api.public.course_map'
					? mapData.value
					: null,
			fetched: true,
			loading: false,
			fetch: vi.fn(() => Promise.resolve()),
			reload: vi.fn(),
		}),
}))
vi.mock('@/utils/', () => ({
	formatAmount: (a: unknown) => String(a),
	formatRating: (r: unknown) => String(r),
}))
vi.mock('@/utils/sanitizeRichHTML', () => ({
	sanitizeRichHTML: (h: string) => h,
}))
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
vi.mock('@/components/UserAvatar.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/RelatedCourses.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/CourseProgram/CourseChapters.vue', () => ({
	default: { template: '<section data-testid="program" />' },
}))

import CourseOverview from '@/pages/Courses/CourseOverview.vue'
import CourseCompetencies from '@/components/CourseProgram/CourseCompetencies.vue'

const base = (key: string, title: string): CourseCompetency => ({
	key,
	kind: 'base',
	title,
	description: `Описание: ${title}`,
})

const competencies: CourseCompetency[] = [
	{
		key: 'launch',
		kind: 'integrative',
		title: 'Запуск проекта',
		description: 'Запускаете проект со спонсором и целью.',
		parts: [base('sponsor', 'Выбор спонсора'), base('goal', 'Цель проекта')],
	},
	base('ops', 'Проект и операции'),
]

const program = (list: CourseCompetency[]): ProgramData => ({
	course: 'course-1',
	title: 'Проекты',
	documents: [],
	competencies: list,
	chapters: [
		{
			title: 'Запуск',
			lessons: [
				{ id: 'l-1', number: 1, title: 'Урок', hook: null, objectives: [] },
			],
		},
	],
})

const mountOverview = () =>
	mount(CourseOverview, {
		props: {
			course: reactive({
				data: { name: 'course-1', title: 'Проекты', instructors: [] },
			}),
		},
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
			stubs: { CourseDocumentCard: true },
		},
	})

afterEach(() => {
	mapData.value = null
	document.body.innerHTML = ''
})

describe('CourseOverview «What you\'ll learn»', () => {
	it('shows the block above the programme when the course has competencies', async () => {
		mapData.value = { data: program(competencies) }
		const wrapper = mountOverview()
		await flushPromises()

		const block = wrapper.get('[data-testid="course-competencies"]')
		expect(block.get('h2').text()).toBe("What you'll learn")
		const program_ = wrapper.get('[data-testid="program"]')
		// Above the programme: the block comes first in the document.
		expect(
			block.element.compareDocumentPosition(program_.element) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy()
	})

	it('shows no block for a course without competencies', async () => {
		mapData.value = { data: program([]) }
		const wrapper = mountOverview()
		await flushPromises()

		expect(wrapper.find('[data-testid="course-competencies"]').exists()).toBe(
			false
		)
		expect(wrapper.find('[data-testid="program"]').exists()).toBe(true)
	})
})

describe('CourseCompetencies', () => {
	const mountBlock = () =>
		mount(CourseCompetencies, {
			props: { competencies },
			global: { mocks: { __: (s: string) => s } },
			attachTo: document.body,
		})

	it('lists the integrative ones, then the base ones on their own', () => {
		const wrapper = mountBlock()

		const items = wrapper.findAll('[data-testid="course-competency"]')
		expect(items.map((item) => item.get('h3').text())).toEqual([
			'Запуск проекта',
		])
		expect(items[0].text()).toContain('Запускаете проект со спонсором и целью.')
		const standalone = wrapper.get('[data-testid="course-competencies-base"]')
		expect(standalone.text()).toContain('Проект и операции')
		expect(standalone.text()).toContain('Описание: Проект и операции')
		expect(standalone.text()).not.toContain('Выбор спонсора')
		// Set apart from the last integrative one, or it reads as its part.
		expect(standalone.classes()).toContain('border-t')
	})

	it('folds the parts under a button that says whether they are shown', async () => {
		const wrapper = mountBlock()
		const toggle = wrapper.get('[data-testid="course-competency-toggle"]')
		const parts = wrapper.get('[data-testid="course-competency-parts"]')

		expect(toggle.element.tagName).toBe('BUTTON')
		expect(toggle.attributes('type')).toBe('button')
		expect(toggle.attributes('aria-controls')).toBe(parts.attributes('id'))
		// Every toggle reads the same: its competency's title tells them apart.
		expect(
			wrapper.get(`#${toggle.attributes('aria-describedby')}`).text()
		).toBe('Запуск проекта')
		expect(toggle.attributes('aria-expanded')).toBe('false')
		expect(parts.isVisible()).toBe(false)

		await toggle.trigger('click')

		expect(toggle.attributes('aria-expanded')).toBe('true')
		expect(parts.isVisible()).toBe(true)
		expect(
			parts
				.findAll('li')
				.map((li) => li.findAll('span').map((span) => span.text()))
		).toEqual([
			['Выбор спонсора', 'Описание: Выбор спонсора'],
			['Цель проекта', 'Описание: Цель проекта'],
		])

		await toggle.trigger('click')

		expect(toggle.attributes('aria-expanded')).toBe('false')
		expect(parts.isVisible()).toBe(false)
	})
})
