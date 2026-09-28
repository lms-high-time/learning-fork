<template>
	<div class="space-y-5">
		<section v-if="team.can_manage" class="space-y-2" data-testid="team-invite">
			<div class="flex flex-wrap items-center gap-2">
				<Button variant="solid" :loading="creating" @click="createInvite">
					{{ __('Invite by link') }}
				</Button>
				<span class="text-p-sm text-ink-gray-5">
					{{ __('Anyone with the link joins as a member.') }}
				</span>
			</div>
			<ul v-if="links.length" class="space-y-1">
				<li
					v-for="link in links"
					:key="link.token"
					class="flex flex-wrap items-center gap-2 text-p-sm"
				>
					<code
						class="min-w-0 flex-1 truncate rounded bg-surface-gray-2 px-2 py-1"
						>{{ link.url }}</code
					>
					<Button variant="subtle" @click="copy(link.url)">
						{{ __('Copy') }}
					</Button>
					<Button variant="ghost" @click="revoke(link.token)">
						{{ __('Revoke') }}
					</Button>
				</li>
			</ul>
		</section>

		<ul class="divide-y" data-testid="team-members">
			<li
				v-for="member in team.members"
				:key="member.user"
				class="flex flex-wrap items-center justify-between gap-3 py-2"
			>
				<span
					class="text-p-base"
					:class="member.left ? 'text-ink-gray-5' : 'text-ink-gray-9'"
				>
					{{ member.full_name || member.user }}
				</span>
				<span class="flex items-center gap-2 text-p-sm text-ink-gray-5">
					<template v-if="member.left">
						{{ __('Left {0}').format(member.left_on || '') }}
					</template>
					<FormControl
						v-else-if="team.can_change_roles"
						type="select"
						:modelValue="member.role"
						:options="roleOptions"
						:aria-label="__('Role')"
						@update:modelValue="(role: string) => setRole(member.user, role)"
					/>
					<template v-else>{{ roleLabel(member.role) }}</template>
					<Button
						v-if="canRemove(member, team)"
						variant="ghost"
						:data-testid="`remove-${member.user}`"
						@click="remove(member.user)"
					>
						{{ __('Mark as left') }}
					</Button>
				</span>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
// Members of the organization and, for a manager, inviting and marking who left
// (learning-services#363). Every action is the server's to allow; a refusal is
// said as it came, and the list is read again after a change.
import { computed, onMounted, ref } from 'vue'
import { Button, call, createResource, FormControl, toast } from 'frappe-ui'
import { canRemove, roleLabel, ROLE_VALUES, type TeamData } from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}
type Invite = { token: string; url: string }

const props = defineProps<{ team: TeamData }>()
const emit = defineEmits<{ changed: [] }>()

const invites = createResource({
	url: 'lms_frappe_app.api.team.invites',
	auto: false,
})
onMounted(() => {
	if (props.team.can_manage)
		invites.reload({ organization: props.team.organization })
})
const links = computed<Invite[]>(() => {
	const answer = invites.data as Answer<{ invites: Invite[] }> | null
	return answer?.ok ? answer.data?.invites ?? [] : []
})

const roleOptions = ROLE_VALUES.map((value) => ({
	value,
	label: roleLabel(value),
}))

const creating = ref(false)

async function act<T>(method: string, params: Record<string, string>) {
	const result = (await call(
		`lms_frappe_app.api.team.${method}`,
		params
	)) as Answer<T>
	if (!result?.ok) {
		toast.error(result?.error?.message ?? __('Could not save'))
		return null
	}
	return result.data ?? null
}

async function createInvite() {
	creating.value = true
	try {
		const invite = await act<Invite>('create_invite', {
			organization: props.team.organization,
		})
		if (invite) {
			await invites.reload({ organization: props.team.organization })
			await copy(invite.url)
		}
	} finally {
		creating.value = false
	}
}

async function copy(url: string) {
	try {
		await navigator.clipboard.writeText(url)
		toast.success(__('Link copied'))
	} catch {
		// No clipboard (an insecure origin, a denied permission): the link is on
		// screen to copy by hand.
	}
}

async function revoke(token: string) {
	if (await act('revoke_invite', { token }))
		invites.reload({ organization: props.team.organization })
}

async function setRole(user: string, role: string) {
	await act('set_member_role', {
		organization: props.team.organization,
		user,
		role,
	})
	emit('changed')
}

async function remove(user: string) {
	if (
		await act('remove_member', { organization: props.team.organization, user })
	)
		emit('changed')
}
</script>
