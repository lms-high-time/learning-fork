<template>
	<div class="px-5 pt-8 sm:pt-5 pb-10">
		<div class="max-w-xl">
			<div class="text-p-sm text-ink-gray-5">
				{{ __('This lesson is a conversation with an agent') }}
			</div>
			<h1 class="mt-1 text-4xl-semibold text-ink-gray-9">
				{{ title }}
			</h1>
			<div
				v-if="entry.completed"
				data-testid="lesson-completed"
				class="mt-3 inline-flex items-center gap-1.5 text-p-sm-medium text-ink-green-3"
			>
				<span class="lucide-circle-check size-4" aria-hidden="true" />
				{{ __('Lesson completed') }}
			</div>
			<p
				v-if="entry.hook"
				data-testid="lesson-hook"
				class="mt-5 text-p-base text-ink-gray-8 whitespace-pre-line"
			>
				{{ entry.hook }}
			</p>

			<!-- The course is shut by a program in set order: the way on is the
			previous course, not a session the server would refuse (#405). -->
			<div
				v-if="entry.program_lock"
				data-testid="lesson-program-lock"
				class="mt-8 flex flex-col items-start gap-2"
			>
				<div class="text-p-base text-ink-gray-8">
					{{
						__('The program «{0}» goes in order: first pass «{1}».').format(
							entry.program_lock.program_title,
							entry.program_lock.previous.title
						)
					}}
				</div>
				<router-link
					:to="{
						name: 'CourseDetail',
						params: { courseName: entry.program_lock.previous.id },
					}"
				>
					<Button variant="solid" size="md">
						{{ __('Go to «{0}»').format(entry.program_lock.previous.title) }}
					</Button>
				</router-link>
			</div>

			<div v-else class="mt-8 flex flex-col items-start gap-2">
				<a :href="safeUrl(entry.study.url)" data-testid="lesson-study">
					<Button variant="solid" size="md">
						{{ primaryLabel }}
					</Button>
				</a>
				<div class="text-p-sm text-ink-gray-6">
					{{ primaryHint }}
				</div>
			</div>

			<LessonBlocks
				v-if="entry.blocks?.length"
				class="mt-6"
				:blocks="entry.blocks"
				:courseName="entry.course"
				:linked="entry.blocks.some((b) => b.filled !== undefined)"
				:label="__('In this session you build:')"
			/>

			<div v-if="inWebChat" class="mt-6 text-p-sm text-ink-gray-6">
				{{ __('Have your own AI agent?') }}
				<router-link
					:to="{ name: 'Agent' }"
					data-testid="lesson-own-agent"
					class="text-ink-gray-8 underline"
					>{{ __('Connect it') }}</router-link
				>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from 'frappe-ui'
import { safeUrl } from '@/utils/safeUrl'
import LessonBlocks from '@/components/Documents/LessonBlocks.vue'
import type { ProgramBlock } from '@/utils/courseProgram'

// What lms_frappe_app.api.public.lesson_entry answers. A lesson on this
// platform is taught by an agent, so the page shows the way into that lesson
// instead of the material: the material is written for the agent, not for
// reading alone.
export interface LessonEntryData {
	course: string
	title: string
	hook: string | null
	completed: boolean
	study: {
		// `web` — the platform's web chat on this lesson; `agent` — the page
		// that explains how to connect one's own agent.
		channel: 'web' | 'agent'
		url: string
		demo_left: number
	}
	/** The document blocks this lesson builds (#340). */
	blocks?: ProgramBlock[]
	/** A program in set order that keeps this course shut (#405). */
	program_lock?: {
		program: string
		program_title: string
		previous: { id: string; title: string }
	} | null
}

const props = defineProps<{
	entry: LessonEntryData
	title: string
}>()

const inWebChat = computed(() => props.entry.study.channel === 'web')

const primaryLabel = computed(() => {
	if (!inWebChat.value) return __('Connect your agent')
	return props.entry.completed
		? __('Repeat with the agent')
		: __('Study with the agent')
})

const primaryHint = computed(() => {
	if (!inWebChat.value)
		return __(
			'Trial lessons in the browser are used up. Lessons continue with your own agent, and your progress is kept.'
		)
	if (props.entry.study.demo_left > 0)
		return __('In the browser, trial lessons left: {0}').format(
			props.entry.study.demo_left
		)
	return __('In the browser, with the platform agent')
})
</script>
