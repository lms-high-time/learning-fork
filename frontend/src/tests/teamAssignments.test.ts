import { describe, expect, it, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// A manager's assignments on «Команда» (learning-services#365).

const answers: Record<string, unknown> = {}
const calls: { method: string; params: Record<string, unknown> }[] = []

vi.mock('frappe-ui', () => ({
	createResource: ({ url }: { url: string }) => {
		const resource = reactive({
			data: null as unknown,
			reload: vi.fn(async () => {
				resource.data = answers[url] ?? null
			}),
		})
		return resource
	},
	call: vi.fn(async (method: string, params: Record<string, unknown>) => {
		calls.push({ method, params })
		return { ok: true, data: {} }
	}),
	toast: { error: vi.fn(), success: vi.fn() },
	Button: {
		props: ['loading', 'variant', 'disabled', 'type'],
		template:
			'<button :type="type || \'button\'" :disabled="disabled"><slot /></button>',
	},
	FormControl: {
		props: ['modelValue', 'options', 'type', 'label'],
		emits: ['update:modelValue'],
		template:
			'<input :data-type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
}))

import TeamAssignments from '@/components/Team/TeamAssignments.vue'
import { audienceText, type Allocation, type TeamData } from '@/utils/team'

const team: TeamData = {
	organization: 'org-1',
	title: 'Кофейни',
	can_see_report: true,
	can_manage: true,
	can_change_roles: false,
	members: [
		{
			user: 'a@x',
			full_name: 'Анна',
			role: 'Member',
			left: false,
			left_on: null,
		},
		{
			user: 'b@x',
			full_name: 'Борис',
			role: 'Member',
			left: true,
			left_on: '2026-09-01',
		},
	],
	courses: [],
}

const allocation = (overrides: Partial<Allocation> = {}): Allocation => ({
	id: 'ca-1',
	course: 'c-1',
	title: 'P3',
	whole_team: true,
	members: [],
	deadline: '2030-01-01',
	mandatory: true,
	chosen_by_member: false,
	...overrides,
})

const mocks = { __: (t: string) => t }

beforeEach(() => {
	calls.length = 0
	answers['lms_frappe_app.api.team.allocations'] = {
		ok: true,
		data: {
			allocations: [allocation()],
			courses: [{ id: 'c-1', title: 'P3' }],
		},
	}
})

describe('who an assignment is for', () => {
	it('names the team, the people, or a course taken by oneself', () => {
		const names = { 'a@x': 'Анна' }
		expect(audienceText(allocation(), names)).toBe('The whole team')
		expect(
			audienceText(allocation({ whole_team: false, members: ['a@x'] }), names)
		).toBe('Анна')
		expect(audienceText(allocation({ chosen_by_member: true }), names)).toBe(
			'Taken by the member from the catalog'
		)
	})
})

describe('the assignments tab', () => {
	it('assigns a course to the whole team with a deadline', async () => {
		const wrapper = mount(TeamAssignments, {
			props: { team },
			global: { mocks },
		})
		await flushPromises()

		const [course, date] = wrapper.findAll('input[data-type]')
		await course.setValue('c-1')
		await date.setValue('2030-03-01')
		await wrapper.find('[data-testid="assign-form"]').trigger('submit')
		await flushPromises()

		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.assign_course',
			params: {
				organization: 'org-1',
				course: 'c-1',
				members: [],
				deadline: '2030-03-01',
				mandatory: 0,
			},
		})
	})

	it('offers only current members to pick', async () => {
		const wrapper = mount(TeamAssignments, {
			props: { team },
			global: { mocks },
		})
		await flushPromises()
		await wrapper.find('[data-testid="whole-team"]').setValue(false)

		expect(wrapper.text()).toContain('Анна')
		expect(wrapper.text()).not.toContain('Борис')
	})

	it('unassigns', async () => {
		const wrapper = mount(TeamAssignments, {
			props: { team },
			global: { mocks },
		})
		await flushPromises()

		await wrapper.find('[data-testid="unassign-ca-1"]').trigger('click')
		await flushPromises()

		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.remove_allocation',
			params: { allocation: 'ca-1' },
		})
	})
})
