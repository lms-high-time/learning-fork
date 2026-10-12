<template>
	<section v-if="objectives.length" data-testid="lesson-objectives">
		<component :is="heading" class="text-p-sm font-medium text-ink-gray-8">
			{{ __('Topics') }}
			<span
				v-if="showStatus"
				data-testid="slide-count"
				class="font-normal text-ink-gray-5"
			>
				·
				{{
					__('{0} of {1} covered').format(
						String(count.covered),
						String(count.total)
					)
				}}
			</span>
		</component>
		<ul class="mt-2 space-y-1.5">
			<li
				v-for="objective in visible"
				:key="objective.text"
				class="flex items-start gap-2 text-p-sm text-ink-gray-8"
				:data-status="objective.status || 'none'"
			>
				<span
					class="mt-px w-4 shrink-0 text-center"
					:class="markerClass(objective)"
					aria-hidden="true"
					>{{ marker(objective) }}</span
				>
				<span>
					{{ objective.text }}
					<span v-if="showStatus" class="sr-only">
						— {{ statusWord(objective) }}</span
					>
				</span>
			</li>
		</ul>
		<button
			v-if="hiddenCount"
			type="button"
			class="mt-2 text-p-sm text-ink-gray-6 underline underline-offset-2"
			@click="showAll = true"
		>
			{{ __('{0} more').format(String(hiddenCount)) }}
		</button>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { topicCount, type ProgramObjective } from '@/utils/courseProgram'

// A lesson's topics with how far each is covered: on the program's slide and
// on the lesson page alike (learning-services#322, #547).

const props = withDefaults(
	defineProps<{
		objectives: ProgramObjective[]
		/** The student's coverage: the count and each topic's status in words. */
		showStatus: boolean
		/** How many topics show before «N more»; all of them without it. */
		limit?: number
		heading?: 'h2' | 'h3' | 'h4'
	}>(),
	{ limit: undefined, heading: 'h4' }
)

const showAll = ref(false)

const count = computed(() => topicCount(props.objectives))
const visible = computed(() =>
	showAll.value || !props.limit
		? props.objectives
		: props.objectives.slice(0, props.limit)
)
const hiddenCount = computed(
	() => props.objectives.length - visible.value.length
)

function marker(objective: ProgramObjective): string {
	if (objective.status === 'covered') return '●'
	if (objective.status === 'touched') return '◐'
	return '○'
}

function markerClass(objective: ProgramObjective): string {
	if (objective.status === 'covered') return 'text-ink-green-6'
	if (objective.status === 'touched') return 'text-ink-green-5'
	return 'text-ink-gray-4'
}

function statusWord(objective: ProgramObjective): string {
	if (objective.status === 'covered') return __('covered')
	if (objective.status === 'touched') return __('touched in passing')
	return __('not yet')
}
</script>
