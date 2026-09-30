import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// «Awaiting review» (learning-services#452): the submissions a tutor may
// review, oldest first, with the filters the server offers.

vi.mock('frappe-ui', async () => {
	const { fakeResource } = await import('./helpers/fakeResource')
	return {
		createResource: fakeResource,
		toast: { error: vi.fn(), success: vi.fn() },
		LoadingIndicator: { template: '<span />' },
		FormControl: {
			props: ['modelValue', 'options', 'type', 'label'],
			emits: ['update:modelValue'],
			template: `<select :data-label="label" :value="modelValue"
			@change="$emit('update:modelValue', $event.target.value)">
			<option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
		</select>`,
		},
	}
})

// The filters are the address's (learning-services#452).
const route = reactive({ query: {} as Record<string, string> })
const router = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => router,
}))

import { hold, server } from './helpers/fakeResource'
import HomeworkQueue from '@/components/Homework/HomeworkQueue.vue'
import type { QueueData, QueueRow } from '@/utils/homework'

const URL = 'lms_frappe_app.api.review.queue'

const row = (overrides: Partial<QueueRow> = {}): QueueRow => ({
	id: 'HS-1',
	status: 'Submitted',
	student: { name: 'Анна Ученица' },
	course: 'c-1',
	course_title: 'Проектный менеджмент',
	lesson: 'L1',
	lesson_title: 'Спонсор',
	title: 'Встреча со спонсором',
	organization: 'org-1',
	organization_title: 'Кофейни',
	submitted_at: '2030-01-12 12:00:00',
	version: 2,
	reviewed_version: 1,
	due_at: '2030-01-15 23:59:59',
	overdue: false,
	...overrides,
})

const serve = (data: Partial<QueueData> = {}) => {
	server.answers[URL] = {
		ok: true,
		data: {
			items: [row()],
			total: 1,
			courses: [
				{ id: 'c-1', title: 'Проектный менеджмент' },
				{ id: 'c-2', title: 'Продажи' },
			],
			organizations: [
				{ id: 'org-1', title: 'Кофейни' },
				{ id: 'personal', title: 'Личное' },
			],
			...data,
		},
	}
}

const open = async () => {
	const wrapper = mount(HomeworkQueue, {
		global: {
			mocks: { __: (globalThis as any).__ },
			stubs: {
				'router-link': {
					props: ['to'],
					template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
				},
			},
		},
	})
	await flushPromises()
	return wrapper
}

const select = (wrapper: Awaited<ReturnType<typeof open>>, label: string) =>
	wrapper.find(`select[data-label="${label}"]`)

// The route is shared: a component left mounted would follow it.
enableAutoUnmount(afterEach)

beforeEach(() => {
	server.clear()
	route.query = {}
	router.replace.mockReset()
	router.replace.mockImplementation(({ query }) => (route.query = query))
})

describe('HomeworkQueue', () => {
	it('asks for the submitted ones first', async () => {
		serve()
		await open()
		expect(server.fetched).toEqual([
			{ url: URL, params: { status: 'Submitted' } },
		])
	})

	it('shows who, what and when, and leads to the card', async () => {
		serve({
			items: [
				row(),
				row({
					id: 'HS-2',
					student: { name: 'boris@x' },
					organization: 'personal',
					organization_title: 'Личное',
					overdue: true,
				}),
			],
			total: 2,
		})
		const wrapper = await open()
		const rows = wrapper.findAll('[data-testid="queue-row"]')
		expect(rows).toHaveLength(2)
		const first = rows[0].text()
		expect(first).toContain('Анна Ученица')
		expect(first).toContain('Проектный менеджмент · Спонсор')
		expect(first).toContain('Встреча со спонсором')
		expect(first).toContain('Кофейни')
		expect(first).toContain('Submitted 12 января 2030 г., 12:00')
		expect(first).toContain('Version 2')
		expect(first).not.toContain('Overdue')
		expect(rows[1].text()).toContain('Личное')
		expect(rows[1].text()).toContain('Overdue')
		expect(JSON.parse(rows[0].find('a').attributes('data-to')!)).toEqual({
			name: 'Homework',
			query: { tab: 'queue', submission: 'HS-1' },
		})
	})

	it('filters by course, organization and status', async () => {
		serve()
		const wrapper = await open()
		expect(
			select(wrapper, 'Organization')
				.findAll('option')
				.map((o) => o.text())
		).toEqual(['All organizations', 'Кофейни', 'Личное'])

		await select(wrapper, 'Course').setValue('c-2')
		await flushPromises()
		await select(wrapper, 'Organization').setValue('personal')
		await flushPromises()
		await select(wrapper, 'Status').setValue('Accepted')
		await flushPromises()

		expect(server.fetched[server.fetched.length - 1].params).toEqual({
			status: 'Accepted',
			course: 'c-2',
			organization: 'personal',
		})
		expect(route.query).toEqual({
			tab: 'queue',
			status: 'Accepted',
			course: 'c-2',
			organization: 'personal',
		})
		// A card opened now leads back to this list.
		expect(
			JSON.parse(
				wrapper.find('[data-testid="queue-row"] a').attributes('data-to')!
			)
		).toEqual({
			name: 'Homework',
			query: {
				tab: 'queue',
				status: 'Accepted',
				course: 'c-2',
				organization: 'personal',
				submission: 'HS-1',
			},
		})
	})

	it('opens with the filters of the address', async () => {
		serve()
		route.query = { tab: 'queue', status: 'Returned', course: 'c-1' }
		const wrapper = await open()
		expect(server.fetched).toEqual([
			{ url: URL, params: { status: 'Returned', course: 'c-1' } },
		])
		expect((select(wrapper, 'Status').element as HTMLSelectElement).value).toBe(
			'Returned'
		)
	})

	it('says how many are shown when there are more', async () => {
		serve({ items: [row()], total: 120 })
		const wrapper = await open()
		expect(wrapper.find('[data-testid="queue-total"]').text()).toBe(
			'Showing 1 of 120'
		)
		serve({ items: [row()], total: 1 })
		expect((await open()).find('[data-testid="queue-total"]').exists()).toBe(
			false
		)
	})

	it('says when nothing awaits review', async () => {
		serve({ items: [], total: 0 })
		const wrapper = await open()
		expect(wrapper.find('[data-testid="queue-empty"]').text()).toContain(
			'Nothing awaits review'
		)
	})

	it('says what the server refused, and stops waiting on a failure', async () => {
		server.answers[URL] = {
			ok: false,
			error: { code: 'x', message: 'Нельзя' },
		}
		expect((await open()).find('[data-testid="queue-error"]').text()).toBe(
			'Нельзя'
		)
		server.failures[URL] = { error: new Error('502') }
		const wrapper = await open()
		expect(wrapper.find('[data-testid="queue-loading"]').exists()).toBe(false)
		expect(wrapper.find('[data-testid="queue-error"]').text()).toBe(
			'Could not load the queue'
		)
	})

	it('shows the answer to the last filters, not to a slower earlier read', async () => {
		serve()
		const wrapper = await open()
		const slow = hold(URL)
		await select(wrapper, 'Course').setValue('c-2')
		await flushPromises()

		serve({ items: [row({ id: 'HS-9', title: 'Отчёт' })], total: 1 })
		const fast = hold(URL)
		await select(wrapper, 'Status').setValue('Accepted')
		await flushPromises()
		fast.release()
		await flushPromises()
		slow.release()
		await flushPromises()

		const rows = wrapper.findAll('[data-testid="queue-row"]')
		expect(rows).toHaveLength(1)
		expect(rows[0].text()).toContain('Отчёт')
		expect(wrapper.find('[data-testid="queue-loading"]').exists()).toBe(false)
	})
})
