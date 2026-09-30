import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeworkHistory from '@/components/Homework/HomeworkHistory.vue'
import HomeworkVersions from '@/components/Homework/HomeworkVersions.vue'
import type { HomeworkEvent, HomeworkVersion } from '@/utils/homework'

// The journal and the versions of a submission, shared by the lesson block
// and the tutor's card (learning-services#452).

const event = (overrides: Partial<HomeworkEvent> = {}): HomeworkEvent => ({
	event: 'submitted',
	by: 'student@x',
	by_name: 'Анна Ученица',
	at: '2030-01-11 12:00:00',
	version: 1,
	comment: null,
	due_at: null,
	...overrides,
})

const version = (n: number, answer: string): HomeworkVersion => ({
	version: n,
	saved_at: `2030-01-1${n} 12:00:00`,
	answer,
	files: [],
})

const mocks = { __: (globalThis as any).__ }

describe('HomeworkHistory', () => {
	it('names people, the reader as «You», with the comment', () => {
		const wrapper = mount(HomeworkHistory, {
			props: {
				history: [
					event(),
					event({
						event: 'reopened',
						by: null,
						by_name: 'Куратор',
						version: 1,
						comment: 'Нет подписи',
					}),
				],
				me: 'student@x',
			},
			global: { mocks },
		})
		expect(wrapper.find('summary').text()).toBe('History')
		const rows = wrapper.findAll('li').map((row) => row.text())
		expect(rows[0]).toContain('Submitted · You ·')
		expect(rows[0]).toContain('version 1')
		expect(rows[1]).toContain('Reopened · Куратор ·')
		expect(rows[1]).toContain('Нет подписи')
	})

	it('draws nothing without events', () => {
		const wrapper = mount(HomeworkHistory, {
			props: { history: [], me: null },
			global: { mocks },
		})
		expect(wrapper.find('details').exists()).toBe(false)
	})
})

describe('HomeworkVersions', () => {
	it('lists the versions newest first', () => {
		const wrapper = mount(HomeworkVersions, {
			props: { versions: [version(1, 'Первая'), version(2, 'Вторая')] },
			global: { mocks },
		})
		const titles = wrapper
			.findAll('details details > summary')
			.map((summary) => summary.text())
		expect(titles[0]).toContain('Version 2')
		expect(titles[1]).toContain('Version 1')
		expect(wrapper.text()).toContain('Вторая')
	})

	it('draws nothing without versions', () => {
		const wrapper = mount(HomeworkVersions, {
			props: { versions: [] },
			global: { mocks },
		})
		expect(wrapper.find('details').exists()).toBe(false)
	})
})
