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

		<!-- The next step: the lesson in progress during the course, the next
		review after it (learning-services#342). -->
		<div class="flex flex-wrap items-center justify-between gap-3 ps-9">
			<p class="text-p-sm text-ink-gray-6" data-testid="document-next">
				<template v-if="lesson">
					{{
						__('Lesson {0} · {1}').format(String(lesson.number), lesson.title)
					}}
				</template>
				<template v-else-if="review">
					<span :class="review.days < 0 ? 'font-medium text-ink-red-5' : ''">
						{{
							review.days < 0
								? __('Review overdue by {0} d').format(String(-review.days))
								: __('Next review {0}').format(
										formatCell({ type: 'date' }, review.value)
								  )
						}}
					</span>
				</template>
				<template v-else-if="finished">{{
					__('The course is behind you')
				}}</template>
			</p>
			<router-link
				:to="open(finished && hasRegister ? REGISTER_VIEW : undefined)"
			>
				<Button
					:variant="lesson ? 'solid' : 'subtle'"
					:label="
						lesson
							? __('Continue')
							: hasRegister
							? __('Open the register')
							: __('Open')
					"
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
	registerDates,
	REGISTER_VIEW,
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
type Lesson = { id: string; number: number; title: string }
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
const lesson = computed(() => {
	const id = mapData.value?.next_lesson
	return id
		? mapData.value?.chapters
				?.flatMap((c) => c.lessons)
				.find((l) => l.id === id) ?? null
		: null
})
// A student's map without a next lesson: every lesson is closed.
const finished = computed(
	() => Boolean(mapData.value) && mapData.value?.next_lesson === null
)

// After the course, the register's own dates: next review first.
const document = createResource({
	url: 'lms_frappe_app.api.student.artifact',
	method: 'GET',
	params: { course: props.course, artifact: props.doc.artifact },
	auto: false,
})
const data = computed(
	() => (document.data as { data?: DocumentData } | null)?.data ?? null
)
const register = computed(
	() => Object.values(data.value?.tables ?? {}).find(isSharedTable) ?? null
)
const hasRegister = computed(() => Boolean(register.value) || !data.value)
const review = computed(() => {
	if (!register.value || !data.value) return null
	const dates = registerDates(register.value, data.value)
	return dates.find((d) => /review/.test(d.key)) ?? dates[0] ?? null
})
watch(
	finished,
	(done) => {
		if (done) document.fetch()
	},
	{ immediate: true }
)

const open = (view?: string) => ({
	name: 'Document',
	params: {
		courseName: props.course,
		artifact: props.doc.artifact,
		...(view ? { view } : {}),
	},
})
</script>
