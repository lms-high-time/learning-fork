import { describe, expect, it, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'

const streak = vi.hoisted(() => ({
	data: { current_streak: 3 } as { current_streak: number } | null,
}))

vi.mock('frappe-ui', () => ({
	call: () => Promise.resolve(0),
	createResource: ({ url }: { url: string }) => ({
		data: url.includes('streak') ? streak.data : [],
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
		const label = (await mountHome()).find('[data-testid="home-streak"]')

		expect(label.text()).toBe('Streak: 3')
		expect(label.classes()).not.toContain('bg-surface-amber-2')
	})

	it('stays out of the header until the streak is known', async () => {
		streak.data = null
		const label = (await mountHome()).find('[data-testid="home-streak"]')
		streak.data = { current_streak: 3 }

		expect(label.exists()).toBe(false)
	})
})
