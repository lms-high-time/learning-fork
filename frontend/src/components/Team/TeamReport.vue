<template>
	<div class="space-y-3" data-testid="team-report">
		<div v-if="report.loading && !report.data" class="flex justify-center p-6">
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p v-else-if="!rows.length" class="text-p-base text-ink-gray-6">
			{{ __('Nobody is assigned a course yet.') }}
		</p>

		<template v-else>
			<p class="text-p-sm text-ink-gray-7" data-testid="team-report-summary">
				{{
					__('Assignments: {0} · completed: {1} · overdue: {2}').format(
						summary.total,
						summary.completed,
						summary.overdue
					)
				}}
			</p>

			<div class="overflow-x-auto">
				<table class="w-full text-p-sm">
					<thead class="text-ink-gray-5">
						<tr class="border-b">
							<th
								v-for="column in columns"
								:key="column.label"
								scope="col"
								class="whitespace-nowrap py-2 pe-3 text-start font-normal"
								:aria-sort="
									column.sort && sortKey === column.sort
										? ascending
											? 'ascending'
											: 'descending'
										: undefined
								"
							>
								<button
									v-if="column.sort"
									type="button"
									class="inline-flex items-center gap-1 hover:text-ink-gray-8"
									:data-testid="`sort-${column.sort}`"
									@click="sortBy(column.sort)"
								>
									{{ column.label }}
									<span
										v-if="sortKey === column.sort"
										class="size-3"
										:class="
											ascending ? 'lucide-chevron-up' : 'lucide-chevron-down'
										"
										aria-hidden="true"
									/>
								</button>
								<template v-else>{{ column.label }}</template>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in sorted"
							:key="`${row.user}-${row.course}`"
							class="border-b"
						>
							<td class="py-2 pe-3">{{ memberName(row) }}</td>
							<td class="py-2 pe-3">{{ courseTitle(row.course) }}</td>
							<td class="whitespace-nowrap py-2 pe-3">
								{{ statusLabel(row.status) }}
							</td>
							<td class="py-2 pe-3">{{ percent(row.progress) }}</td>
							<td
								class="whitespace-nowrap py-2 pe-3"
								:class="row.overdue ? 'text-ink-red-4' : ''"
								:title="row.deadline ? formatDay(row.deadline) : undefined"
							>
								{{ deadlineText(row) }}
							</td>
							<td class="whitespace-nowrap py-2 pe-3">
								{{
									__('{0} of {1}').format(
										row.document.blocks_filled,
										row.document.blocks_total
									)
								}}
							</td>
							<td class="whitespace-nowrap py-2">
								{{
									__('{0} of {1}').format(row.quiz.first_try, row.quiz.passed)
								}}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- The two counting columns explained in words: a tooltip does not
			     open on a phone (#379). -->
			<dl class="space-y-1 text-p-sm text-ink-gray-5">
				<div>
					<dt class="inline font-medium">{{ __('Blocks') }}:</dt>
					<dd class="ms-1 inline">
						{{
							__(
								'filled blocks in all documents of the course, in this organization.'
							)
						}}
					</dd>
				</div>
				<div>
					<dt class="inline font-medium">{{ __('First try') }}:</dt>
					<dd class="ms-1 inline">
						{{
							__(
								'lessons whose quiz passed on the first attempt, of lessons passed.'
							)
						}}
					</dd>
				</div>
			</dl>
		</template>
	</div>
</template>

<script setup lang="ts">
// The manager's report on «Команда» (learning-services#355): the same rows
// the agent gets, with a summary, sorting and deadlines in days (#379).
import { computed, onMounted, ref } from 'vue'
import { createResource, LoadingIndicator } from 'frappe-ui'
import {
	deadlineText,
	formatDay,
	memberName,
	percent,
	reportSummary,
	sortReport,
	statusLabel,
	type ReportRow,
	type ReportSort,
	type TeamData,
} from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

const props = defineProps<{ team: TeamData }>()

const report = createResource({
	url: 'lms_frappe_app.api.manager.org_report',
	auto: false,
})
onMounted(() => report.reload({ organization: props.team.organization }))

const rows = computed<ReportRow[]>(() => {
	const answer = report.data as Answer<{ rows: ReportRow[] }> | null
	return answer?.ok ? answer.data?.rows ?? [] : []
})
const summary = computed(() => reportSummary(rows.value))

// Soonest deadline first: what a manager checks the report for.
const sortKey = ref<ReportSort>('deadline')
const ascending = ref(true)
const sortBy = (key: ReportSort) => {
	ascending.value = sortKey.value === key ? !ascending.value : true
	sortKey.value = key
}
const sorted = computed(() =>
	sortReport(rows.value, sortKey.value, ascending.value)
)

const columns: { label: string; sort?: ReportSort }[] = [
	{ label: __('Member'), sort: 'member' },
	{ label: __('Course') },
	{ label: __('Status'), sort: 'status' },
	{ label: __('Progress'), sort: 'progress' },
	{ label: __('Deadline'), sort: 'deadline' },
	{ label: __('Blocks') },
	{ label: __('First try') },
]

const courseTitle = (course: string) =>
	props.team.courses.find((item) => item.id === course)?.title ?? course
</script>
