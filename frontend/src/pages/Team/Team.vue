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

			<nav class="flex gap-1 border-b" role="tablist">
				<button
					v-for="item in tabs"
					:key="item.value"
					type="button"
					role="tab"
					:aria-selected="tab === item.value"
					:data-testid="`team-tab-${item.value}`"
					class="-mb-px border-b-2 px-3 py-2 text-p-base"
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

			<!-- Members: the current ones, then who left and when. -->
			<TeamMembers
				v-if="tab === 'members'"
				:team="team"
				@changed="reloadTeam"
			/>
			<TeamAssignments v-else-if="tab === 'assignments'" :team="team" />

			<TeamDocuments v-else-if="tab === 'documents'" :team="team" />

			<!-- Report: the manager's only; the same rows the agent gets. -->
			<div
				v-else-if="tab === 'report'"
				class="overflow-x-auto"
				data-testid="team-report"
			>
				<table class="w-full text-p-sm">
					<thead class="text-ink-gray-5">
						<tr class="border-b text-start">
							<th class="py-2 text-start font-normal">{{ __('Member') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Course') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Status') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Progress') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Deadline') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Document') }}</th>
							<th class="py-2 text-start font-normal">
								{{ __('Passed first try') }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in reportRows"
							:key="`${row.user}-${row.course}`"
							class="border-b"
						>
							<td class="py-2">{{ row.full_name || row.user }}</td>
							<td class="py-2">{{ courseTitle(row.course) }}</td>
							<td class="py-2">{{ statusLabel(row.status) }}</td>
							<td class="py-2">{{ percent(row.progress) }}</td>
							<td class="py-2" :class="row.overdue ? 'text-ink-red-4' : ''">
								{{ row.deadline || '—' }}
							</td>
							<td class="py-2">
								{{ row.document.blocks_filled }}/{{ row.document.blocks_total }}
							</td>
							<td class="py-2">
								{{ row.quiz.first_try }}/{{ row.quiz.passed }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// The organization's team (learning-services#358): who is in it, what they
// wrote in the organization's space, and — for a manager — how their study goes.
// Access is the server's (`team_not_available`); the page only says so plainly.
import { computed, onMounted, ref, watch } from 'vue'
import { createResource, LoadingIndicator, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import TeamMembers from '@/components/Team/TeamMembers.vue'
import TeamAssignments from '@/components/Team/TeamAssignments.vue'
import TeamDocuments from '@/components/Team/TeamDocuments.vue'
import { useSpace } from '@/stores/space'
import {
	percent,
	statusLabel,
	type ReportRow,
	type TeamData,
} from '@/utils/team'

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
const report = createResource({
	url: 'lms_frappe_app.api.manager.org_report',
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

watch(tab, (value) => {
	if (value === 'report' && team.value && !report.data)
		report.reload({ organization: team.value.organization })
})
const reportRows = computed<ReportRow[]>(() => {
	const answer = report.data as Answer<{ rows: ReportRow[] }> | null
	return answer?.ok ? answer.data?.rows ?? [] : []
})
const courseTitle = (course: string) =>
	team.value?.courses.find((item) => item.id === course)?.title ?? course

usePageMeta(() => ({ title: team.value?.title || __('Team') }))
</script>
