import { computed, reactive, ref, watch, type Ref } from 'vue'
import { createResource, toast } from 'frappe-ui'
import { postForm, type ContractAnswer } from '@/utils/postForm'
import type {
	HomeworkStatus,
	QueueData,
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

type State = 'loading' | 'error' | 'ready'

export type QueueFilters = {
	status: HomeworkStatus
	course: string
	organization: string
}

export function useReviewQueue() {
	const filters = reactive<QueueFilters>({
		status: 'Submitted',
		course: '',
		organization: '',
	})
	const resource = createResource({
		url: `${METHOD}.queue`,
		// An empty filter is no filter: it is left out, not sent blank.
		makeParams: () => ({
			status: filters.status,
			...(filters.course ? { course: filters.course } : {}),
			...(filters.organization ? { organization: filters.organization } : {}),
		}),
		auto: false,
		// Said on the page itself, not in the app's error toast.
		onError: () => {},
	})

	const settled = ref(false)
	const failed = ref(false)
	const load = () => {
		failed.value = false
		return resource
			.fetch()
			.catch(() => (failed.value = true))
			.finally(() => (settled.value = true))
	}
	watch(filters, load)

	const answer = computed(
		() => resource.data as ContractAnswer<QueueData> | null
	)
	const data = computed(() =>
		answer.value?.ok ? answer.value.data ?? null : null
	)
	const state = computed<State>(() => {
		if (!settled.value) return 'loading'
		if (failed.value || !answer.value?.ok) return 'error'
		return 'ready'
	})
	const failure = computed(
		() =>
			(answer.value && !answer.value.ok && answer.value.error?.message) ||
			__('Could not load the queue')
	)

	return { filters, resource, data, state, failure, load }
}

const DONE: Record<ReviewAction, string> = {
	accept: 'Homework accepted',
	send_back: 'Sent back for revision',
	reopen: 'Acceptance cancelled',
}

export function useReviewCard(id: Ref<string>) {
	const resource = createResource({
		url: `${METHOD}.submission`,
		makeParams: () => ({ submission: id.value }),
		auto: false,
		onError: () => {},
	})

	const settled = ref(false)
	const failed = ref(false)
	const load = () => {
		failed.value = false
		return resource
			.fetch()
			.catch(() => (failed.value = true))
			.finally(() => (settled.value = true))
	}
	watch(
		id,
		(value) => {
			if (!value) return
			settled.value = false
			resource.abort?.()
			load()
		},
		{ immediate: true }
	)

	const answer = computed(
		() => resource.data as ContractAnswer<ReviewCard> | null
	)
	const card = computed(() =>
		answer.value?.ok ? answer.value.data ?? null : null
	)
	const state = computed<State>(() => {
		if (!settled.value) return 'loading'
		if (failed.value || !answer.value?.ok) return 'error'
		return 'ready'
	})
	const failure = computed(
		() =>
			(answer.value && !answer.value.ok && answer.value.error?.message) ||
			__('Could not load the submission')
	)

	const acting = ref(false)

	/**
	 * Accept, return or reopen the version on screen. The card is read again
	 * after any answer but a plain refusal: the learner may have saved a new
	 * version, or another tutor may have got there first.
	 */
	async function act(action: ReviewAction, comment?: string): Promise<boolean> {
		const shown = card.value
		if (!shown || acting.value) return false
		const form = new FormData()
		form.append('submission', shown.submission.id)
		form.append('version', String(shown.submission.version ?? 0))
		if (comment !== undefined) form.append('comment', comment)

		acting.value = true
		try {
			const result = await postForm<ReviewCard>(`${METHOD}.${action}`, form)
			if (result.ok) {
				toast.success(__(DONE[action]))
				await resource.reload().catch(() => {})
				return true
			}
			if (result.code === 'stale_version') {
				toast.error(__('The learner saved a new version. Look at it first.'))
				await resource.reload().catch(() => {})
			} else if (result.code === 'busy' || result.code === 'wrong_status') {
				toast.error(result.message || __('Could not save'))
				await resource.reload().catch(() => {})
			} else {
				toast.error(result.message || __('Could not save'))
			}
			return false
		} finally {
			acting.value = false
		}
	}

	return { resource, card, state, failure, acting, act, load }
}
