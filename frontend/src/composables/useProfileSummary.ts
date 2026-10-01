import { computed, watch } from 'vue'
import { createResource } from 'frappe-ui'
import { useAssistantPanel } from '@/stores/assistantPanel'
import type { ContractAnswer } from '@/utils/postForm'

/**
 * How much of the learner's profile is filled (learning-services#463): what the
 * «Tell your mentor about yourself» card needs, and the chat's address for it.
 *
 * Read once per page load, not per mount — the sidebar and the You page both
 * ask, and the answer only changes when the chat saves a fact, which moves the
 * panel's `refreshTick`. A failed read leaves `summary` empty and the card out.
 */

export type ProfileSummary = {
	filled: number
	total: number
	complete: boolean
	interview_url: string | null
}

let resource: ReturnType<typeof createResource> | null = null
// The refresh tick the last read answered for; -1 before any read.
let readFor = -1

export function useProfileSummary(enabled: () => boolean) {
	const panel = useAssistantPanel()
	resource ??= createResource({
		url: 'lms_frappe_app.api.student.my_profile',
		params: { summary: 1 },
		auto: false,
		// The card is an offer, not the page: a failure leaves it out quietly.
		onError: () => {},
	})
	const read = resource

	// Every caller watches, the tick decides: two mounted callers read once.
	watch(
		() => [enabled(), panel.refreshTick] as const,
		([on, tick]) => {
			if (!on || readFor === tick) return
			readFor = tick
			// The newer answer wins: a read still on its way is dropped.
			read.abort?.()
			read.fetch().catch(() => {})
		},
		{ immediate: true }
	)

	const summary = computed<ProfileSummary | null>(() => {
		const answer = read.data as ContractAnswer<ProfileSummary> | null
		return answer?.ok ? answer.data ?? null : null
	})
	return { summary }
}

/** Forget the cached read — for tests; a page load starts clean anyway. */
export function resetProfileSummary() {
	resource = null
	readFor = -1
}
