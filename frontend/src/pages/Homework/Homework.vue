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

		<div
			v-else-if="state === 'loading'"
			class="flex justify-center p-10"
			data-testid="homework-loading"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="state === 'error'"
			class="mx-auto max-w-3xl p-5 text-p-base text-ink-gray-6"
			role="alert"
			data-testid="homework-error"
		>
			{{ failure }}
		</p>

		<div v-else class="mx-auto max-w-3xl space-y-6 p-4 sm:p-5">
			<!-- «Mine» is the only list on stage 1; the tutor's queue comes with
			stage 2, and the switcher with it. -->
			<h1 class="text-xl-semibold text-ink-gray-9">{{ __('Mine') }}</h1>

			<div
				v-if="!rows.length"
				class="flex flex-col items-center gap-2 py-10 text-center"
				data-testid="homework-empty"
			>
				<span
					class="lucide-notebook-pen size-6 text-ink-gray-4"
					aria-hidden="true"
				/>
				<p class="text-p-base text-ink-gray-7">{{ __('No homework yet') }}</p>
				<p class="text-p-sm text-ink-gray-5">
					{{
						__(
							'A lesson with homework gives it to you when you finish the lesson.'
						)
					}}
				</p>
			</div>

			<section
				v-for="group in groups"
				:key="group.course"
				class="space-y-2"
				data-testid="homework-course"
			>
				<h2 class="text-lg-semibold text-ink-gray-9">{{ group.title }}</h2>
				<ul
					class="divide-y divide-outline-gray-1 rounded-md border border-outline-gray-1"
				>
					<li
						v-for="row in group.rows"
						:key="row.id"
						data-testid="homework-row"
					>
						<component
							:is="row.path ? 'router-link' : 'div'"
							:to="row.path ?? undefined"
							class="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
							:class="{ 'hover:bg-surface-gray-1': row.path }"
						>
							<div class="min-w-0 space-y-0.5">
								<div class="text-p-base font-medium text-ink-gray-9">
									{{ row.title }}
								</div>
								<div class="text-p-sm text-ink-gray-6">
									{{ row.lesson_title }}
								</div>
								<p
									v-if="row.last_comment"
									class="text-p-sm text-ink-amber-8 whitespace-pre-line"
								>
									{{ row.last_comment }}
								</p>
							</div>
							<div
								class="flex shrink-0 flex-wrap items-center gap-2 text-p-sm sm:flex-col sm:items-end"
							>
								<span
									class="inline-flex items-center rounded-full px-2 py-0.5 text-p-xs font-medium"
									:class="STATUS_CLASSES[row.status]"
									>{{ statusLabel(row.status) }}</span
								>
								<span v-if="row.due_at" class="text-ink-gray-6">{{
									__('Due {0}').format(formatDay(row.due_at))
								}}</span>
								<span v-if="row.overdue" class="font-medium text-ink-red-7">{{
									__('Overdue')
								}}</span>
							</div>
						</component>
					</li>
				</ul>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createResource, LoadingIndicator, usePageMeta } from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { sessionStore } from '@/stores/session'
import { useSpace } from '@/stores/space'
import { formatDay } from '@/utils/team'
import {
	lessonPath,
	statusLabel,
	STATUS_CLASSES,
	type HomeworkRow,
} from '@/utils/homework'
import type { ContractAnswer } from '@/utils/postForm'

// «Homework» (learning-services#439): the learner's homework of the chosen
// space, by course; each row leads to the block under its lesson.

const session = sessionStore()
const space = useSpace()

const homework = createResource({
	url: 'lms_frappe_app.api.student.my_homework',
	makeParams: () => ({ space: space.current }),
	auto: false,
	// Said on the page itself, not in the app's error toast.
	onError: () => {},
})

// The space first: the list is the chosen space's. A dropped connection or a
// server error ends the wait too, with the page saying so.
const settled = ref(false)
const failed = ref(false)
if (session.isLoggedIn)
	space
		.load()
		.then(() => homework.fetch())
		.catch(() => (failed.value = true))
		.finally(() => (settled.value = true))

const answer = computed(
	() => homework.data as ContractAnswer<{ items: HomeworkRow[] }> | null
)

const state = computed<'loading' | 'error' | 'ready'>(() => {
	if (!settled.value) return 'loading'
	if (failed.value || !answer.value?.ok) return 'error'
	return 'ready'
})

// A refusal says why; a failure without words gets ours.
const failure = computed(
	() =>
		(answer.value && !answer.value.ok && answer.value.error?.message) ||
		__('Could not load homework')
)

type ShownRow = HomeworkRow & { path: string | null }

const rows = computed<ShownRow[]>(() =>
	(answer.value?.ok ? answer.value.data?.items ?? [] : []).map((row) => ({
		...row,
		path: lessonPath(row.lesson_url),
	}))
)

// Courses in the order their latest homework comes: the server sorts rows by
// the last change.
const groups = computed(() => {
	const byCourse = new Map<
		string,
		{ course: string; title: string; rows: ShownRow[] }
	>()
	for (const row of rows.value) {
		if (!byCourse.has(row.course))
			byCourse.set(row.course, {
				course: row.course,
				title: row.course_title || row.course,
				rows: [],
			})
		byCourse.get(row.course)!.rows.push(row)
	}
	return [...byCourse.values()]
})

usePageMeta(() => ({ title: __('Homework') }))
</script>
