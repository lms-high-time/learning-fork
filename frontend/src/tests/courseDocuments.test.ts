import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// learning-services#340: the course page and the lesson say what document
// they build, and a student goes straight to its block.

vi.mock('frappe-ui', () => ({
	Button: { props: ['label'], template: '<button>{{ label }}</button>' },
}))

import LessonBlocks from '@/components/Documents/LessonBlocks.vue'
import CourseDocumentCard from '@/components/CourseDocumentCard.vue'

const __ = (message: string) => {
	if (!/{\d+}/.test(message)) return message
	return {
		format: (...args: unknown[]) =>
			message.replace(/{(\d+)}/g, (m, n) =>
				args[Number(n)] === undefined ? m : String(args[Number(n)])
			),
	}
}

const RouterLink = {
	props: ['to'],
	template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
}
const global = {
	mocks: { __ },
	stubs: { 'router-link': RouterLink, ProgressBar: true },
}

beforeEach(() => {
	vi.stubGlobal('__', __)
})

const blocks = [
	{
		artifact: 'risk_register',
		key: 'assessment',
		title: 'Оценка',
		filled: true,
	},
	{
		artifact: 'risk_register',
		key: 'probability_scale',
		title: 'Шкала вероятности',
		filled: false,
	},
]

describe('LessonBlocks', () => {
	it('links a student to each block, marking the done ones', () => {
		const wrapper = mount(LessonBlocks, {
			props: { blocks, courseName: 'c1', linked: true },
			global,
		})
		const link = wrapper.get('[data-testid="lesson-block-assessment"]')
		expect(JSON.parse(link.attributes('data-to')!)).toEqual({
			name: 'Document',
			params: {
				courseName: 'c1',
				artifact: 'risk_register',
				view: 'assessment',
			},
		})
		expect(link.find('.lucide-circle-check').exists()).toBe(true)
		expect(
			wrapper
				.get('[data-testid="lesson-block-probability_scale"]')
				.find('.lucide-circle-check')
				.exists()
		).toBe(false)
	})

	it('names the blocks to a visitor without links', () => {
		const wrapper = mount(LessonBlocks, {
			props: {
				blocks: blocks.map(({ filled, ...b }) => b),
				courseName: 'c1',
				linked: false,
			},
			global,
		})
		expect(wrapper.find('a').exists()).toBe(false)
		expect(wrapper.text()).toContain('Оценка')
		expect(wrapper.text()).toContain('Into the document:')
	})
})

describe('CourseDocumentCard', () => {
	it('promises the document to a visitor', () => {
		const wrapper = mount(CourseDocumentCard, {
			props: {
				documents: [
					{ artifact: 'risk_register', title: 'Реестр рисков проекта' },
				],
				courseName: 'c1',
				enrolled: false,
			},
			global,
		})
		expect(wrapper.text()).toContain('You will build')
		expect(wrapper.find('a').exists()).toBe(false)
	})

	it('shows a student how far the document is and opens it', () => {
		const wrapper = mount(CourseDocumentCard, {
			props: {
				documents: [
					{
						artifact: 'risk_register',
						title: 'Реестр рисков проекта',
						blocks_total: 13,
						blocks_filled: 4,
					},
				],
				courseName: 'c1',
				enrolled: true,
			},
			global,
		})
		expect(wrapper.text()).toContain('Filled 4 of 13')
		expect(JSON.parse(wrapper.get('a').attributes('data-to')!)).toEqual({
			name: 'Document',
			params: { courseName: 'c1', artifact: 'risk_register' },
		})
	})

	it('draws nothing for a course without a document', () => {
		const wrapper = mount(CourseDocumentCard, {
			props: { documents: [], courseName: 'c1', enrolled: true },
			global,
		})
		expect(wrapper.find('[data-testid="course-documents"]').exists()).toBe(
			false
		)
	})
})
