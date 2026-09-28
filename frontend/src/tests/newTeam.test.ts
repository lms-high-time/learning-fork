import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

// Starting one's own organization (learning-services#366), its limits said as
// numbers before a refusal (#379).

const calls: { method: string; params: unknown }[] = []
const answers: Record<string, unknown> = {}
vi.mock('frappe-ui', () => ({
	call: vi.fn(async (method: string, params: unknown) => {
		calls.push({ method, params })
		return {
			ok: false,
			error: { code: 'organization_limit', message: 'Лимит' },
		}
	}),
	createResource: ({ url }: { url: string }) =>
		reactive({ data: answers[url] ?? null, loading: false }),
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
vi.mock('@/components/Layouts/PageHeader.vue', () => ({
	default: { template: '<header />' },
}))

import NewTeam from '@/pages/Team/NewTeam.vue'
import { toast } from 'frappe-ui'

const TERMS = 'lms_frappe_app.api.team.organization_terms'
const mocks = {
	__: (t: string) =>
		Object.assign(new String(t), {
			format: (...args: unknown[]) =>
				t.replace(/\{(\d)\}/g, (_, i) => String(args[Number(i)])),
		}),
}

beforeEach(() => {
	calls.length = 0
	delete answers[TERMS]
})

describe('creating an organization', () => {
	it('sends the name and says the refusal as it came', async () => {
		const wrapper = mount(NewTeam, { global: { mocks } })

		await wrapper.find('input').setValue('Отдел продаж')
		await wrapper.find('[data-testid="new-team"]').trigger('submit')
		await flushPromises()

		expect(calls[0]).toEqual({
			method: 'lms_frappe_app.api.team.create_organization',
			params: { title: 'Отдел продаж' },
		})
		expect(toast.error).toHaveBeenCalledWith('Лимит')
	})

	it('names the member limit and says when no more can be started', async () => {
		answers[TERMS] = {
			ok: true,
			data: { member_limit: 25, organizations_left: 0 },
		}
		const wrapper = mount(NewTeam, { global: { mocks } })

		expect(wrapper.find('[data-testid="new-team-limit"]').text()).toContain(
			'up to 25 members'
		)
		expect(wrapper.find('[data-testid="new-team-none-left"]').exists()).toBe(
			true
		)
		await wrapper.find('input').setValue('Отдел продаж')
		expect(
			wrapper.find('[data-testid="create-team"]').attributes('disabled')
		).toBeDefined()
	})
})
