<template>
	<article
		class="space-y-3 rounded-lg border border-outline-gray-2 bg-surface-base p-4"
		:data-testid="`document-${doc.artifact}`"
	>
		<div class="flex items-center gap-4">
			<span
				class="lucide-file-text size-5 shrink-0 text-ink-gray-5"
				aria-hidden="true"
			/>
			<router-link
				:to="open()"
				class="min-w-0 flex-1 text-p-base font-medium text-ink-gray-9 hover:underline"
			>
				{{ doc.title }}
			</router-link>
			<span
				class="w-24 shrink-0"
				:title="
					__('Filled {0} of {1}').format(
						String(doc.blocks_filled),
						String(doc.blocks_total)
					)
				"
			>
				<ProgressBar :progress="percent" />
			</span>
		</div>

		<!-- The next step: the lesson the document grows on next during the
		course, after it the table's most urgent date under its own title
		(learning-services#342, #360, #462). -->
		<div class="flex flex-wrap items-center justify-between gap-3 ps-9">
			<p class="text-p-sm text-ink-gray-6" data-testid="document-next">
				<template v-if="lesson">
					{{
						__('Lesson {0} · {1}').format(String(lesson.number), lesson.title)
					}}
				</template>
				<template v-else-if="due">
					<span :class="due.days < 0 ? 'font-medium text-ink-red-5' : ''">
						{{ due.title }}:
						{{
							due.days < 0
								? __('overdue by {0} d').format(String(-due.days))
								: formatCell({ type: 'date' }, due.value)
						}}
					</span>
				</template>
				<template v-else-if="finished">{{
					__('The course is behind you')
				}}</template>
				<template v-else-if="behind">{{
					__('Its lessons are behind you')
				}}</template>
			</p>
			<router-link :to="open()">
				<Button
					:variant="lesson ? 'solid' : 'subtle'"
					:label="lesson ? __('Continue') : __('Open')"
				/>
			</router-link>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Button, createResource } from 'frappe-ui'
import ProgressBar from '@/components/ProgressBar.vue'
import {
	formatCell,
	isSharedTable,
	lessonAhead,
	tableDates,
	urgentDate,
	type DocumentData,
} from '@/utils/documentTable'

const props = defineProps<{
	course: string
	doc: {
		artifact: string
		title: string
		blocks_total: number
		blocks_filled: number
	}
}>()

const percent = computed(() =>
	props.doc.blocks_total
		? Math.round((props.doc.blocks_filled / props.doc.blocks_total) * 100)
		: 0
)

const map = createResource({
	url: 'lms_frappe_app.api.public.course_map',
	method: 'GET',
	params: { course: props.course },
	cache: ['course_map', props.course],
	auto: true,
})
type Lesson = {
	id: string
	number: number
	title: string
	blocks?: { artifact: string }[]
}
const mapData = computed(
	() =>
		(
			map.data as {
				data?: {
					next_lesson?: string | null
					chapters?: { lessons: Lesson[] }[]
				}
			} | null
		)?.data
)
const lessons = computed(
	() => mapData.value?.chapters?.flatMap((c) => c.lessons) ?? []
)
const builds = (l: Lesson) =>
	(l.blocks ?? []).some((b) => b.artifact === props.doc.artifact)
// The lesson this document grows on next — the course's next lesson may build
// nothing of it (learning-services#462). The document opens on the same lesson.
const lesson = computed(() =>
	lessonAhead(lessons.value, mapData.value?.next_lesson, builds)
)
// A student's map without a next lesson: every lesson is closed.
const finished = computed(
	() => Boolean(mapData.value) && mapData.value?.next_lesson === null
)
// The course goes on, the document's lessons are passed. A document with no
// lesson of its own has none to pass.
const behind = computed(
	() =>
		Boolean(mapData.value?.next_lesson) &&
		!lesson.value &&
		lessons.value.some(builds)
)

// After the course or the document's lessons, the whole table's own dates: the
// most urgent one, named by its field — which date matters is the course's to
// say, not a key's (learning-services#360).
const document = createResource({
	url: 'lms_frappe_app.api.student.artifact',
	method: 'GET',
	params: { course: props.course, artifact: props.doc.artifact },
	auto: false,
})
const data = computed(
	() => (document.data as { data?: DocumentData } | null)?.data ?? null
)
const wholeTable = computed(
	() => Object.values(data.value?.tables ?? {}).find(isSharedTable) ?? null
)
const due = computed(() =>
	wholeTable.value && data.value
		? urgentDate(tableDates(wholeTable.value, data.value))
		: null
)
watch(
	() => finished.value || behind.value,
	(done) => {
		if (done) document.fetch()
	},
	{ immediate: true }
)

// The document opens where it should by itself: the lesson in progress, or
// after the course the canvas or the whole table.
const open = () => ({
	name: 'Document',
	params: { courseName: props.course, artifact: props.doc.artifact },
})
</script>
