import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

vi.mock('frappe-ui', () => ({
	Badge: { template: '<span><slot /></span>' },
	Tooltip: { template: '<div><slot /></div>' },
}))
vi.mock('@/utils', () => ({
	formatAmount: (n: number) => n,
	formatRating: (n: number) => n,
}))
vi.mock('@/stores/session', () => ({
	sessionStore: () => ({ user: null }),
}))
vi.mock('@/utils/theme', () => ({ theme: { value: 'light' } }))
vi.mock('@/components/CourseInstructors.vue', () => ({ default: {} }))
vi.mock('@/components/UserAvatar.vue', () => ({ default: {} }))
vi.mock('@/components/ProgressBar.vue', () => ({ default: {} }))

import CourseCard from '@/components/CourseCard.vue'

const mountCard = (course: Record<string, unknown>) =>
	shallowMount(CourseCard, {
		props: { course: { title: 'Стыки', instructors: [], ...course } },
		global: {
			mocks: { __: (s: string) => s },
			stubs: { Tooltip: { template: '<div><slot /></div>' } },
		},
	})

describe('CourseCard cover without an image', () => {
	it('is a title page: no gradient, the author color on its top edge', () => {
		const cover = mountCard({ card_gradient: 'Red' }).find('[style]')

		expect(cover.attributes('style')).toContain(
			'border-top-color: var(--red-400)'
		)
		expect(cover.attributes('style')).not.toContain('gradient')
	})

	it('names the course on the cover', () => {
		const wrapper = mountCard({})

		expect(wrapper.find('[data-testid="course-card-title"]').text()).toBe(
			'Стыки'
		)
	})
})

describe('CourseCard cover with an image', () => {
	it('keeps the image and leaves the title on the card body', () => {
		const wrapper = mountCard({ image: '/files/cover.png' })

		expect(wrapper.find('[style]').attributes('style')).toContain('cover.png')
		expect(wrapper.find('[data-testid="course-card-title"]').exists()).toBe(
			false
		)
	})
})

describe('CourseCard rating', () => {
	const rating = (value: unknown) =>
		mountCard({ lessons: 3, rating: value }).find(
			'[data-testid="course-card-rating"]'
		)

	it('is hidden until someone has rated the course', () => {
		expect(rating(0).exists()).toBe(false)
		expect(rating('0').exists()).toBe(false)
		expect(rating('0.0').exists()).toBe(false)
	})

	it('is shown once there are ratings', () => {
		expect(rating(4.5).exists()).toBe(true)
	})
})
