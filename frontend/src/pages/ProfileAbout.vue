<template>
	<!-- What the mentor knows in place of the bio (learning-services#463). The
	server answers only the owner and the platform's roles: anyone else gets a
	refusal, and the page shows nothing for it. -->
	<div v-if="facts" class="mt-7 mb-10 space-y-4" data-testid="profile-facts">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-lg-semibold text-ink-gray-9">
				{{ __('About me') }}
			</h2>
			<Button
				v-if="isOwn && facts.interview_url"
				data-testid="profile-interview"
				@click="panel.open('profile', facts.interview_url)"
			>
				<template #prefix>
					<span class="lucide-message-circle size-4 text-ink-gray-7" />
				</template>
				{{ __('Fill in with your mentor') }}
			</Button>
		</div>
		<div class="grid gap-4 md:grid-cols-2">
			<section
				v-for="block in facts.blocks"
				:key="block.id"
				class="rounded-md border border-outline-gray-1 px-4 pt-3"
				data-testid="profile-block"
			>
				<h3 class="text-base font-semibold text-ink-gray-9">
					{{ block.title }}
				</h3>
				<ul class="divide-y divide-outline-gray-1">
					<ProfileFact
						v-for="fact in block.facts"
						:key="fact.key"
						:fact="fact"
						:editable="canEdit"
						:save="(text) => saveFact(fact.key, text)"
						:remove="() => forgetFact(fact.key)"
					/>
				</ul>
			</section>
		</div>
		<section v-if="facts.other_facts?.length" data-testid="profile-other-facts">
			<h3 class="text-base font-semibold text-ink-gray-9">
				{{ __('The agent also knows') }}
			</h3>
			<ul class="divide-y divide-outline-gray-1">
				<ProfileFact
					v-for="fact in facts.other_facts"
					:key="fact.key"
					:fact="fact"
					:editable="canEdit"
					:save="(text) => saveFact(fact.key, text)"
					:remove="() => forgetFact(fact.key)"
				/>
			</ul>
		</section>
	</div>
	<div v-else-if="isOwn && state === 'loading'" class="mt-7 flex py-6">
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<p
		v-else-if="isOwn && state === 'error'"
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
import { computed, inject, watch } from 'vue'
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
// every profile while the site is being updated.
const canEdit = computed(() => isOwn.value && !window.read_only_mode)

const {
	data: facts,
	state,
	failure,
	load,
} = useContractResource({
	url: 'lms_frappe_app.api.student.my_profile',
	makeParams: () => ({ user: props.profile.data.name }),
	fallback: () => __('Could not load the profile'),
})
load()

// The chat saved a fact while the profile is on screen: its block fills in.
watch(
	() => panel.refreshTick,
	() => load({ quiet: true })
)

// A fact the learner words themselves is the same fact the agent writes.
const saveFact = async (key, text) => {
	if (
		await write(
			'lms_frappe_app.api.student.remember',
			{ kind: 'fact', key, text },
			__('Could not save')
		)
	) {
		await load({ quiet: true })
		return true
	}
	return false
}

const forgetFact = (key) =>
	confirmAction({
		title: __('Delete this fact?'),
		message: __('The agent will forget it.'),
		label: __('Delete'),
		async onConfirm() {
			if (
				await write(
					'lms_frappe_app.api.student.forget',
					{ key },
					__('Could not delete')
				)
			)
				await load({ quiet: true })
		},
	})

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
