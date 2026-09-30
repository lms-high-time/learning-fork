import { computed, ref } from 'vue'
import { createResource } from 'frappe-ui'
import type { ContractAnswer } from '@/utils/postForm'

export type LoadState = 'loading' | 'error' | 'ready'

/**
 * A read of one of our contract methods (`{ok, data}` or `{ok: false,
 * error}`) as a page shows it: loading, the server's refusal or our own
 * words for a failure, or the data (learning-services#452).
 *
 * The failure is read from `resource.error`, not from `fetch()` throwing:
 * frappe-ui puts the previous data back on a failed read, and whether it
 * rethrows is its business. A newer read aborts the one in flight, and only
 * the newest may say the wait is over.
 */
export function useContractResource<T>(options: {
	url: string
	makeParams?: () => Record<string, unknown>
	/** What to say when the server said nothing a person can read. */
	fallback: () => string
}) {
	const resource = createResource({
		url: options.url,
		makeParams: options.makeParams,
		auto: false,
		// Said on the page itself, not in the app's error toast.
		onError: () => {},
	})

	let generation = 0
	const settled = ref(false)
	// A step before the read — choosing the space — failed.
	const broken = ref(false)

	/**
	 * Read again. `before` runs first, and its failure is the page's too;
	 * `quiet` keeps what is shown on screen until the answer comes.
	 */
	async function load(
		how: { before?: () => Promise<unknown>; quiet?: boolean } = {}
	): Promise<void> {
		const { before, quiet } = how
		const mine = ++generation
		resource.abort()
		if (!quiet) settled.value = false
		broken.value = false
		try {
			if (before) await before()
		} catch {
			if (mine === generation) {
				broken.value = true
				settled.value = true
			}
			return
		}
		if (mine !== generation) return
		try {
			await resource.fetch()
		} catch {
			// `resource.error` holds it.
		}
		if (mine === generation) settled.value = true
	}

	/** Forget what was read: another record is about to be shown. */
	function reset() {
		generation++
		resource.abort()
		resource.reset()
		settled.value = false
		broken.value = false
	}

	const answer = computed(() => resource.data as ContractAnswer<T> | null)
	const failed = computed(() => broken.value || Boolean(resource.error))
	const data = computed<T | null>(() =>
		!failed.value && answer.value?.ok ? answer.value.data ?? null : null
	)
	const state = computed<LoadState>(() => {
		if (!settled.value) return 'loading'
		if (failed.value || !answer.value?.ok) return 'error'
		return 'ready'
	})
	// A refusal says why; a failure without words gets ours.
	const failure = computed(
		() =>
			(!failed.value &&
				answer.value &&
				!answer.value.ok &&
				answer.value.error?.message) ||
			options.fallback()
	)

	/** Show an answer the page already has — an action's — without a read. */
	const show = (value: T) => resource.setData({ ok: true, data: value })

	return { resource, answer, data, state, failure, load, reset, show }
}
