<template>
	<!-- What the mentor knows in place of the bio (learning-services#463). The
	server answers only the owner and the platform's roles: anyone else gets a
	refusal, and the page shows nothing for it. One column of folded groups
	(learning-services#626). -->
	<section
		v-if="facts"
		ref="factsRoot"
		class="mt-10 mb-10"
		aria-labelledby="profile-facts-title"
		data-testid="profile-facts"
	>
		<div
			class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
		>
			<div class="min-w-0">
				<h2 id="profile-facts-title" class="text-lg-semibold text-ink-gray-9">
					{{ __('What your mentor knows about you') }}
				</h2>
				<p v-if="isOwn" class="mt-1 max-w-prose text-p-base text-ink-gray-6">
					{{
						__(
							'Your mentor takes this into account when working through your tasks in lessons. Your team lead does not see it.'
						)
					}}
				</p>
				<div
					v-if="facts.total"
					class="mt-3 flex items-center gap-3"
					data-testid="profile-filled"
				>
					<div
						class="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-surface-gray-3"
						aria-hidden="true"
					>
						<div
							class="h-full rounded-full bg-surface-blue-6"
							:style="{
								width: `${Math.round((100 * facts.filled) / facts.total)}%`,
							}"
						/>
					</div>
					<span class="text-p-sm text-ink-gray-6">
						{{ __('Filled in {0} of {1}').format(facts.filled, facts.total) }}
					</span>
				</div>
			</div>
			<Button
				v-if="canEdit && facts.interview_url"
				variant="solid"
				class="shrink-0 max-md:h-10 max-md:w-full"
				data-testid="profile-interview"
				@click="panel.open('profile', facts.interview_url)"
			>
				<template #prefix>
					<span class="lucide-message-circle size-4" aria-hidden="true" />
				</template>
				{{ __('Tell your mentor about you') }}
			</Button>
		</div>
		<!-- Folded groups, one per block: each block is long, and the summary
		under its title is enough to see what is there (learning-services#626).
		What is open is remembered on this device. -->
		<div v-if="groupIds.length > 1" class="mt-5 flex justify-end">
			<button
				type="button"
				class="rounded py-1 text-p-sm font-medium text-ink-blue-7 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline-blue-6"
				data-testid="profile-groups-toggle"
				@click="setAllOpen(!allOpen)"
			>
				{{ allOpen ? __('Collapse all') : __('Expand all') }}
			</button>
		</div>
		<div :class="groupIds.length > 1 ? 'mt-1' : 'mt-5'">
			<details
				v-for="group in groups"
				:key="group.id"
				:open="openIds.includes(group.id)"
				class="group/fold border-t border-outline-gray-2 last:border-b"
				:data-testid="group.testid"
				@toggle="remember(group.id, $event)"
			>
				<summary
					class="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-3 rounded py-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-outline-blue-6 [&::-webkit-details-marker]:hidden"
				>
					<span
						class="lucide-chevron-right size-4 text-ink-gray-5 transition-transform group-open/fold:rotate-90 motion-reduce:transition-none"
						aria-hidden="true"
					/>
					<span class="min-w-0">
						<span class="block text-base font-semibold text-ink-gray-9">
							{{ group.title }}
						</span>
						<span
							class="mt-0.5 block truncate text-p-sm text-ink-gray-6 group-open/fold:hidden"
						>
							{{ group.summary }}
						</span>
					</span>
					<span
						v-if="group.missing !== null"
						class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
						:class="
							group.missing
								? 'bg-surface-blue-2 text-ink-blue-7'
								: 'bg-surface-gray-2 text-ink-gray-6'
						"
					>
						{{
							__('{0} of {1}').format(
								group.facts.length - group.missing,
								group.facts.length
							)
						}}
					</span>
				</summary>
				<ul class="divide-y divide-outline-gray-1 pb-2 md:ps-7">
					<ProfileFact
						v-for="fact in group.facts"
						:key="fact.key"
						:data-fact-key="fact.key"
						:fact="fact"
						:editable="canEdit"
						:save="(text) => saveFact(fact.key, text)"
						:remove="() => forgetFact(fact.key)"
					/>
				</ul>
			</details>
		</div>
	</section>
	<div v-else-if="isOwn && state === 'loading'" class="mt-7 flex py-6">
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<p
		v-else-if="showFailure"
		class="mt-7 text-p-base text-ink-gray-6"
		role="alert"
	>
		{{ failure }}
	</p>
	<div class="mt-7 mb-10" v-if="badges.data?.length">
		<h2 class="mb-3 text-lg-semibold text-ink-gray-9">
			{{ __('Achievements') }}
		</h2>
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
			<div v-for="badge in badges.data" :key="badge.badge">
				<HoverCard :leave-delay="0.01">
					<template #trigger>
						<div class="relative">
							<img
								:src="safeUrl(badge.badge_image)"
								:alt="badge.badge"
								class="h-[80px]"
							/>
							<div
								v-if="badge.count > 1"
								class="flex items-end bg-surface-gray-2 p-2 text-xs-semibold rounded-full absolute end-0 bottom-0"
							>
								<span>
									<span class="lucide-x size-3" />
								</span>
								{{ badge.count }}
							</div>
						</div>
					</template>
					<template #default>
						<div class="w-[250px] text-base">
							<div class="bg-surface-gray-2 rounded-t-md py-5">
								<img
									:src="safeUrl(badge.badge_image)"
									:alt="badge.badge"
									class="h-[200px] mx-auto"
								/>
							</div>
							<div class="p-5">
								<div class="text-3xl-semibold mb-2">
									{{ badge.badge }}
								</div>
								<div class="leading-5 mb-4">
									{{ badge.badge_description }}
								</div>
								<div class="flex flex-col">
									<span class="text-xs-medium text-ink-gray-7 mb-1">
										{{ __('Issued on') }}:
									</span>
									{{ dayjs(badge.issued_on).format('DD MMM YYYY') }}
								</div>
								<div
									v-if="user.data?.name == profile.data?.name"
									class="flex flex-col mt-4"
								>
									<span class="text-xs-medium text-ink-gray-7 mb-1">
										{{ __('Share on') }}:
									</span>
									<div class="flex items-center gap-x-2">
										<Button
											variant="outline"
											size="sm"
											@click="shareOnSocial(badge, 'LinkedIn')"
										>
											<template #prefix>
												<LinkedinIcon class="h-3 w-3 text-ink-gray-7" />
											</template>
											<span class="text-xs">
												{{ __('LinkedIn') }}
											</span>
										</Button>
										<Button
											variant="outline"
											size="sm"
											@click="shareOnSocial(badge, 'Twitter')"
										>
											<template #prefix>
												<Twitter class="h-3 w-3 text-ink-gray-7" />
											</template>
											<span class="text-xs">
												{{ __('Twitter') }}
											</span>
										</Button>
									</div>
								</div>
							</div>
						</div>
					</template>
				</HoverCard>
			</div>
		</div>
	</div>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import {
	call,
	createResource,
	HoverCard,
	Button,
	LoadingIndicator,
	toast,
} from 'frappe-ui'
import { LinkedinIcon, Twitter } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { getLmsRoute } from '@/utils/basePath'
import { safeUrl } from '@/utils/safeUrl'
import { openExternal } from '@/utils/openExternal'
import { confirmAction } from '@/utils/confirm'
import { useContractResource } from '@/composables/useContractResource'
import { useAssistantPanel } from '@/stores/assistantPanel'
import ProfileFact from '@/components/Profile/ProfileFact.vue'

const dayjs = inject('$dayjs')
const user = inject('$user')
const { branding } = sessionStore()

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

const panel = useAssistantPanel()
const isOwn = computed(() => user.data?.name === props.profile.data.name)
// Someone else's profile, shown to the platform's roles, is read-only; so is
// every profile while the site is being updated — the interview included, as
// the chat's saves would fail too.
const canEdit = computed(() => isOwn.value && !window.read_only_mode)

const { data, answer, state, failure, load } = useContractResource({
	url: 'lms_frappe_app.api.student.my_profile',
	makeParams: () => ({ user: props.profile.data.name }),
	fallback: () => __('Could not load the profile'),
})
load()

// The last profile read, kept through a re-read that failed: the learner
// keeps what they were looking at and is told the refresh did not come.
const lastRead = ref(null)
watch(
	data,
	(value) => {
		if (value) lastRead.value = value
	},
	{ immediate: true }
)
const facts = computed(() => data.value ?? lastRead.value)

// The blocks, and what else the mentor knows, as folded groups: a summary of
// what is filled, and how much is not. The extra facts have no fixed set, so
// nothing about them is «not filled».
const groups = computed(() => {
	const shown = (facts.value?.blocks ?? []).map((block) => ({
		id: block.id,
		testid: 'profile-block',
		title: block.title,
		facts: block.facts,
		missing: block.facts.filter((fact) => !fact.text).length,
	}))
	if (facts.value?.other_facts?.length)
		shown.push({
			id: 'other',
			testid: 'profile-other-facts',
			title: __('More about you'),
			facts: facts.value.other_facts,
			missing: null,
		})
	return shown.map((group) => {
		const filled = group.facts.map((fact) => fact.text).filter(Boolean)
		return {
			...group,
			summary: filled.length ? filled.join(' · ') : __('Not specified'),
		}
	})
})
const groupIds = computed(() => groups.value.map((group) => group.id))

// Folded by default; what the learner opened stays open on this device. The
// storage may be missing or refuse (a private window): the groups then just
// start folded.
const OPEN_KEY = 'profileOpenGroups'
const readOpen = () => {
	try {
		const stored = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')
		return Array.isArray(stored) ? stored : []
	} catch {
		return []
	}
}
const openIds = ref(readOpen())
const saveOpen = () => {
	try {
		localStorage.setItem(OPEN_KEY, JSON.stringify(openIds.value))
	} catch {
		// Remembered for this visit only.
	}
}
// `toggle` also fires when the binding itself opened or closed the group, so
// this only records what the element says it is.
const remember = (id, event) => {
	const open = event.target.open
	if (open === openIds.value.includes(id)) return
	openIds.value = open
		? [...openIds.value, id]
		: openIds.value.filter((other) => other !== id)
	saveOpen()
}
const allOpen = computed(() =>
	groupIds.value.every((id) => openIds.value.includes(id))
)
const setAllOpen = (open) => {
	const others = openIds.value.filter((id) => !groupIds.value.includes(id))
	openIds.value = open ? [...others, ...groupIds.value] : others
	saveOpen()
}

// A refusal of someone else's profile shows nothing: that is the server saying
// the blocks are not this viewer's to see. Anything else that went wrong is
// said, whoever is looking.
const refusal = computed(() =>
	answer.value && !answer.value.ok ? answer.value.error?.code : null
)
const showFailure = computed(
	() =>
		state.value === 'error' &&
		(isOwn.value || refusal.value !== 'not_your_profile')
)

const reread = async () => {
	await load({ quiet: true })
	if (showFailure.value) toast.error(failure.value)
}

// A fact was saved — by the chat or here: this page reads the profile again,
// and so does the card offering the interview, which counts what is filled.
// The facts saved are always the viewer's own, so someone else's profile on
// screen has nothing new to show and is not asked again.
// `sync`, so the read has started when `notifyRefresh()` returns and a save
// here can wait for it: one read per change, the page's own included.
let reading = Promise.resolve()
watch(
	() => panel.refreshTick,
	() => {
		if (!isOwn.value) return
		reading = reread()
	},
	{ flush: 'sync' }
)
const refreshed = () => {
	panel.notifyRefresh()
	return reading
}

// A fact the learner words themselves is the same fact the agent writes.
const saveFact = async (key, text) => {
	if (
		await write(
			'lms_frappe_app.api.student.remember',
			{ kind: 'fact', key, text },
			__('Could not save')
		)
	) {
		await refreshed()
		return true
	}
	return false
}

const forgetFact = (key) =>
	confirmAction({
		title: __('Delete this fact?'),
		message: __('Your mentor will forget it.'),
		label: __('Delete'),
		async onConfirm() {
			if (
				await write(
					'lms_frappe_app.api.student.forget',
					{ key },
					__('Could not delete')
				)
			) {
				await refreshed()
				focusFillIn(key)
			}
		},
	})

// After a delete, focus goes to the row's «Fill in» — the Delete button left
// with the text. The confirmation, as it leaves, hands focus back to what
// opened it (that same Delete button, so nowhere): the move waits until the
// dialog is gone, or it would be pulled back into it or dropped after.
const factsRoot = ref(null)
const focusFillIn = (key) => {
	let frames = 60
	const step = () => {
		if (document.querySelector('[role="dialog"][data-state]') && frames-- > 0)
			return requestAnimationFrame(step)
		setTimeout(() => {
			const row = Array.from(
				factsRoot.value?.querySelectorAll('[data-fact-key]') ?? []
			).find((element) => element.dataset.factKey === key)
			row?.querySelector('[data-testid="profile-fact-edit"]')?.focus()
		})
	}
	step()
}

// A refusal says why; a failure without words gets ours.
const write = async (method, params, fallback) => {
	let answer = null
	try {
		answer = await call(method, params)
	} catch {
		// Said below, in our words.
	}
	if (answer?.ok) return true
	toast.error(answer?.error?.message || fallback)
	return false
}

const badges = createResource({
	url: 'lms.lms.api.get_badges',
	params: {
		member: props.profile.data.name,
	},
	auto: true,
	transform(data) {
		let finalBadges = []
		let groupedBadges = Object.groupBy(data, ({ badge }) => badge)
		for (let badge in groupedBadges) {
			let badgeData = groupedBadges[badge][0]
			badgeData.count = groupedBadges[badge].length
			finalBadges.push(badgeData)
		}
		return finalBadges
	},
})

const shareOnSocial = (badge, medium) => {
	let shareUrl
	const url = encodeURIComponent(
		`${window.location.origin}${getLmsRoute(
			`user/${props.profile.data?.username}`
		)}`
	)
	const summary = __(
		'I am happy to announce that I earned the {0} badge on {1} at {2}'
	).format(
		badge.badge,
		dayjs(badge.issued_on).format('DD MMM YYYY'),
		branding.data?.app_name
	)

	if (medium == 'LinkedIn')
		shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${url}&text=${summary}`
	else if (medium == 'Twitter')
		shareUrl = `https://twitter.com/intent/tweet?text=${summary}&url=${url}`

	openExternal(shareUrl)
}
</script>
