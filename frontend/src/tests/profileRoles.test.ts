import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// The roles tab of a profile: each switch reflects the role the server
// reports and saves its own role (lms-high-time/learning-services#693).

const { call, toast, resources } = vi.hoisted(() => ({
	call: vi.fn(),
	toast: { success: vi.fn() },
	resources: [] as any[],
}))

vi.mock('frappe-ui', () => ({
	call,
	toast,
	createResource: (options: any) => {
		const resource = {
			reload: (params: any) => {
				options.makeParams?.(params)
				options.onSuccess?.({
					moderator: false,
					course_creator: true,
					batch_evaluator: false,
					lms_student: true,
				})
			},
		}
		resources.push(resource)
		return resource
	},
}))
vi.mock('@/components/Controls/BooleanSwitch.vue', () => ({
	default: {
		props: ['modelValue', 'label'],
		emits: ['update:modelValue'],
		template:
			'<input type="checkbox" :data-label="label" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
	},
}))

// The utils barrel pulls in the video player, which needs a real browser.
vi.mock('@/utils', () => ({
	convertToTitleCase: (text: string) =>
		text.replace(/\b\w/g, (letter) => letter.toUpperCase()),
}))

import ProfileRoles from '@/pages/ProfileRoles.vue'

const open = () =>
	mount(ProfileRoles, {
		props: { profile: { data: { name: 'learner@x' } } },
		global: { mocks: { __: (text: string) => text } },
	})

const box = (wrapper: any, label: string) =>
	wrapper.get(`[data-label="${label}"]`).element as HTMLInputElement

describe('profile roles', () => {
	it('shows the roles the server reports', async () => {
		const wrapper = open()
		await flushPromises()

		expect(box(wrapper, 'Course Creator').checked).toBe(true)
		expect(box(wrapper, 'Student').checked).toBe(true)
		expect(box(wrapper, 'Moderator').checked).toBe(false)
		expect(box(wrapper, 'Evaluator').checked).toBe(false)
	})

	it('saves the switched role with its new value', async () => {
		call.mockResolvedValue({})
		const wrapper = open()
		await flushPromises()

		await wrapper.get('[data-label="Evaluator"]').setValue(true)
		await flushPromises()

		expect(call).toHaveBeenCalledWith('lms.lms.api.save_role', {
			user: 'learner@x',
			role: 'Batch Evaluator',
			value: true,
		})
	})
})
