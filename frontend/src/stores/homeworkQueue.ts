import { ref } from 'vue'
import { call } from 'frappe-ui'
import { usersStore } from '@/stores/user'
import { isCurator } from '@/utils/homework'
import type { ContractAnswer } from '@/utils/postForm'

// How many submissions await the tutor's review (learning-services#452): the
// count by «Homework» on the desk menu and on the phone's You page.
//
// Module-level, as stores/notifications keeps the unread count: the number
// exists whether or not the sidebar is mounted (a phone never mounts it), and
// no component-bound callback can go stale.
export const pendingCount = ref(0)

/** A learner and a visitor have no queue: nothing is asked, the count is 0. */
export async function loadPendingCount(): Promise<void> {
	if (!isCurator(usersStore().userResource.data)) {
		pendingCount.value = 0
		return
	}
	try {
		const answer = (await call(
			'lms_frappe_app.api.review.pending_count'
		)) as ContractAnswer<{ count: number }> | null
		if (answer?.ok) pendingCount.value = answer.data?.count ?? 0
	} catch {
		// The menu keeps the last number; the queue itself says what failed.
	}
}
