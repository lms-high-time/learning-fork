import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// The learner's spaces (learning-services#347): what the store asks the
// contract, what a page passes as `space`, and how a space is named.

const answers: Record<string, unknown> = {}
const called: { url: string; params: unknown }[] = []

vi.mock('frappe-ui', () => ({
	createResource: ({ url }: { url: string }) => {
		const resource = reactive({
			data: null as unknown,
			reload: vi.fn(async (params?: unknown) => {
				called.push({ url, params })
				resource.data = answers[url] ?? null
			}),
		})
		return resource
	},
	call: vi.fn(async () => ({ ok: true, data: { current: 'personal' } })),
	toast: { error: vi.fn() },
}))

import { PERSONAL, useSpace } from '@/stores/space'
import { documentReaders, spaceLabel } from '@/utils/space'

const SPACES = 'lms_frappe_app.api.student.my_spaces'
const COURSES = 'lms_frappe_app.api.student.list_my_courses'
const CATALOG = 'lms_frappe_app.api.student.list_catalog'

const personal = {
	id: PERSONAL,
	title: null,
	role: null,
	suspended: false,
	documents_visible_to: 'only_me' as const,
}
const company = {
	id: 'org-1',
	title: 'Кофейни',
	role: 'Member',
	suspended: false,
	documents_visible_to: 'managers' as const,
}

const setSpaces = (current: string, spaces = [personal, company]) => {
	answers[SPACES] = { ok: true, data: { current, spaces } }
	answers[COURSES] = { ok: true, data: { courses: [{ id: 'assigned' }] } }
	answers[CATALOG] = { ok: true, data: { courses: [{ id: 'opened' }] } }
}

beforeEach(() => {
	setActivePinia(createPinia())
	called.length = 0
	for (const key of Object.keys(answers)) delete answers[key]
})

describe('the space store', () => {
	it('in an organization narrows to its courses and passes it only for them', async () => {
		setSpaces('org-1')
		const space = useSpace()

		await space.load()

		expect(space.isOrganization).toBe(true)
		expect(space.myCourseIds).toEqual(['assigned'])
		expect(called.filter((c) => c.url === COURSES)[0].params).toEqual({
			space: 'org-1',
		})
		expect(space.paramFor('assigned')).toBe('org-1')
		// Not the organization's: the server falls back to the personal space.
		expect(space.paramFor('own')).toBeUndefined()
	})

	it('in the personal space fetches no lists and names it explicitly', async () => {
		setSpaces(PERSONAL)
		const space = useSpace()

		await space.load()

		expect(called.map((c) => c.url)).toEqual([SPACES])
		expect(space.paramFor('anything')).toBe(PERSONAL)
	})

	it('enrols through the organization only for a course it opened', async () => {
		setSpaces('org-1')
		const space = useSpace()
		await space.load()

		expect(space.enrolFor('opened')).toBe('org-1')
		expect(space.enrolFor('elsewhere')).toBe(PERSONAL)
	})

	it('hides the switcher without an organization', async () => {
		setSpaces(PERSONAL, [personal])
		const space = useSpace()
		await space.load()

		expect(space.hasOrganizations).toBe(false)
	})

	it('without an answer passes no space at all', () => {
		const space = useSpace()

		expect(space.paramFor('course')).toBeUndefined()
	})
})

describe('space wording', () => {
	it('names the personal space and an organization by its title', () => {
		expect(spaceLabel(personal)).toBe('Personal')
		expect(spaceLabel(company)).toBe('Кофейни')
	})

	it('says who else reads a document', () => {
		expect(documentReaders(personal)).toBe('Visible only to you')
		expect(documentReaders(company)).toBe('Visible to the managers of Кофейни')
		expect(
			documentReaders({ ...company, documents_visible_to: 'members' })
		).toBe('Visible to everyone in Кофейни')
	})
})
