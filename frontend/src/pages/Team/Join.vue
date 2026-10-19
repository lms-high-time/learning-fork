<template>
	<PageHeader :breadcrumbs="[{ label: __('Invitation') }]" />
	<div class="mx-auto max-w-xl space-y-4 p-5">
		<div v-if="info.loading && !invite" class="flex justify-center p-10">
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<div v-else-if="!invite" class="space-y-3" data-testid="join-invalid">
			<p class="text-p-base text-ink-gray-6">
				{{
					__(
						'This link is not valid: it was revoked or mistyped. Ask for a new one.'
					)
				}}
			</p>
			<!-- Not a dead end (#379). -->
			<router-link :to="{ name: 'Home' }" class="text-p-base underline">
				{{ __('Go to the home page') }}
			</router-link>
		</div>

		<template v-else>
			<h1 class="text-xl-semibold text-ink-gray-9">
				{{ __('Join {0}').format(invite.title) }}
			</h1>

			<p
				v-if="invite.member"
				class="text-p-base text-ink-gray-7"
				data-testid="join-member"
			>
				{{ __('You are already in this team.') }}
				<router-link :to="{ name: 'Team' }" class="underline">{{
					__('Open the team')
				}}</router-link>
			</p>

			<template v-else>
				<p
					v-if="invite.verified === false"
					class="rounded bg-surface-amber-1 p-3 text-p-sm text-ink-amber-3"
					data-testid="join-unverified"
				>
					{{
						__(
							'This team was started by a user of the platform. Join only if you know who invited you.'
						)
					}}
				</p>
				<ul
					class="list-disc space-y-1 ps-5 text-p-base text-ink-gray-7"
					data-testid="join-terms"
				>
					<li>
						{{
							__(
								'Your courses and documents for yourself stay yours: the team does not see them.'
							)
						}}
					</li>
					<li>
						{{
							readersBeforeJoining(invite.documents_visible_to, invite.title)
						}}
					</li>
					<li>
						{{
							__(
								'While you are in the team, its admin and leads see your progress, homework and documents in its courses. If you leave, they no longer do.'
							)
						}}
					</li>
					<li>
						{{
							__(
								'Your progress in a course is one: if you have already passed a course of the team on your own, the team will see that too.'
							)
						}}
					</li>
					<li>{{ __('Nobody sees your conversations with the mentor.') }}</li>
				</ul>
				<p class="text-p-sm text-ink-gray-6">
					<a :href="safeUrl('/privacy')" class="underline">{{
						__('Who sees what — in the privacy policy')
					}}</a>
				</p>

				<a
					v-if="!isLoggedIn"
					:href="
						safeUrl(`/login?redirect-to=${encodeURIComponent(loginReturn)}`)
					"
					class="inline-block"
				>
					<Button variant="solid">{{ __('Log in to join') }}</Button>
				</a>
				<Button
					v-else
					variant="solid"
					:loading="joining"
					data-testid="join-accept"
					@click="join"
				>
					{{ __('Join') }}
				</Button>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
// Joining an organization by its link (learning-services#363). What joining
// means is said before the button: who will read the documents, and that the
// company sees which of its courses are already passed — progress is one per
// person. The terms sit on the page the learner opens anyway, not on a consent
// screen of their own.
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
	Button,
	call,
	createResource,
	LoadingIndicator,
	toast,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { sessionStore } from '@/stores/session'
import { readersBeforeJoining } from '@/utils/team'
import { safeUrl } from '@/utils/safeUrl'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}
type Invite = {
	organization: string
	title: string
	documents_visible_to: 'managers' | 'members' | 'only_me'
	verified: boolean
	member: boolean
}

const route = useRoute()
const { isLoggedIn } = sessionStore()
const token = computed(() => String(route.params.token || ''))
const loginReturn = computed(() => `/lms/join/${token.value}`)

const info = createResource({
	url: 'lms_frappe_app.api.team.invite_info',
	makeParams: () => ({ token: token.value }),
	auto: true,
})
const invite = computed(() => {
	const answer = info.data as Answer<Invite> | null
	return answer?.ok ? answer.data ?? null : null
})

const joining = ref(false)
async function join() {
	joining.value = true
	try {
		const result = (await call('lms_frappe_app.api.team.accept_invite', {
			token: token.value,
		})) as Answer<{ organization: string }>
		if (!result?.ok) {
			toast.error(result?.error?.message ?? __('Could not join'))
			return
		}
		// The space is chosen on the server; a fresh load draws every list in it.
		window.location.href = '/lms'
	} finally {
		joining.value = false
	}
}

usePageMeta(() => ({ title: invite.value?.title || __('Invitation') }))
</script>
