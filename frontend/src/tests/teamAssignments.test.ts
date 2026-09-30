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

const dialogs: {
	actions: { onClick: (a: { close: () => void }) => Promise<void> }[]
}[] = []
vi.mock('@/utils/dialogs', () => ({
	createDialog: (options: (typeof dialogs)[number]) => dialogs.push(options),
}))

import TeamAssignments from '@/components/Team/TeamAssignments.vue'
import {
	audienceText,
	type Allocation,
	type AllocationHomework,
	type TeamData,
} from '@/utils/team'

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

const mocks = {
	__: (t: string) =>
		Object.assign(new String(t), {
			format: (...args: unknown[]) =>
				t.replace(/\{(\d)\}/g, (_, i) => String(args[Number(i)])),
		}),
}

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

	it('unassigns after asking', async () => {
		const wrapper = mount(TeamAssignments, {
			props: { team },
			global: { mocks },
		})
		await flushPromises()

		await wrapper.find('[data-testid="unassign-ca-1"]').trigger('click')
		await flushPromises()
		expect(calls).toEqual([])

		await dialogs[dialogs.length - 1].actions[0].onClick({ close: () => {} })
		await flushPromises()
		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.remove_allocation',
			params: { allocation: 'ca-1' },
		})
	})
})

describe('homework deadlines in an assignment', () => {
	// The manager's rule for the group overrides the author's; «as the author»
	// is no rule at all (learning-services#452).
	const homework = (
		overrides: Partial<AllocationHomework> = {}
	): AllocationHomework => ({
		homework: 'hw-1',
		lesson: 'L1',
		lesson_title: 'Спонсор',
		title: 'Встреча со спонсором',
		author_due: { mode: 'relative', days: 5, date: null },
		due: null,
		...overrides,
	})

	const serve = (items: AllocationHomework[]) => {
		answers['lms_frappe_app.api.team.allocations'] = {
			ok: true,
			data: {
				allocations: [allocation({ homework: items })],
				courses: [{ id: 'c-1', title: 'P3' }],
			},
		}
	}

	const mountTab = async () => {
		const wrapper = mount(TeamAssignments, {
			props: { team },
			global: { mocks },
		})
		await flushPromises()
		return wrapper
	}

	const save = async (wrapper: Awaited<ReturnType<typeof mountTab>>) => {
		await wrapper.find('[data-testid="save-due-ca-1"]').trigger('click')
		await flushPromises()
		return calls[calls.length - 1]
	}

	it('lists the homework of the course with the rule in force', async () => {
		serve([
			homework(),
			homework({
				homework: 'hw-2',
				lesson_title: 'Устав',
				title: 'Устав проекта',
				author_due: { mode: 'none', days: null, date: null },
				due: { mode: 'absolute', days: null, date: '2030-02-01' },
			}),
		])
		const wrapper = await mountTab()
		const block = wrapper.find('[data-testid="homework-due-ca-1"]')
		expect(block.text()).toContain('Homework deadlines')
		const rows = block.findAll('[data-testid="homework-due-row"]')
		expect(rows).toHaveLength(2)
		expect(rows[0].text()).toContain('Встреча со спонсором')
		expect(rows[0].text()).toContain('Спонсор')
		expect(
			(block.find('[data-testid="due-mode-hw-1"]').element as HTMLInputElement)
				.value
		).toBe('author')
		expect(
			(block.find('[data-testid="due-mode-hw-2"]').element as HTMLInputElement)
				.value
		).toBe('absolute')
		expect(
			(block.find('[data-testid="due-date-hw-2"]').element as HTMLInputElement)
				.value
		).toBe('2030-02-01')
	})

	it("names the author's deadline in the choice that keeps it", async () => {
		serve([homework()])
		const wrapper = await mountTab()
		const select = wrapper.findComponent('[data-testid="due-mode-hw-1"]')
		expect(
			(select.props('options') as { label: string }[]).map((o) => o.label)
		).toEqual([
			'As the author: 5 days after the lesson',
			'Days after the lesson',
			'By a date',
		])
	})

	it('saves the rules of the whole assignment at once', async () => {
		serve([
			homework(),
			homework({ homework: 'hw-2', title: 'Устав проекта' }),
			homework({ homework: 'hw-3', title: 'Риски' }),
		])
		const wrapper = await mountTab()
		await wrapper.find('[data-testid="due-mode-hw-1"]').setValue('relative')
		await wrapper.find('[data-testid="due-days-hw-1"]').setValue('7')
		await wrapper.find('[data-testid="due-mode-hw-3"]').setValue('absolute')
		await wrapper.find('[data-testid="due-date-hw-3"]').setValue('2030-03-01')

		expect(await save(wrapper)).toEqual({
			method: 'lms_frappe_app.api.team.update_allocation',
			params: {
				allocation: 'ca-1',
				homework_due: [
					{ homework: 'hw-1', due_mode: 'relative', due_days: 7 },
					{ homework: 'hw-3', due_mode: 'absolute', due_date: '2030-03-01' },
				],
			},
		})
	})

	it("drops the rule when the author's deadline is chosen", async () => {
		serve([homework({ due: { mode: 'relative', days: 3, date: null } })])
		const wrapper = await mountTab()
		expect(
			(
				wrapper.find('[data-testid="due-days-hw-1"]')
					.element as HTMLInputElement
			).value
		).toBe('3')
		await wrapper.find('[data-testid="due-mode-hw-1"]').setValue('author')
		expect(await save(wrapper)).toEqual({
			method: 'lms_frappe_app.api.team.update_allocation',
			params: { allocation: 'ca-1', homework_due: [] },
		})
	})

	it('does not save a rule without its days or date', async () => {
		serve([homework()])
		const wrapper = await mountTab()
		await wrapper.find('[data-testid="due-mode-hw-1"]').setValue('absolute')
		const button = wrapper.find('[data-testid="save-due-ca-1"]')
		expect(button.attributes('disabled')).toBeDefined()
		await button.trigger('click')
		await flushPromises()
		expect(calls).toEqual([])
	})

	it('has no block for a course without homework', async () => {
		serve([])
		const wrapper = await mountTab()
		expect(wrapper.find('[data-testid="homework-due-ca-1"]').exists()).toBe(
			false
		)
	})
})
