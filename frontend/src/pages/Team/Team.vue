<template>
	<div>
		<PageHeader
			:breadcrumbs="[{ label: __('Team'), route: { name: 'Team' } }]"
		/>

		<div
			v-if="state === 'loading'"
			class="flex justify-center p-10"
			data-testid="team-loading"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="state === 'personal'"
			class="mx-auto max-w-3xl p-5 text-p-base text-ink-gray-6"
			data-testid="team-personal"
		>
			{{
				__(
					'A team belongs to an organization. Choose it in the space switcher.'
				)
			}}
		</p>

		<p
			v-else-if="state === 'closed'"
			class="mx-auto max-w-3xl p-5 text-p-base text-ink-gray-6"
			data-testid="team-closed"
		>
			{{ __('This organization shows its documents to managers only.') }}
		</p>

		<div v-else-if="team" class="mx-auto max-w-5xl space-y-5 p-4 sm:p-5">
			<h1 class="text-xl-semibold text-ink-gray-9">{{ team.title }}</h1>

			<!-- Tabs scroll sideways on a phone instead of wrapping and clipping;
			     arrows move between them, as a tab list does (#379). -->
			<nav
				class="-mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b px-4 sm:mx-0 sm:px-0"
				role="tablist"
				:aria-label="__('Team')"
				@keydown="moveTab"
			>
				<button
					v-for="item in tabs"
					:id="`team-tab-${item.value}`"
					:key="item.value"
					type="button"
					role="tab"
					:aria-selected="tab === item.value"
					:aria-controls="`team-panel-${item.value}`"
					:tabindex="tab === item.value ? 0 : -1"
					:data-testid="`team-tab-${item.value}`"
					class="shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-p-base"
					:class="
						tab === item.value
							? 'border-ink-gray-9 text-ink-gray-9'
							: 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
					"
					@click="tab = item.value"
				>
					{{ item.label }}
				</button>
			</nav>

			<div
				:id="`team-panel-${tab}`"
				role="tabpanel"
				:aria-labelledby="`team-tab-${tab}`"
			>
				<!-- Members: the current ones, then who left and when. -->
				<TeamMembers
					v-if="tab === 'members'"
					:team="team"
					@changed="reloadTeam"
				/>
				<TeamAssignments v-else-if="tab === 'assignments'" :team="team" />
				<TeamDocuments v-else-if="tab === 'documents'" :team="team" />
				<!-- Report: the manager's only; the same rows the agent gets. -->
				<TeamReport v-else-if="tab === 'report'" :team="team" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// The organization's team (learning-services#358): who is in it, what they
// wrote in the organization's space, and — for a manager — how their study goes.
// Access is the server's (`team_not_available`); the page only says so plainly.
import { computed, nextTick, onMounted, ref } from 'vue'
import { createResource, LoadingIndicator, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import TeamMembers from '@/components/Team/TeamMembers.vue'
import TeamAssignments from '@/components/Team/TeamAssignments.vue'
import TeamDocuments from '@/components/Team/TeamDocuments.vue'
import TeamReport from '@/components/Team/TeamReport.vue'
import { useSpace } from '@/stores/space'
import type { TeamData } from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

const space = useSpace()

const teamResource = createResource({
	url: 'lms_frappe_app.api.team.team',
	auto: false,
})

const loaded = ref(false)
const reloadTeam = () =>
	teamResource.reload({ organization: space.current }).catch(() => {})
onMounted(async () => {
	await space.load()
	if (space.isOrganization) await reloadTeam()
	loaded.value = true
})

const teamAnswer = computed(() => teamResource.data as Answer<TeamData> | null)
const team = computed(() =>
	teamAnswer.value?.ok ? teamAnswer.value.data ?? null : null
)

const state = computed(() => {
	if (!loaded.value) return 'loading'
	if (!space.isOrganization) return 'personal'
	if (!team.value) return 'closed'
	return 'ready'
})

const tab = ref<'members' | 'documents' | 'assignments' | 'report'>('documents')
const tabs = computed(() => [
	{ value: 'documents' as const, label: __('Documents') },
	{ value: 'members' as const, label: __('Members') },
	...(team.value?.can_manage
		? [{ value: 'assignments' as const, label: __('Course assignments') }]
		: []),
	...(team.value?.can_see_report
		? [{ value: 'report' as const, label: __('Progress report') }]
		: []),
])

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
	tab.value = values[next]
	await nextTick()
	document.getElementById(`team-tab-${tab.value}`)?.focus()
}

usePageMeta(() => ({ title: team.value?.title || __('Team') }))
</script>
