<template>
	<article
		class="flex h-full flex-col rounded-lg border bg-surface-base p-5"
		:aria-label="
			__('Lesson {0} of {1}').format(String(position), String(total))
		"
	>
		<div
			class="flex items-center justify-between gap-3 text-p-sm text-ink-gray-5"
		>
			<span class="truncate">
				{{ lesson.chapter }} ·
				{{ __('lesson {0} of {1}').format(String(position), String(total)) }}
			</span>
			<span
				v-if="statusLabel"
				data-testid="slide-status"
				class="shrink-0 rounded-full px-2 py-0.5 text-p-xs font-medium"
				:class="statusClass"
				>{{ statusLabel }}</span
			>
		</div>

		<!-- The chapter is a group of dots on the map; what it is about and how
		far the student is in it live on its lessons' slides (#326, #547). -->
		<div
			v-if="chapter && (chapter.description || progress)"
			class="mt-1 space-y-0.5"
			data-testid="slide-chapter"
		>
			<p
				v-if="chapter.description"
				class="line-clamp-2 text-p-sm text-ink-gray-6"
				:title="chapter.description"
				data-testid="slide-chapter-description"
			>
				{{ chapter.description }}
			</p>
			<p
				v-if="progress"
				class="text-p-xs tabular-nums"
				:class="progress.done ? 'text-ink-green-6' : 'text-ink-gray-5'"
				data-testid="slide-chapter-progress"
			>
				{{
					progress.done
						? __('Chapter passed')
						: __('Chapter: {0} of {1} lessons passed').format(
								String(progress.passed),
								String(progress.total)
						  )
				}}
			</p>
		</div>

		<h3 class="mt-2 text-xl-semibold text-ink-gray-9">
			{{ lesson.title }}
		</h3>

		<p
			v-if="lesson.hook"
			data-testid="slide-hook"
			class="mt-2 text-p-base text-ink-gray-7 whitespace-pre-line"
		>
			{{ lesson.hook }}
		</p>

		<LessonObjectives
			class="mt-5"
			:objectives="lesson.objectives"
			:showStatus="status !== 'none'"
			:limit="FIRST_TOPICS"
		/>

		<LessonBlocks
			v-if="lesson.blocks?.length"
			class="mt-4"
			:blocks="lesson.blocks"
			:courseName="courseName"
			:linked="status !== 'none'"
		/>

		<!-- A way to the lesson, not a second call to action: the course card
		holds the one button (learning-services#326). -->
		<div class="mt-auto pt-5">
			<a
				:href="safeUrl(lessonUrl)"
				data-testid="slide-action"
				class="inline-flex items-center gap-1 text-p-sm font-medium text-ink-gray-8 hover:text-ink-gray-9"
			>
				{{ __('Open lesson') }}
				<span class="lucide-arrow-right size-4" aria-hidden="true" />
			</a>
		</div>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LessonBlocks from '@/components/Documents/LessonBlocks.vue'
import LessonObjectives from '@/components/CourseProgram/LessonObjectives.vue'
import { safeUrl } from '@/utils/safeUrl'
import {
	chapterProgress,
	type LessonStatus,
	type ProgramChapter,
	type ProgramLesson,
} from '@/utils/courseProgram'

const props = defineProps<{
	lesson: ProgramLesson & { chapter: string }
	status: LessonStatus
	position: number
	total: number
	/** The lesson page: it offers the way in, or a log-in or enrolment. */
	lessonUrl: string
	/** For the links to the document's blocks this lesson builds (#340). */
	courseName: string
	/** The lesson's chapter: its description and the student's progress (#547). */
	chapter?: ProgramChapter
}>()

// Six fit a slide without pushing the button off a laptop screen.
const FIRST_TOPICS = 6

const progress = computed(() =>
	props.chapter ? chapterProgress(props.chapter) : null
)

const statusLabel = computed(() => {
	switch (props.status) {
		case 'completed':
			return __('Lesson passed')
		case 'in-progress':
			return __('In progress')
		case 'next':
			return __('Up next')
		default:
			return ''
	}
})

const statusClass = computed(() =>
	props.status === 'completed' || props.status === 'next'
		? 'bg-surface-green-2 text-ink-green-8'
		: 'bg-surface-gray-2 text-ink-gray-7'
)
</script>
