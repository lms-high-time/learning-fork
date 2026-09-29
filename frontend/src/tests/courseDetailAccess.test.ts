import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

vi.stubGlobal('__', (text: string) => text)

// learning-services#393: a course not yet published sends a visitor back to
// the catalog, but not someone enrolled in it — the tester the author let in.

const { passthrough, courseResource } = vi.hoisted(() => {
	window.matchMedia ??= (() => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia
	return {
		passthrough: { template: `<div><slot /></div>` },
		courseResource: { current: null as null | { data: unknown } },
	}
})

vi.mock('@/stores/settings', () => ({ useSettings: () => ({}) }))
vi.mock('@/stores/user', () => ({ usersStore: () => ({ userResource: {} }) }))
vi.mock('@/stores/session', () => ({ sessionStore: () => ({ brand: {} }) }))

vi.mock('frappe-ui', async () => {
	const { reactive } = await import('vue')
	return {
		createResource: (opts: { url: string }) => {
			const resource = reactive({ data: null, loading: false, reload: () => {} })
			if (opts.url === 'lms.lms.utils.get_course_details') courseResource.current = resource
			return resource
		},
		usePageMeta: () => {},
		toast: { success: () => {}, error: () => {} },
		Badge: passthrough,
		Button: passthrough,
		Dropdown: passthrough,
		Tooltip: passthrough,
		Tabs: passthrough,
	}
})

vi.mock('frappe-ui/frappe', () => ({
	useTelemetry: () => ({ capture: () => {} }),
	useOnboarding: () => ({ updateOnboardingStep: () => {} }),
}))

const { stub } = vi.hoisted(() => ({
	stub: () => ({ default: { render: () => null } }),
}))
vi.mock('@/components/Layouts/TabbedDetailPage.vue', stub)
vi.mock('@/components/ShortcutTooltip.vue', stub)

import CourseDetail from '@/pages/Courses/CourseDetail.vue'

async function open(course: Record<string, unknown>) {
	const Catalog = defineComponent({ render: () => h('div', 'CATALOG') })
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/courses', name: 'Courses', component: Catalog },
			{
				path: '/courses/:courseName',
				name: 'CourseDetail',
				component: CourseDetail,
				props: true,
			},
		],
	})
	await router.push('/courses/draft')
	mount(CourseDetail, {
		props: { courseName: 'draft' },
		shallow: true,
		global: {
			plugins: [router],
			provide: { $user: { data: { name: 'pupil@example.com' } } },
			mocks: { __: (text: string) => text },
		},
	})
	courseResource.current!.data = { name: 'draft', instructors: [], ...course }
	await flushPromises()
	return router.currentRoute.value.name
}

describe('an unpublished course page', () => {
	it('sends a visitor back to the catalog', async () => {
		expect(await open({ published: 0, upcoming: 0, membership: null })).toBe('Courses')
	})

	it('sends back someone the server shows nothing, a revoked tester', async () => {
		expect(await open({ name: undefined, instructors: undefined })).toBe('Courses')
	})

	it('stays open to a tester enrolled in it', async () => {
		expect(
			await open({ published: 0, upcoming: 0, membership: { name: 'enr-1' } })
		).toBe('CourseDetail')
	})
})
