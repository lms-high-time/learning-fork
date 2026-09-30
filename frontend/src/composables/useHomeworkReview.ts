import { ref, watch, type Ref } from 'vue'
import { toast } from 'frappe-ui'
import { useContractResource } from '@/composables/useContractResource'
import { loadPendingCount } from '@/stores/homeworkQueue'
import { postForm } from '@/utils/postForm'
import type {
	QueueData,
	QueueFilters,
	ReviewAction,
	ReviewCard,
} from '@/utils/homework'

/**
 * The tutor's side of homework (learning-services#452): the queue of
 * submissions to review, and one submission's card with what may be done to
 * it. The server decides who sees what and which actions a card offers; the
 * page draws its answer.
 */

const METHOD = 'lms_frappe_app.api.review'

/** The queue under the filters the page gives; a change of them reads again. */
export function useReviewQueue(filters: () => QueueFilters) {
	const read = useContractResource<QueueData>({
		url: `${METHOD}.queue`,
		// An empty filter is no filter: it is left out, not sent blank.
		makeParams: () => {
			const { status, course, organization } = filters()
			return {
				status,
				...(course ? { course } : {}),
				...(organization ? { organization } : {}),
			}
		},
		fallback: () => __('Could not load the queue'),
	})
	// By value: the page rebuilds the filters from the address on every change.
	watch(
		() => JSON.stringify(filters()),
		() => read.load()
	)
	return read
}

const DONE: Record<ReviewAction, string> = {
	accept: 'Homework accepted',
	send_back: 'Sent back for revision',
	reopen: 'Acceptance cancelled',
}

/**
 * How an action ended: `done` — the server did it; `reread` — the submission
 * changed under the tutor (a new version, or someone reviewed it first) and
 * the card was read again; `refused` — nothing changed, the tutor may try
 * again.
 */
export type ReviewOutcome = 'done' | 'reread' | 'refused'

export function useReviewCard(id: Ref<string>) {
	const read = useContractResource<ReviewCard>({
		url: `${METHOD}.submission`,
		makeParams: () => ({ submission: id.value }),
		fallback: () => __('Could not load the submission'),
	})

	// Another submission: the previous card goes at once, not after the read.
	watch(
		id,
		(value) => {
			read.reset()
			if (value) read.load()
		},
		{ immediate: true }
	)

	const acting = ref(false)

	// The count by the menu changes with the queue.
	const reread = async () => {
		await read.load({ quiet: true })
		loadPendingCount()
	}

	/** Accept, return or reopen the version on screen. */
	async function act(
		action: ReviewAction,
		comment?: string
	): Promise<ReviewOutcome> {
		const shown = read.data.value
		if (!shown || acting.value) return 'refused'
		const form = new FormData()
		form.append('submission', shown.submission.id)
		form.append('version', String(shown.submission.version ?? 0))
		if (comment !== undefined) form.append('comment', comment)

		acting.value = true
		try {
			const result = await postForm<ReviewCard>(`${METHOD}.${action}`, form)
			if (result.ok) {
				toast.success(__(DONE[action]))
				// The answer is the card after the action: no second read.
				if (result.data) read.show(result.data)
				else await read.load({ quiet: true })
				loadPendingCount()
				return 'done'
			}
			if (result.code === 'stale_version') {
				toast.error(__('The learner saved a new version. Look at it first.'))
				await reread()
				return 'reread'
			}
			if (result.code === 'wrong_status') {
				toast.error(result.message || __('Could not save'))
				await reread()
				return 'reread'
			}
			toast.error(result.message || __('Could not save'))
			// A race, or a lost connection that may have carried the action:
			// the card says what is true now, and the tutor may try again.
			if (result.code === 'busy' || result.code === null) await reread()
			return 'refused'
		} finally {
			acting.value = false
		}
	}

	return { ...read, card: read.data, acting, act }
}
