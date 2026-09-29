<template>
	<nav class="program-map" :aria-label="__('Lessons of the course')">
		<!-- A chapter is a group of dots, not a heading: its title is on the slide
		(learning-services#326), and a hover names the group. No gap between the
		groups: the dots are the lessons in a row (learning-services#402). -->
		<div
			v-for="chapter in chapters"
			:key="chapter.index"
			class="flex items-center"
			:title="chapter.title"
			data-testid="map-chapter"
		>
			<button
				v-for="lesson in chapter.lessons"
				:key="lesson.id"
				type="button"
				class="dot-button group"
				:aria-label="labelOf(lesson)"
				:aria-current="lesson.index === current ? 'step' : undefined"
				:data-status="lesson.status"
				:data-next="lesson.id === nextLesson ? '' : undefined"
				@click="$emit('select', lesson.index)"
			>
				<span class="dot" :class="dotClass(lesson)">
					<svg
						v-if="lesson.status !== 'completed'"
						class="dot-ring"
						viewBox="0 0 32 32"
						aria-hidden="true"
					>
						<circle class="dot-ring-track" cx="16" cy="16" :r="RADIUS" />
						<circle
							v-if="lesson.coverage > 0"
							class="dot-ring-fill"
							cx="16"
							cy="16"
							:r="RADIUS"
							:stroke-dasharray="`${
								lesson.coverage * CIRCUMFERENCE
							} ${CIRCUMFERENCE}`"
						/>
					</svg>
					<span
						v-if="lesson.status === 'completed'"
						class="lucide-check size-3.5"
						aria-hidden="true"
					/>
					<span v-else aria-hidden="true">{{ lesson.number }}</span>
				</span>
				<span
					class="current-bar"
					:class="{ 'is-current': lesson.index === current }"
					aria-hidden="true"
				/>
			</button>
		</div>
	</nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
	coverage,
	lessonStatus,
	topicCount,
	type LessonStatus,
	type ProgramChapter,
} from '@/utils/courseProgram'

const props = defineProps<{
	chapters: ProgramChapter[]
	nextLesson?: string | null
	current: number
}>()

defineEmits<{ select: [index: number] }>()

const RADIUS = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

type MapLesson = {
	id: string
	index: number
	number: number
	title: string
	status: LessonStatus
	coverage: number
	covered: number
	total: number
}

// Numbered straight through the course, so a dot's index is its slide.
const chapters = computed(() => {
	let index = 0
	return props.chapters.map((chapter, chapterIndex) => ({
		index: chapterIndex,
		title: chapter.title,
		lessons: chapter.lessons.map((lesson): MapLesson => {
			const { covered, total } = topicCount(lesson.objectives)
			return {
				id: lesson.id,
				index: index++,
				number: lesson.number,
				title: lesson.title,
				status: lessonStatus(lesson, props.nextLesson),
				coverage: coverage(lesson.objectives),
				covered,
				total,
			}
		}),
	}))
})

const STATUS_LABELS: Record<LessonStatus, string> = {
	completed: 'passed',
	'in-progress': 'in progress',
	next: 'up next',
	ahead: 'ahead',
	none: '',
}

// A screen reader gets what the eye does: which lesson, its status and how many
// of its topics are covered. The ring says nothing to it.
function labelOf(lesson: MapLesson): string {
	const parts = [`${__('Lesson')} ${lesson.number}. ${lesson.title}`]
	if (lesson.status !== 'none') parts.push(__(STATUS_LABELS[lesson.status]))
	if (lesson.status !== 'none' && lesson.total)
		parts.push(
			__('{0} of {1} topics').format(
				String(lesson.covered),
				String(lesson.total)
			)
		)
	return parts.join(' — ')
}

function dotClass(lesson: MapLesson): string[] {
	const classes: string[] = []
	if (lesson.status === 'completed') classes.push('dot-done')
	else classes.push('text-ink-gray-7')
	if (lesson.id === props.nextLesson && lesson.status !== 'completed')
		classes.push('dot-next')
	return classes
}
</script>

<style scoped>
.program-map {
	display: flex;
	flex-wrap: wrap;
	row-gap: 0.5rem;
}

/* 44px to tap, 28px to see: the button is the target, the dot is the mark. */
.dot-button {
	position: relative;
	display: grid;
	place-items: center;
	width: 2.75rem;
	height: 2.75rem;
	border-radius: 9999px;
}

.dot-button:focus-visible {
	outline: 2px solid var(--outline-gray-4, currentColor);
	outline-offset: -2px;
}

.dot {
	position: relative;
	display: grid;
	place-items: center;
	width: 1.75rem;
	height: 1.75rem;
	border-radius: 9999px;
	font-size: 0.8125rem;
	font-weight: 500;
	font-variant-numeric: tabular-nums;
}

.dot-button:hover .dot {
	background-color: var(--surface-gray-2);
}

.dot-done,
.dot-button:hover .dot-done {
	background-color: var(--surface-green-7);
	/* White on the mid green holds in both themes; the theme has no white ink. */
	color: #fff;
}

.dot-next {
	box-shadow: 0 0 0 2px var(--outline-green-5, currentColor);
}

.dot-ring {
	position: absolute;
	inset: 0;
	transform: rotate(-90deg);
}

.dot-ring-track {
	fill: none;
	stroke: var(--outline-gray-2);
	stroke-width: 2.5;
}

.dot-ring-fill {
	fill: none;
	stroke: var(--ink-green-5);
	stroke-width: 2.5;
	stroke-linecap: round;
}

.current-bar {
	position: absolute;
	bottom: 0.125rem;
	width: 1rem;
	height: 2px;
	border-radius: 9999px;
	background-color: var(--ink-gray-9);
	opacity: 0;
}

.current-bar.is-current {
	opacity: 1;
}
</style>
