import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// Starting one's own organization (learning-services#366).

const calls: { method: string; params: unknown }[] = []
vi.mock('frappe-ui', () => ({
	call: vi.fn(async (method: string, params: unknown) => {
		calls.push({ method, params })
		return {
			ok: false,
			error: { code: 'organization_limit', message: 'Лимит' },
		}
	}),
	toast: { error: vi.fn() },
	usePageMeta: vi.fn(),
	Button: {
		props: ['disabled', 'loading', 'type', 'variant'],
		template: '<button :type="type" :disabled="disabled"><slot /></button>',
	},
	FormControl: {
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template:
			'<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
}))

import NewTeam from '@/pages/Team/NewTeam.vue'
import { toast } from 'frappe-ui'

describe('creating an organization', () => {
	it('sends the name and says the refusal as it came', async () => {
		const wrapper = mount(NewTeam, {
			global: { mocks: { __: (t: string) => t } },
		})

		await wrapper.find('input').setValue('Отдел продаж')
		await wrapper.find('[data-testid="new-team"]').trigger('submit')
		await flushPromises()

		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.create_organization',
			params: { title: 'Отдел продаж' },
		})
		expect(toast.error).toHaveBeenCalledWith('Лимит')
	})
})
