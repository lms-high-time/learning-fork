/**
 * The page-size control of a list whose total arrives after the first render.
 *
 * The ListFooter stub keeps the one trait of frappe-ui's that matters here: it
 * copies its options once, when it is created (ListFooter.vue, `ref(props.options
 * .pageLengthOptions)`). That is what leaves an empty control behind if the page
 * supplies the options later and the footer is not re-created.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('frappe-ui', async () => {
	const { ref } = await import('vue')
	return {
		Button: { template: '<button><slot /></button>' },
		createResource: () => ({}),
		FormControl: { template: '<input />' },
		ListFooter: {
			props: ['modelValue', 'options'],
			setup: (props: { options: { pageLengthOptions: number[] } }) => ({
				copied: ref(props.options.pageLengthOptions),
			}),
			template: `<div>
				<slot name="left">
					<button v-for="n in copied" :key="n" role="radio">{{ n }}</button>
				</slot>
				<slot name="right" />
			</div>`,
		},
		toast: {},
	}
})
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))
vi.mock('@/components/Layouts/PageBody.vue', () => ({
	default: { template: '<main><slot /><slot name="footer" /></main>' },
}))
vi.mock('@/components/Layouts/EmptyStateLayout.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/ResponsiveListView.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/components/SkeletonLoader.vue', () => ({
	default: { template: '<div />' },
}))
vi.mock('@/utils/a11y', async () => {
	const { ref } = await import('vue')
	return { useLoadingAnnouncement: () => ref('') }
})

vi.stubGlobal('__', (s: string) => s)

import ListPage from '@/components/Layouts/ListPage.vue'

const mountPage = (pageLengthOptions: number[]) =>
	mount(ListPage, {
		props: { rows: [], title: 'Courses', pageLengthOptions },
		global: { mocks: { __: (s: string) => s } },
	})

const radios = (wrapper: ReturnType<typeof mountPage>) =>
	wrapper.findAll('[role="radio"]').length

describe('ListPage page-size control', () => {
	it('is absent while the page has no options to offer', () => {
		expect(radios(mountPage([]))).toBe(0)
	})

	it('offers every option once they arrive after the first render', async () => {
		const wrapper = mountPage([])

		await wrapper.setProps({ pageLengthOptions: [24, 60, 120] })
		await flushPromises()

		expect(radios(wrapper)).toBe(3)
	})
})
