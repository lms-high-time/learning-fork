<template>
	<div class="space-y-4">
		<div class="flex flex-wrap items-end gap-3" data-testid="queue-filters">
			<FormControl
				:modelValue="filters.status"
				@update:modelValue="(value: string) => setFilter('status', value)"
				type="select"
				class="w-full sm:w-48"
				:options="statusOptions"
				:label="__('Status')"
			/>
			<FormControl
				v-if="courseOptions.length > 2 || filters.course"
				:modelValue="filters.course"
				@update:modelValue="(value: string) => setFilter('course', value)"
				type="select"
				class="w-full sm:w-56"
				:options="courseOptions"
				:label="__('Course')"
			/>
			<FormControl
				v-if="organizationOptions.length > 2 || filters.organization"
				:modelValue="filters.organization"
				@update:modelValue="(value: string) => setFilter('organization', value)"
				type="select"
				class="w-full sm:w-56"
				:options="organizationOptions"
				:label="__('Organization')"
			/>
		</div>

		<div
			v-if="state === 'loading'"
			class="flex justify-center py-10"
			data-testid="queue-loading"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="state === 'error'"
			class="text-p-base text-ink-gray-6"
			role="alert"
			data-testid="queue-error"
		>
			{{ failure }}
		</p>

		<div
			v-else-if="!rows.length"
			class="flex flex-col items-center gap-2 py-10 text-center"
			data-testid="queue-empty"
		>
			<span
				class="lucide-circle-check size-6 text-ink-gray-4"
				aria-hidden="true"
			/>
			<p class="text-p-base text-ink-gray-7">
				{{
					filters.status === 'Submitted'
						? __('Nothing awaits review')
						: __('No homework with this status')
				}}
			</p>
		</div>

		<template v-else>
			<ul
				class="divide-y divide-outline-gray-1 rounded-md border border-outline-gray-1"
			>
				<li v-for="row in rows" :key="row.id" data-testid="queue-row">
					<router-link
						:to="{
							name: 'Homework',
							query: { ...queueQuery(filters), submission: row.id },
						}"
						class="flex flex-col gap-1 p-3 hover:bg-surface-gray-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
					>
						<div class="min-w-0 space-y-0.5">
							<div class="text-p-base font-medium text-ink-gray-9">
								{{ studentName(row.student) }}
							</div>
							<div class="text-p-sm text-ink-gray-8">{{ row.title }}</div>
							<div class="text-p-sm text-ink-gray-6">
								{{ place(row) }}
							</div>
							<div
								v-if="row.organization_title"
								class="text-p-sm text-ink-gray-5"
							>
								{{ row.organization_title }}
							</div>
						</div>
						<div
							class="flex shrink-0 flex-wrap items-center gap-2 text-p-sm sm:flex-col sm:items-end"
						>
							<span
								class="inline-flex items-center rounded-full px-2 py-0.5 text-p-xs font-medium"
								:class="STATUS_CLASSES[row.status]"
								>{{ statusLabel(row.status) }}</span
							>
							<span v-if="row.submitted_at" class="text-ink-gray-6">{{
								__('Submitted {0}').format(formatMoment(row.submitted_at))
							}}</span>
							<span v-if="row.version" class="text-ink-gray-6">{{
								__('Version {0}').format(row.version)
							}}</span>
							<span v-if="row.overdue" class="font-medium text-ink-red-7">{{
								__('Overdue')
							}}</span>
						</div>
					</router-link>
				</li>
			</ul>
			<!-- The server sends at most 50; the rest wait for these to go. -->
			<p
				v-if="(data?.total ?? 0) > rows.length"
				class="text-p-sm text-ink-gray-5"
				data-testid="queue-total"
			>
				{{ __('Showing {0} of {1}').format(rows.length, data?.total) }}
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FormControl, LoadingIndicator } from 'frappe-ui'
import { useReviewQueue } from '@/composables/useHomeworkReview'
import {
	formatMoment,
	QUEUE_STATUSES,
	queueFilters,
	queueQuery,
	statusLabel,
	studentName,
	STATUS_CLASSES,
	type QueueFilters,
	type QueueRow,
} from '@/utils/homework'

// «Awaiting review» (learning-services#452): the submissions this tutor may
// review, oldest first. The filters are the server's: the courses and
// organizations of what the tutor can see, «Personal» among them when the
// tutor sees learners' own spaces.

// The filters live in the address: a card opened from the queue leads back
// to the same list, and a link can be shared.
const route = useRoute()
const router = useRouter()
const filters = computed(() => queueFilters(route.query))
const setFilter = (key: keyof QueueFilters, value: string) =>
	router.replace({
		query: queueQuery({ ...filters.value, [key]: value } as QueueFilters),
	})

const { data, state, failure, load } = useReviewQueue(() => filters.value)
onMounted(() => load())

const rows = computed(() => data.value?.items ?? [])

const statusOptions = computed(() =>
	QUEUE_STATUSES.map((value) => ({ value, label: statusLabel(value) }))
)
const courseOptions = computed(() => [
	{ value: '', label: __('All courses') },
	...(data.value?.courses ?? []).map((item) => ({
		value: item.id,
		label: item.title || item.id,
	})),
])
const organizationOptions = computed(() => [
	{ value: '', label: __('All organizations') },
	...(data.value?.organizations ?? []).map((item) => ({
		value: item.id,
		label: item.title || item.id,
	})),
])

const place = (row: QueueRow) =>
	[row.course_title || row.course, row.lesson_title].filter(Boolean).join(' · ')
</script>
