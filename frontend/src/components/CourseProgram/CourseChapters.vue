<template>
	<!-- The programme as a list of chapters, in place of the lesson map and the
	slider: the course's shape at a glance, the student's chapter open and the
	next lesson marked; a lesson's topics and document blocks open under it
	(learning-services#636). -->
	<section
		data-testid="course-chapters"
		aria-labelledby="course-chapters-title"
	>
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-4">
			<h2 id="course-chapters-title" class="text-3xl-semibold text-ink-gray-9">
				{{ __('Course program') }}
			</h2>
			<span class="text-base text-ink-gray-6">{{ stats }}</span>
		</div>
		<ol class="divide-y divide-outline-gray-2 border-y border-outline-gray-2">
			<li
				v-for="(chapter, chapterIndex) in program.chapters"
				:key="chapterIndex"
			>
				<details
					class="group/chapter"
					:open="openChapters.includes(chapterIndex)"
					data-testid="course-chapter"
					@toggle="toggleChapter(chapterIndex, $event)"
				>
					<!-- Named by its title and count: the description under it is
					read, not announced as the button's name. -->
					<summary
						:aria-labelledby="`chapter-${chapterIndex}-title chapter-${chapterIndex}-count`"
						class="grid cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 rounded py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-blue-6 [&::-webkit-details-marker]:hidden"
					>
						<span
							class="flex size-8 items-center justify-center rounded-full text-p-sm font-semibold tabular-nums"
							:class="chapterMarkClass(chapter, chapterIndex)"
							aria-hidden="true"
						>
							<span
								v-if="progressOf(chapter)?.done"
								class="lucide-check size-4"
							/>
							<template v-else>{{ chapterIndex + 1 }}</template>
						</span>
						<span class="min-w-0 pt-1">
							<span
								:id="`chapter-${chapterIndex}-title`"
								class="block text-lg-semibold text-ink-gray-9"
							>
								{{ chapter.title }}
							</span>
							<!-- What a chapter is about helps a visitor decide; a student
							reads it on the chapter they open — seven paragraphs of
							it hid the list (learning-services#636). -->
							<span
								v-if="chapter.description"
								class="mt-1 text-p-base text-ink-gray-6"
								:class="enrolled ? 'hidden group-open/chapter:block' : 'block'"
							>
								{{ chapter.description }}
							</span>
						</span>
						<span
							class="flex items-center gap-2 pt-1.5 text-p-sm tabular-nums text-ink-gray-6"
						>
							<span data-testid="chapter-count" aria-hidden="true">{{
								countOf(chapter)
							}}</span>
							<span :id="`chapter-${chapterIndex}-count`" class="sr-only">{{
								countWords(chapter)
							}}</span>
							<span
								class="lucide-chevron-down size-4 text-ink-gray-5 transition-transform group-open/chapter:rotate-180 motion-reduce:transition-none"
								aria-hidden="true"
							/>
						</span>
					</summary>

					<ol class="pb-4 md:ps-11">
						<li
							v-for="(lesson, lessonIndex) in chapter.lessons"
							:key="lesson.id"
						>
							<details
								class="group/lesson"
								data-testid="course-lesson"
								:data-status="statusOf(lesson)"
							>
								<summary
									class="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-gray-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-blue-6 [&::-webkit-details-marker]:hidden"
								>
									<span
										class="flex size-5 shrink-0 items-center justify-center"
										aria-hidden="true"
									>
										<span
											v-if="statusOf(lesson) === 'completed'"
											class="lucide-circle-check size-5 text-ink-green-6"
										/>
										<span
											v-else-if="statusOf(lesson) === 'next'"
											class="lucide-circle-arrow-right size-5 text-ink-blue-7"
										/>
										<span
											v-else-if="statusOf(lesson) === 'in-progress'"
											class="lucide-circle-dashed size-5 text-ink-blue-7"
										/>
										<span
											v-else-if="statusOf(lesson) === 'ahead'"
											class="lucide-circle size-5 text-ink-gray-4"
										/>
										<span
											v-else
											class="text-p-sm tabular-nums text-ink-gray-5"
											>{{ lessonIndex + 1 }}</span
										>
									</span>
									<span
										class="min-w-0 flex-1 text-p-base"
										:class="
											statusOf(lesson) === 'next'
												? 'font-semibold text-ink-gray-9'
												: 'text-ink-gray-8'
										"
									>
										{{ lesson.title }}
										<span v-if="statusWord(lesson)" class="sr-only">
											— {{ statusWord(lesson) }}</span
										>
									</span>
									<span
										v-if="statusOf(lesson) === 'next'"
										class="shrink-0 rounded-full bg-surface-blue-2 px-2 py-0.5 text-p-xs font-medium text-ink-blue-7"
										aria-hidden="true"
									>
										{{ __('Up next') }}
									</span>
									<span
										v-else-if="statusOf(lesson) === 'in-progress'"
										class="shrink-0 text-p-xs text-ink-gray-6"
										aria-hidden="true"
									>
										{{ __('Lesson in progress') }}
									</span>
									<span
										class="lucide-chevron-down size-4 shrink-0 text-ink-gray-4 transition-transform group-open/lesson:rotate-180 motion-reduce:transition-none"
										aria-hidden="true"
									/>
								</summary>
								<div class="space-y-4 pb-4 pe-2 ps-10 pt-1">
									<p
										v-if="lesson.hook"
										class="max-w-prose whitespace-pre-line text-p-base text-ink-gray-7"
									>
										{{ lesson.hook }}
									</p>
									<LessonObjectives
										:objectives="lesson.objectives"
										:showStatus="enrolled"
									/>
									<LessonBlocks
										v-if="lesson.blocks?.length"
										:blocks="lesson.blocks"
										:courseName="courseName"
										:linked="enrolled"
									/>
									<a
										:href="safeUrl(lessonUrl(chapterIndex, lessonIndex))"
										data-testid="lesson-open"
										class="inline-flex min-h-11 items-center gap-1 text-p-base font-medium text-ink-blue-7 hover:underline"
									>
										{{ __('Open lesson') }}
										<span
											class="lucide-arrow-right size-4"
											aria-hidden="true"
										/>
									</a>
								</div>
							</details>
						</li>
					</ol>
				</details>
			</li>
		</ol>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LessonBlocks from '@/components/Documents/LessonBlocks.vue'
import LessonObjectives from '@/components/CourseProgram/LessonObjectives.vue'
import { safeUrl } from '@/utils/safeUrl'
import { CHAPTERS, LESSONS, plural } from '@/utils/plural'
import {
	chapterProgress,
	lessonStatus,
	openChapter,
	type LessonStatus,
	type ProgramChapter,
	type ProgramData,
	type ProgramLesson,
} from '@/utils/courseProgram'

const props = defineProps<{
	program: ProgramData
	courseName: string
}>()

const router = useRouter()

const enrolled = computed(() =>
	props.program.chapters.some((chapter) => chapter.status !== undefined)
)

const lessonCount = computed(() =>
	props.program.chapters.reduce(
		(sum, chapter) => sum + chapter.lessons.length,
		0
	)
)
const stats = computed(() =>
	[
		plural(props.program.chapters.length, CHAPTERS),
		plural(lessonCount.value, LESSONS),
	].join(' · ')
)

// The student's chapter opens; the rest stay folded until asked.
const first = openChapter(props.program.chapters, props.program.next_lesson)
const openChapters = ref<number[]>(first === null ? [] : [first])
// `toggle` also fires when the binding opened the chapter: only what the
// element says it is gets recorded.
const toggleChapter = (index: number, event: Event) => {
	const open = (event.target as HTMLDetailsElement).open
	if (open === openChapters.value.includes(index)) return
	openChapters.value = open
		? [...openChapters.value, index]
		: openChapters.value.filter((other) => other !== index)
}

const progressOf = (chapter: ProgramChapter) => chapterProgress(chapter)

const countOf = (chapter: ProgramChapter): string => {
	const progress = progressOf(chapter)
	if (!progress) return plural(chapter.lessons.length, LESSONS)
	return __('{0} of {1}').format(
		String(progress.passed),
		String(progress.total)
	)
}

// What the count says, in words, for a screen reader.
const countWords = (chapter: ProgramChapter): string => {
	const progress = progressOf(chapter)
	if (!progress) return plural(chapter.lessons.length, LESSONS)
	return __('Lessons passed: {0} of {1}').format(
		String(progress.passed),
		String(progress.total)
	)
}

const chapterMarkClass = (chapter: ProgramChapter, index: number): string => {
	const progress = progressOf(chapter)
	if (progress?.done) return 'bg-surface-green-2 text-ink-green-7'
	if (enrolled.value && index === first)
		return 'bg-surface-blue-2 text-ink-blue-7'
	return 'bg-surface-gray-2 text-ink-gray-7'
}

const statusOf = (lesson: ProgramLesson): LessonStatus =>
	lessonStatus(lesson, props.program.next_lesson)

const statusWord = (lesson: ProgramLesson): string => {
	switch (statusOf(lesson)) {
		case 'completed':
			return __('Lesson passed')
		case 'in-progress':
			return __('Lesson in progress')
		case 'next':
			return __('Up next')
		default:
			return ''
	}
}

// The lesson page offers the way in, or a log-in or enrolment to someone who
// cannot study yet.
const lessonUrl = (chapterIndex: number, lessonIndex: number): string =>
	router.resolve({
		name: 'Lesson',
		params: {
			courseName: props.courseName,
			chapterNumber: chapterIndex + 1,
			lessonNumber: lessonIndex + 1,
		},
	}).href
</script>
