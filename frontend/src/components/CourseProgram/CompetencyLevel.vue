<template>
	<!-- Where an enrolled student stands in a skill, in the words of the scale
	and with no numbers (learning-services#857): ahead, not checked yet, or the
	level shown, ticked once it reaches what the course aims for. Nothing for
	a visitor, nor for a skill the course does not lead on its own. -->
	<span
		v-if="label"
		class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-p-xs font-medium"
		:class="
			reached
				? 'bg-surface-green-2 text-ink-green-8'
				: 'bg-surface-gray-2 text-ink-gray-7'
		"
		data-testid="competency-level"
	>
		<!-- Read after the skill's title, «Ahead» alone says nothing. -->
		<span class="sr-only">{{ __('Your level:') }} </span>
		<span v-if="reached" class="lucide-check size-3.5" aria-hidden="true" />
		{{ label }}
		<span v-if="reached" class="sr-only" data-testid="competency-goal"
			>— {{ __('course goal reached') }}</span
		>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CourseCompetency } from '@/utils/courseProgram'

const props = defineProps<{
	competency: CourseCompetency
}>()

// The methodology's scale: 1 recognises, 2 explains, 3 applies, 4 transfers
// (course-design/docs/catalog-format.md), said to the student.
const LEVELS: Record<number, () => string> = {
	1: () => __('You recognise it'),
	2: () => __('You explain it'),
	3: () => __('You apply it'),
	4: () => __('You transfer it'),
}

const label = computed<string | null>(() => {
	const { status, level } = props.competency
	if (status === 'locked') return __('Ahead in the course')
	if (status === 'no_info') return __('Not checked yet')
	if (status === 'level' && level && LEVELS[level]) return LEVELS[level]()
	return null
})

const reached = computed<boolean>(() => {
	const { status, level, target } = props.competency
	return status === 'level' && Boolean(level && target && level >= target)
})
</script>
