import { describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	call: () => Promise.resolve(0),
	createResource: ({ url }: { url: string }) => ({
		data: url.includes('streak') ? { current_streak: 3 } : [],
		loading: false,
	}),
	LoadingIndicator: {},
	usePageMeta: () => {},
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ brand: {} }),
}))
vi.mock('@/pages/Home/StudentHome.vue', () => ({ default: {} }))
vi.mock('@/pages/Home/AdminHome.vue', () => ({ default: {} }))
vi.mock('@/pages/Home/Streak.vue', () => ({ default: {} }))

import Home from '@/pages/Home/Home.vue'

const mountHome = async () => {
	const wrapper = shallowMount(Home, {
		global: {
			mocks: {
				__: (s: string) => ({
					format: (v: unknown) => s.replace('{0}', String(v)),
					toString: () => s,
				}),
			},
			provide: {
				$user: { data: { full_name: 'Анна', name: 'anna@example.com' } },
				$dayjs: () => ({ format: () => '2026-11-09' }),
			},
		},
	})
	await flushPromises()
	return wrapper
}

describe('Home header', () => {
	it('names the screen instead of greeting the student', async () => {
		const wrapper = await mountHome()

		expect(wrapper.find('h1').text()).toBe('Home')
		expect(wrapper.text()).not.toContain('Анна')
	})

	it('shows the streak as a quiet label without an emoji', async () => {
		const streak = (await mountHome()).find('[data-testid="home-streak"]')

		expect(streak.text()).toBe('Streak: 3')
		expect(streak.classes()).not.toContain('bg-surface-amber-2')
	})
})
