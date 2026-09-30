<template>
	<div class="space-y-5">
		<router-link
			:to="{ name: 'Homework', query: { tab: 'queue' } }"
			class="inline-flex items-center gap-1 text-p-sm text-ink-gray-6 hover:text-ink-gray-9"
			data-testid="review-back"
		>
			<span
				class="lucide-arrow-left size-4 rtl:rotate-180"
				aria-hidden="true"
			/>
			{{ __('Awaiting review') }}
		</router-link>

		<div
			v-if="state === 'loading'"
			class="flex justify-center py-10"
			data-testid="review-loading"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="state === 'error' || !card"
			class="text-p-base text-ink-gray-6"
			role="alert"
			data-testid="review-error"
		>
			{{ failure }}
		</p>

		<article v-else class="space-y-5" data-testid="review-card">
			<header class="space-y-1">
				<div class="flex items-start justify-between gap-3">
					<h2
						ref="heading"
						tabindex="-1"
						class="text-xl-semibold text-ink-gray-9 focus:outline-none"
						data-testid="review-title"
					>
						{{ title }}
					</h2>
					<span
						class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-p-xs font-medium"
						:class="STATUS_CLASSES[card.submission.status]"
						>{{ statusLabel(card.submission.status) }}</span
					>
				</div>
				<div class="text-p-base font-medium text-ink-gray-8">
					{{ studentName(card.student) }}
				</div>
				<div class="text-p-sm text-ink-gray-6">
					<router-link
						v-if="lessonLink"
						:to="lessonLink"
						class="underline underline-offset-2 hover:text-ink-gray-9"
						data-testid="review-lesson"
						>{{ place }}</router-link
					>
					<span v-else>{{ place }}</span>
					<span v-if="card.organization_title">
						· {{ card.organization_title }}</span
					>
				</div>
				<div class="text-p-sm text-ink-gray-6">
					<span v-if="card.submission.submitted_at">{{
						__('Submitted {0}').format(
							formatMoment(card.submission.submitted_at)
						)
					}}</span>
					<span v-if="due"> · {{ due }}</span>
					<span
						v-if="card.submission.overdue"
						class="font-medium text-ink-red-7"
						>· {{ __('Overdue') }}</span
					>
				</div>
			</header>

			<details v-if="card.homework?.description" class="text-p-sm">
				<summary class="cursor-pointer text-ink-gray-6">
					{{ __('The assignment') }}
				</summary>
				<div
					v-safe-html:rich="render(card.homework.description)"
					class="prose prose-sm mt-2 max-w-none text-ink-gray-8"
				/>
			</details>

			<section class="space-y-2">
				<h3 class="text-p-sm font-medium text-ink-gray-6">
					{{
						card.submission.version
							? __('Answer, version {0}').format(card.submission.version)
							: __('The answer')
					}}
				</h3>
				<p
					v-if="card.submission.answer"
					class="whitespace-pre-line break-words text-p-base text-ink-gray-9"
					data-testid="review-answer"
				>
					{{ card.submission.answer }}
				</p>
				<p v-else class="text-p-sm text-ink-gray-5">
					{{ __('No text in the answer') }}
				</p>
				<HomeworkFiles :files="card.submission.files" />
			</section>

			<HomeworkDiff
				v-if="reviewed"
				:reviewed="reviewed"
				:answer="card.submission.answer"
				:files="card.submission.files"
			/>

			<div
				v-if="card.actions.length"
				class="flex flex-wrap gap-2"
				data-testid="review-actions"
			>
				<Button
					v-if="card.actions.includes('accept')"
					variant="solid"
					:label="__('Accept')"
					:loading="acting && pendingAction === 'accept'"
					:disabled="acting"
					@click="accept"
				/>
				<Button
					v-if="card.actions.includes('send_back')"
					:label="__('Return for revision')"
					:disabled="acting"
					@click="dialog = 'send_back'"
				/>
				<Button
					v-if="card.actions.includes('reopen')"
					:label="__('Cancel acceptance')"
					:disabled="acting"
					@click="dialog = 'reopen'"
				/>
			</div>

			<HomeworkHistory :history="card.submission.history" :me="me" />
			<HomeworkVersions :versions="card.submission.versions ?? []" />
		</article>

		<HomeworkReturnDialog
			v-model:comment="comments.send_back"
			:open="dialog === 'send_back'"
			:title="__('Return for revision')"
			:message="
				__(
					'Write what to fix. The learner will see the comment under the lesson.'
				)
			"
			:label="__('Return')"
			:send="(comment: string) => act('send_back', comment)"
			@update:open="(value: boolean) => !value && (dialog = null)"
		/>
		<HomeworkReturnDialog
			v-model:comment="comments.reopen"
			:open="dialog === 'reopen'"
			:title="__('Cancel acceptance')"
			:message="
				__(
					'The homework goes back to the learner for revision, with your comment.'
				)
			"
			:label="__('Cancel acceptance')"
			:send="(comment: string) => act('reopen', comment)"
			@update:open="(value: boolean) => !value && (dialog = null)"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, toRef, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { Button, LoadingIndicator } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import HomeworkDiff from '@/components/Homework/HomeworkDiff.vue'
import HomeworkFiles from '@/components/Homework/HomeworkFiles.vue'
import HomeworkHistory from '@/components/Homework/HomeworkHistory.vue'
import HomeworkReturnDialog from '@/components/Homework/HomeworkReturnDialog.vue'
import HomeworkVersions from '@/components/Homework/HomeworkVersions.vue'
import {
	useReviewCard,
	type ReviewOutcome,
} from '@/composables/useHomeworkReview'
import {
	dueLabel,
	formatMoment,
	lessonPath,
	statusLabel,
	studentName,
	STATUS_CLASSES,
	type ReviewAction,
} from '@/utils/homework'

// One submission for the tutor (learning-services#452): the assignment, the
// answer, what changed since the last review, the versions and the journal,
// and the actions the server offers now. None — the card is read-only: one's
// own submission, an archived one, or one the reader may only see.

const props = defineProps<{ submission: string }>()

const {
	card,
	state,
	failure,
	acting,
	act: send,
} = useReviewCard(toRef(props, 'submission'))

const session = sessionStore()
const me = computed(() => session.user as string | null)

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)

// The assignment may be gone; the answer to it is still the learner's.
const title = computed(
	() =>
		card.value?.homework?.title || card.value?.lesson_title || __('Homework')
)
const due = computed(() => {
	const value = card.value
	if (!value) return null
	if (value.homework)
		return dueLabel(value.homework.due, value.submission.due_at)
	return value.submission.due_at
		? dueLabel(
				{ mode: 'none', days: null, date: null },
				value.submission.due_at
		  )
		: null
})

const place = computed(() =>
	[card.value?.course_title || card.value?.course, card.value?.lesson_title]
		.filter(Boolean)
		.join(' · ')
)
// The lesson itself: its homework block is the tutor's own, not this one.
const lessonLink = computed(
	() => lessonPath(card.value?.lesson_url)?.replace(/#homework$/, '') ?? null
)

// The version the tutor last reviewed, when the learner has changed it since.
const reviewed = computed(() => {
	const value = card.value
	if (!value?.reviewed_version) return null
	if (value.reviewed_version === value.submission.version) return null
	return (
		value.submission.versions?.find(
			(item) => item.version === value.reviewed_version
		) ?? null
	)
})

// A screen reader lands on the card's title when a card comes, and when an
// action changed it.
const heading = ref<HTMLElement | null>(null)
const focusHeading = () => nextTick(() => heading.value?.focus())
watch(
	() => (state.value === 'ready' ? card.value?.submission.id : null),
	(id) => id && focusHeading()
)

const dialog = ref<'send_back' | 'reopen' | null>(null)
// The comments being written: kept until the action is done.
const comments = reactive({ send_back: '', reopen: '' })
const pendingAction = ref<ReviewAction | null>(null)

// A dialog whose action the card no longer offers has nothing to do.
watch(
	() => card.value?.actions,
	(actions) => {
		if (dialog.value && !actions?.includes(dialog.value)) dialog.value = null
	}
)

async function act(
	action: ReviewAction,
	comment?: string
): Promise<ReviewOutcome> {
	pendingAction.value = action
	try {
		const outcome = await send(action, comment)
		if (outcome === 'done' && action !== 'accept') comments[action] = ''
		if (outcome !== 'refused') focusHeading()
		return outcome
	} finally {
		pendingAction.value = null
	}
}

const accept = () => act('accept')
</script>
