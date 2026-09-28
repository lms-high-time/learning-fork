<template>
	<div class="mx-auto max-w-xl space-y-4 p-5">
		<div v-if="info.loading && !invite" class="flex justify-center p-10">
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="!invite"
			class="text-p-base text-ink-gray-6"
			data-testid="join-invalid"
		>
			{{
				__(
					'This link is not valid: it was revoked or mistyped. Ask for a new one.'
				)
			}}
		</p>

		<template v-else>
			<h1 class="text-xl-semibold text-ink-gray-9">
				{{ __('Join {0}').format(invite.title) }}
			</h1>

			<p
				v-if="invite.member"
				class="text-p-base text-ink-gray-7"
				data-testid="join-member"
			>
				{{ __('You are already in this organization.') }}
				<router-link :to="{ name: 'Team' }" class="underline">{{
					__('Open the team')
				}}</router-link>
			</p>

			<template v-else>
				<ul
					class="list-disc space-y-1 ps-5 text-p-base text-ink-gray-7"
					data-testid="join-terms"
				>
					<li>
						{{
							__(
								'Your courses and documents for yourself stay yours: the company does not see them.'
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
								'The company will see which of its courses you have already passed.'
							)
						}}
					</li>
					<li>{{ __('Nobody sees your conversations with the mentor.') }}</li>
				</ul>

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
