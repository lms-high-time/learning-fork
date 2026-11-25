/**
 * The course page's tabs (learning-services#854): a course on the competency
 * catalog gets a «Skills» tab next to its overview, for every viewer — a
 * learner included, who saw no tabs before. A course without skills, or an
 * announced one to a viewer who is not enrolled in it and does not manage it,
 * keeps the learner's tab-less page. The page waits for the map before it
 * draws, so the overview is not drawn alone and then moved under tabs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, type PropType } from 'vue'
import type { DetailTab } from '@/components/Layouts/TabbedDetailPage.vue'

vi.stubGlobal('__', (text: string) => text)

const { passthrough, resources } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		passthrough: { template: `<div><slot /></div>` },
		resources: {} as Record<
			string,
			{ data: unknown; fetched: boolean; error: unknown }
		>,
	}
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))
vi.mock('@/stores/space', () => ({
	useSpace: () => ({
		load: () => Promise.resolve(),
		paramFor: () => 'personal',
	}),
}))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (opts: { url: string }) => {
			const resource = reactive({
				data: null as unknown,
				fetched: false,
				error: null as unknown,
				loading: false,
				reload: () => {},
				reset: () => {},
				fetch: () => Promise.resolve(),
			})
			resources[opts.url] = resource
			return resource
		},
		usePageMeta: () => {},
		toast: { success: () => {}, error: () => {} },
		Badge: passthrough,
		Button: passthrough,
		Dropdown: passthrough,
		Tooltip: passthrough,
	}
})

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: () => {} }),
	useOnboarding: () => ({ updateOnboardingStep: () => {} }),
}))

// The layout itself is tested in tabbedDetailPage.test.ts; here it only shows
// which tabs the page hands it, whether it is still loading, the header
// actions of the tab a page opens on, and the solo body a page without tabs
// gets.
vi.mock('@/components/Layouts/TabbedDetailPage.vue', async () => {
	const { defineComponent, h } = await import('vue')
	return {
		default: defineComponent({
			props: {
				tabs: { type: Array as PropType<DetailTab[]>, required: true },
				loading: Boolean,
			},
			setup(props, { slots }) {
				return () => {
					const visible = props.tabs.filter((tab) => tab.when ?? true)
					return h('div', [
						h(
							'div',
							{ 'data-testid': 'actions' },
							slots.actions?.({ tab: visible[0], instance: null })
						),
						h(
							'ul',
							{ 'data-testid': 'tabs', 'data-loading': String(props.loading) },
							visible.map((tab) =>
								h(
									'li',
									{
										'data-skills': JSON.stringify(
											(
												tab.props?.competencies as { key: string }[] | undefined
											)?.map((c) => c.key) ?? null
										),
									},
									tab.key
								)
							)
						),
						visible.length ? null : slots.solo?.(),
					])
				}
			},
		}),
	}
})

const { stub } = vi.hoisted(() => ({
	stub: (name: string) => ({
		default: { name, render: () => null },
	}),
}))
vi.mock('@/pages/Courses/CourseOverview.vue', () => stub('CourseOverview'))
vi.mock('@/pages/Courses/CourseSkills.vue', () => stub('CourseSkills'))
vi.mock('@/pages/Courses/CourseDashboard.vue', () => stub('CourseDashboard'))
vi.mock('@/pages/Courses/CourseEditor.vue', () => stub('CourseEditor'))
vi.mock('@/pages/Courses/CourseForm.vue', () => stub('CourseForm'))
vi.mock('@/components/SkeletonLoader.vue', () => stub('SkeletonLoader'))
vi.mock('@/components/LessonHelp.vue', () => stub('LessonHelp'))
vi.mock('@/components/ShortcutTooltip.vue', () => stub('ShortcutTooltip'))
vi.mock('@/components/HeaderButton.vue', () => stub('HeaderButton'))

import CourseDetail from '@/pages/Courses/CourseDetail.vue'

const skill = { key: 'k', kind: 'base', title: 'Умение' }

type Viewer = { name: string; is_moderator?: boolean }
const LEARNER: Viewer = { name: 'pupil@example.com' }
const AUTHOR: Viewer = { name: 'author@example.com' }

async function open({
	course = {},
	competencies = [skill],
	viewer = LEARNER,
	answer = true,
}: {
	course?: Record<string, unknown>
	competencies?: unknown[]
	viewer?: Viewer | null
	answer?: boolean | 'error'
} = {}) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/courses', name: 'Courses', component: { render: () => null } },
			// Not the page itself: its own router-view would draw a second one,
			// and the resources here would belong to that one.
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: { render: () => null },
			},
		],
	})
	await router.push('/courses/c-1')
	const Page = defineComponent({
		render: () => h(CourseDetail, { courseName: 'c-1' }),
	})
	const wrapper = mount(Page, {
		global: {
			plugins: [router],
			provide: { $user: { data: viewer } },
			mocks: { __: (text: string) => text },
		},
	})
	resources['lms.lms.utils.get_course_details'].data = {
		name: 'c-1',
		title: 'Курс',
		published: 1,
		upcoming: 0,
		membership: null,
		instructors: [{ name: AUTHOR.name }],
		...course,
	}
	await flushPromises()
	if (answer === 'error') {
		resources['lms_frappe_app.api.public.course_map'].error = new Error('x')
		await flushPromises()
	} else if (answer) {
		const map = resources['lms_frappe_app.api.public.course_map']
		map.data = { data: { chapters: [], documents: [], competencies } }
		map.fetched = true
		await flushPromises()
	}
	return wrapper
}

const tabKeys = (wrapper: Awaited<ReturnType<typeof open>>) =>
	wrapper.findAll('[data-testid="tabs"] li').map((li) => li.text())

beforeEach(() => {
	for (const key of Object.keys(resources)) delete resources[key]
})

describe('the course page tabs', () => {
	it('gives a learner the overview and the skills of a course that has them', async () => {
		const wrapper = await open()

		expect(tabKeys(wrapper)).toEqual(['overview', 'skills'])
		const skills = wrapper.findComponent({ name: 'CourseSkills' })
		// Rendered by the real layout; here the tab definition is what counts.
		expect(skills.exists()).toBe(false)
	})

	it('keeps the tab-less page for a course without skills', async () => {
		const wrapper = await open({ competencies: [] })

		expect(tabKeys(wrapper)).toEqual([])
		expect(wrapper.findComponent({ name: 'CourseOverview' }).exists()).toBe(
			true
		)
	})

	it('shows no skills for an announced course to a visitor', async () => {
		const wrapper = await open({ course: { upcoming: 1, published: 0 } })

		expect(tabKeys(wrapper)).toEqual([])
	})

	it('shows the skills of an announced course to its author', async () => {
		const wrapper = await open({
			course: { upcoming: 1, published: 0 },
			viewer: AUTHOR,
		})

		expect(tabKeys(wrapper)).toEqual([
			'overview',
			'skills',
			'dashboard',
			'editor',
			'settings',
		])
	})

	// The overview tab used to be an admin's only, and its header actions
	// relied on that; a learner with tabs must not get them.
	it("keeps the authoring actions off a learner's overview", async () => {
		const wrapper = await open()

		const actions = wrapper.get('[data-testid="actions"]').text()
		expect(actions).not.toContain('Author view')
		expect(actions).not.toContain('Course reports')
		expect(actions).not.toContain('Enroll')
	})

	it('still gives the author the actions on the overview', async () => {
		const wrapper = await open({ viewer: AUTHOR })

		const actions = wrapper.get('[data-testid="actions"]').text()
		expect(actions).toContain('Author view')
		expect(actions).toContain('Course reports')
		expect(actions).toContain('Enroll')
	})

	it("hands the skills tab the course's own skills", async () => {
		const wrapper = await open()

		expect(
			wrapper
				.get('[data-testid="tabs"] li:nth-child(2)')
				.attributes('data-skills')
		).toBe(JSON.stringify([skill.key]))
	})

	it('gives a guest the same tabs as a learner', async () => {
		const wrapper = await open({ viewer: null })

		expect(tabKeys(wrapper)).toEqual(['overview', 'skills'])
	})

	it('draws the overview when the map fails, not a skeleton for good', async () => {
		const wrapper = await open({ answer: 'error' })

		expect(tabKeys(wrapper)).toEqual([])
		expect(wrapper.findComponent({ name: 'CourseOverview' }).exists()).toBe(
			true
		)
	})

	// The admin's tabs do not depend on the map, nor do the editor and the
	// settings need it.
	it('does not keep an admin waiting for the map', async () => {
		const wrapper = await open({ viewer: AUTHOR, answer: false })

		expect(wrapper.get('[data-testid="tabs"]').attributes('data-loading')).toBe(
			'false'
		)
	})

	it('waits for the map before drawing the overview', async () => {
		const wrapper = await open({ answer: false })

		expect(wrapper.get('[data-testid="tabs"]').attributes('data-loading')).toBe(
			'true'
		)
		expect(wrapper.findComponent({ name: 'CourseOverview' }).exists()).toBe(
			false
		)
		expect(wrapper.findComponent({ name: 'SkeletonLoader' }).exists()).toBe(
			true
		)
	})
})
