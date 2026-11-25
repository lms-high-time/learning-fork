/**
 * The course's skills (learning-services#843) moved off the overview onto a
 * tab of their own (learning-services#854): the overview speaks of the task,
 * the document and the programme; the «Skills» tab lists the integrative
 * skills with their parts shown under each, then the base ones no integrative
 * skill takes in, under a heading of their own. Which viewers get the tab is
 * in courseSkillsTab.test.ts.
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

import { CourseOverviewHost } from './helpers/courseOverviewHost'
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
	mount(CourseOverviewHost, {
		props: {
			course: reactive({
				data: { name: 'course-1', title: 'Проекты', instructors: [] },
			}) as never,
		},
		global: {
			provide: { $user: { data: { name: 'a@b.c' } } },
			mocks: { __: (s: string) => s },
			stubs: {
				CourseDocumentCard: {
					template: '<section data-testid="course-documents" />',
				},
			},
		},
	})

afterEach(() => {
	mapData.value = null
	document.body.innerHTML = ''
})

describe('the overview of a course with skills', () => {
	it('lists no skills: they have a tab of their own', async () => {
		mapData.value = { data: program(competencies) }
		const wrapper = mountOverview()
		await flushPromises()

		expect(wrapper.find('[data-testid="course-competencies"]').exists()).toBe(
			false
		)
		expect(wrapper.text()).not.toContain('Запуск проекта')
		expect(wrapper.find('[data-testid="program"]').exists()).toBe(true)
	})

	it('puts the document in the main column, once, before the programme', async () => {
		mapData.value = { data: program(competencies) }
		const wrapper = mountOverview()
		await flushPromises()

		const documents = wrapper.findAll('[data-testid="course-documents"]')
		expect(documents).toHaveLength(1)
		expect(documents[0].element.closest('aside')).toBeNull()
		const program_ = wrapper.get('[data-testid="program"]')
		expect(
			documents[0].element.compareDocumentPosition(program_.element) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy()
	})
})

describe('CourseCompetencies, the «Skills» tab', () => {
	const mountBlock = (list: CourseCompetency[] = competencies) =>
		mount(CourseCompetencies, {
			props: { competencies: list },
			global: { mocks: { __: (s: string) => s } },
			attachTo: document.body,
		})

	it('says why the skills are there, and counts none of them', () => {
		const wrapper = mountBlock()

		expect(wrapper.get('p').text()).toBe(
			'The course checks these skills in your conversation with the agent instead of a test.'
		)
		expect(wrapper.text()).not.toMatch(/\d/)
	})

	it('lists the integrative ones with their parts shown, nothing to unfold', () => {
		const wrapper = mountBlock()

		const items = wrapper.findAll('[data-testid="course-competency"]')
		expect(items.map((item) => item.get('h2').text())).toEqual([
			'Запуск проекта',
		])
		expect(items[0].text()).toContain('Запускаете проект со спонсором и целью.')
		// A caption naming the list, not a heading repeated under every skill.
		const partsList = items[0].get('[data-testid="course-competency-parts"]')
		const caption = items[0].get(`#${partsList.attributes('aria-labelledby')}`)
		expect(caption.element.tagName).toBe('P')
		expect(caption.text()).toBe('What it is made of')
		expect(wrapper.find('button').exists()).toBe(false)
		const parts = wrapper.get('[data-testid="course-competency-parts"]')
		expect(parts.isVisible()).toBe(true)
		expect(
			parts
				.findAll('li')
				.map((li) => li.findAll('span').map((span) => span.text()))
		).toEqual([
			['Выбор спонсора', 'Описание: Выбор спонсора'],
			['Цель проекта', 'Описание: Цель проекта'],
		])
	})

	it('lists the base ones apart, under a heading of their own', () => {
		const wrapper = mountBlock()

		const standalone = wrapper.get('[data-testid="course-competencies-base"]')
		const heading = standalone.get('h2')
		expect(heading.text()).toBe('Other skills')
		expect(standalone.attributes('aria-labelledby')).toBe(
			heading.attributes('id')
		)
		expect(standalone.text()).toContain('Проект и операции')
		expect(standalone.text()).toContain('Описание: Проект и операции')
		expect(standalone.text()).not.toContain('Выбор спонсора')
		// Set apart from the last integrative one, or it reads as its part.
		expect(standalone.classes()).toContain('border-t')
	})

	it('needs no heading for the base ones when there is nothing else', () => {
		const wrapper = mountBlock([base('ops', 'Проект и операции')])

		const standalone = wrapper.get('[data-testid="course-competencies-base"]')
		expect(standalone.find('h2').exists()).toBe(false)
		expect(standalone.attributes('aria-labelledby')).toBeUndefined()
		expect(standalone.classes()).not.toContain('border-t')
		expect(standalone.text()).toContain('Проект и операции')
	})
})
