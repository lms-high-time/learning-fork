<template>
	<div>
		<PageHeader
			:breadcrumbs="[{ label: __('Homework'), route: { name: 'Homework' } }]"
		/>

		<div v-if="!session.isLoggedIn" class="p-5 text-p-base text-ink-gray-7">
			{{ __('Homework from your lessons is gathered here.') }}
			<a href="/login?redirect-to=/lms/homework" class="underline">{{
				__('Log in')
			}}</a>
		</div>

		<div v-else class="mx-auto max-w-3xl space-y-6 p-4 sm:p-5">
			<template v-if="curator">
				<h1 class="text-xl-semibold text-ink-gray-9">{{ __('Homework') }}</h1>
				<!-- As on «Team»: tabs scroll sideways on a phone, arrows move
				     between them (WAI-ARIA tabs). -->
				<nav
					class="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-4 sm:mx-0 sm:px-0"
					role="tablist"
					:aria-label="__('Homework')"
					@keydown="moveTab"
				>
					<button
						v-for="item in tabs"
						:id="`homework-tab-${item.value}`"
						:key="item.value"
						type="button"
						role="tab"
						:aria-selected="tab === item.value"
						:aria-controls="`homework-panel-${item.value}`"
						:tabindex="tab === item.value ? 0 : -1"
						:data-testid="`homework-tab-${item.value}`"
						class="shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-p-base"
						:class="
							tab === item.value
								? 'border-ink-gray-9 text-ink-gray-9'
								: 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
						"
						@click="choose(item.value)"
					>
						{{ item.label }}
					</button>
				</nav>
			</template>
			<h1 v-else class="text-xl-semibold text-ink-gray-9">{{ __('Mine') }}</h1>

			<div
				:id="`homework-panel-${tab}`"
				:role="curator ? 'tabpanel' : undefined"
				:aria-labelledby="curator ? `homework-tab-${tab}` : undefined"
			>
				<HomeworkMine v-if="tab === 'mine'" />
				<HomeworkReview
					v-else-if="submission"
					:key="submission"
					:submission="submission"
				/>
				<HomeworkQueue v-else />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import HomeworkMine from '@/components/Homework/HomeworkMine.vue'
import HomeworkQueue from '@/components/Homework/HomeworkQueue.vue'
import HomeworkReview from '@/components/Homework/HomeworkReview.vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { isCurator } from '@/utils/homework'

// «Homework»: the learner's own (learning-services#439) and, for a tutor, the
// submissions awaiting review with one's card (learning-services#452). The
// tab and the card are in the address, so a link — the digest's, say — opens
// them, and Back returns from a card to the queue.

const session = sessionStore()
const { userResource } = usersStore()
const route = useRoute()
const router = useRouter()

// The router waits for the user before any page, so the roles are here.
const curator = computed(() => isCurator(userResource.data))

type Tab = 'mine' | 'queue'
const submission = computed(() =>
	typeof route.query.submission === 'string' ? route.query.submission : null
)
// A card is the queue's, even when a link names only the submission.
const tab = computed<Tab>(() =>
	curator.value && (route.query.tab === 'queue' || submission.value)
		? 'queue'
		: 'mine'
)

const tabs = computed(() => [
	{ value: 'mine' as const, label: __('Mine') },
	{ value: 'queue' as const, label: __('Awaiting review') },
])

const choose = (value: Tab) =>
	router.replace({ query: value === 'queue' ? { tab: 'queue' } : {} })

// Left and right arrows, Home and End move between tabs (WAI-ARIA tabs).
const moveTab = async (event: KeyboardEvent) => {
	const values = tabs.value.map((item) => item.value)
	const at = values.indexOf(tab.value)
	const moves: Record<string, number> = {
		ArrowRight: (at + 1) % values.length,
		ArrowLeft: (at - 1 + values.length) % values.length,
		Home: 0,
		End: values.length - 1,
	}
	const next = moves[event.key]
	if (next === undefined) return
	event.preventDefault()
	await choose(values[next])
	await nextTick()
	document.getElementById(`homework-tab-${tab.value}`)?.focus()
}

usePageMeta(() => ({ title: __('Homework') }))
</script>
