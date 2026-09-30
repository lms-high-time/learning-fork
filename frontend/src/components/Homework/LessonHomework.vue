<template>
	<section
		v-if="homework"
		id="homework"
		class="px-5 pb-10"
		data-testid="lesson-homework"
	>
		<div class="max-w-xl space-y-4 border-t border-outline-gray-1 pt-6">
			<header class="space-y-1">
				<div class="text-p-sm text-ink-gray-5">{{ __('Lesson homework') }}</div>
				<div class="flex items-start justify-between gap-3">
					<h2 class="text-xl-semibold text-ink-gray-9">
						{{ homework.title }}
					</h2>
					<span
						class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-p-xs font-medium"
						:class="STATUS_CLASSES[submission?.status ?? 'none']"
						data-testid="homework-status"
						>{{ statusLabel(submission?.status) }}</span
					>
				</div>
				<div class="text-p-sm text-ink-gray-6">
					{{ dueLabel(homework.due, submission?.due_at) }}
					<span
						v-if="submission?.overdue"
						class="font-medium text-ink-red-7"
						data-testid="homework-overdue"
						>· {{ __('Overdue') }}</span
					>
				</div>
			</header>

			<div
				v-if="homework.description"
				v-safe-html:rich="render(homework.description)"
				class="prose prose-sm max-w-none text-ink-gray-8"
			/>

			<!-- The tutor's word comes first: it is what the learner acts on. -->
			<div
				v-if="submission?.status === 'Returned' && comment"
				class="rounded-md bg-surface-amber-1 px-3 py-2 text-p-sm text-ink-amber-8"
				data-testid="homework-comment"
			>
				<div class="font-medium">{{ __("Tutor's comment") }}</div>
				<p class="mt-1 whitespace-pre-line">{{ comment }}</p>
			</div>

			<!-- Accepted: the verdict, and the answer as it was accepted. -->
			<template v-if="!editable && submission">
				<p
					class="text-p-sm font-medium text-ink-green-8"
					data-testid="homework-accepted"
				>
					{{ acceptedLine }}
				</p>
				<p
					v-if="submission.answer"
					class="whitespace-pre-line text-p-sm text-ink-gray-8"
				>
					{{ submission.answer }}
				</p>
				<HomeworkFiles :files="submission.files" />
			</template>

			<form v-else class="space-y-3" @submit.prevent="send">
				<textarea
					v-if="textAllowed"
					v-model="draft"
					rows="6"
					class="w-full rounded-md border border-outline-gray-2 p-3 text-p-sm leading-relaxed text-ink-gray-9"
					:aria-label="__('Your answer')"
					:placeholder="__('Your answer')"
				/>

				<div v-if="filesAllowed" class="space-y-2">
					<ul v-if="keptFiles.length || added.length" class="space-y-1">
						<li
							v-for="file in keptFiles"
							:key="file.id"
							class="flex items-center justify-between gap-3 text-p-sm"
						>
							<a
								:href="safeUrl(file.url)"
								download
								class="min-w-0 truncate font-medium text-ink-gray-8 underline underline-offset-2"
								>{{ file.name }}</a
							>
							<button
								type="button"
								class="shrink-0 text-ink-gray-5 hover:text-ink-gray-8"
								:data-testid="`homework-remove-${file.id}`"
								:aria-label="__('Detach {0}').format(file.name)"
								@click="removed.push(file.id)"
							>
								{{ __('Detach') }}
							</button>
						</li>
						<li
							v-for="(file, index) in added"
							:key="`new-${index}`"
							class="flex items-center justify-between gap-3 text-p-sm"
						>
							<span class="min-w-0 truncate text-ink-gray-8">
								{{ file.name }}
								<span class="text-ink-gray-5">{{ formatSize(file.size) }}</span>
							</span>
							<button
								type="button"
								class="shrink-0 text-ink-gray-5 hover:text-ink-gray-8"
								:aria-label="__('Detach {0}').format(file.name)"
								@click="added.splice(index, 1)"
							>
								{{ __('Detach') }}
							</button>
						</li>
					</ul>
					<!-- The input is hidden; the ring shows where keyboard focus is. -->
					<label
						class="inline-flex cursor-pointer rounded focus-within:ring-2 focus-within:ring-outline-gray-3"
					>
						<input type="file" multiple class="sr-only" @change="onFiles" />
						<span
							class="rounded bg-surface-gray-2 px-3 py-1.5 text-p-sm font-medium text-ink-gray-8"
						>
							{{ __('Attach files') }}
						</span>
					</label>
					<p
						v-if="tooLarge"
						id="homework-too-large"
						role="alert"
						class="text-p-sm text-ink-red-7"
						data-testid="homework-too-large"
					>
						{{
							__('New files add up to more than {0} MB. Attach fewer at a time.').format(
								SAVE_LIMIT_MB
							)
						}}
					</p>
				</div>

				<Button
					type="submit"
					variant="solid"
					:label="submitted ? __('Save') : __('Hand in')"
					:loading="saving"
					:disabled="tooLarge || empty || saving"
					:aria-describedby="tooLarge ? 'homework-too-large' : undefined"
				/>
			</form>

			<details v-if="submission?.history?.length" class="text-p-sm">
				<summary class="cursor-pointer text-ink-gray-6">
					{{ __('History') }}
				</summary>
				<ul class="mt-2 space-y-2">
					<li
						v-for="(row, index) in submission.history"
						:key="index"
						class="text-ink-gray-7"
					>
						<span class="font-medium text-ink-gray-8">{{
							eventLabel(row.event)
						}}</span>
						· {{ whoLabel(row, me) }} · {{ formatMoment(row.at) }}
						<span v-if="row.version">
							· {{ __('version {0}').format(row.version) }}</span
						>
						<p v-if="row.comment" class="mt-0.5 whitespace-pre-line">
							{{ row.comment }}
						</p>
					</li>
				</ul>
			</details>

			<details v-if="submission?.versions?.length" class="text-p-sm">
				<summary class="cursor-pointer text-ink-gray-6">
					{{ __('Versions') }}
				</summary>
				<div class="mt-2 space-y-2">
					<details
						v-for="version in versionsNewestFirst"
						:key="version.version"
					>
						<summary class="cursor-pointer text-ink-gray-7">
							{{ __('Version {0}').format(version.version) }} ·
							{{ formatMoment(version.saved_at) }}
						</summary>
						<div class="mt-1 space-y-1 ps-4">
							<p
								v-if="version.answer"
								class="whitespace-pre-line text-ink-gray-8"
							>
								{{ version.answer }}
							</p>
							<HomeworkFiles :files="version.files" />
						</div>
					</details>
				</div>
			</details>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { Button } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import HomeworkFiles from '@/components/Homework/HomeworkFiles.vue'
import { useHomework } from '@/composables/useHomework'
import { safeUrl } from '@/utils/safeUrl'
import {
	canEdit,
	dueLabel,
	eventLabel,
	formatMoment,
	formatSize,
	isFilesAllowed,
	isTextAllowed,
	lastComment,
	lastEvent,
	newFilesTooLarge,
	SAVE_LIMIT_MB,
	statusLabel,
	STATUS_CLASSES,
	whoLabel,
} from '@/utils/homework'

// The homework under a lesson (learning-services#439): the author's
// assignment, and the learner's answer in the chosen space. One save — text,
// removed files and new ones together — is one version.

const props = defineProps<{ lesson: string; course: string }>()

const { homework, submission, saving, save } = useHomework(
	toRef(props, 'lesson'),
	toRef(props, 'course')
)

// The reader, named «You» in the journal.
const session = sessionStore()
const me = computed(() => session.user as string | null)

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)

const textAllowed = computed(() =>
	homework.value ? isTextAllowed(homework.value.answer_mode) : false
)
const filesAllowed = computed(() =>
	homework.value ? isFilesAllowed(homework.value.answer_mode) : false
)
const editable = computed(() => canEdit(submission.value?.status))
const submitted = computed(() => Boolean(submission.value?.version))
const comment = computed(() => lastComment(submission.value?.history ?? []))

const acceptedLine = computed(() => {
	const row = lastEvent(submission.value?.history ?? [], 'accepted')
	return [
		__('Accepted'),
		row ? whoLabel(row, me.value) : null,
		row?.at ? formatMoment(row.at) : null,
	]
		.filter(Boolean)
		.join(' · ')
})

// The form: what the learner is about to save.
const draft = ref('')
const removed = ref<string[]>([])
const added = ref<File[]>([])

const keptFiles = computed(() =>
	(submission.value?.files ?? []).filter(
		(file) => !removed.value.includes(file.id)
	)
)
const tooLarge = computed(() => newFilesTooLarge(added.value))
// Nothing to hand in: no text, no file kept, none added.
const empty = computed(
	() =>
		!(textAllowed.value && draft.value.trim()) &&
		!keptFiles.value.length &&
		!added.value.length
)

const versionsNewestFirst = computed(() =>
	[...(submission.value?.versions ?? [])].reverse()
)

// A fresh read — another lesson, or the answer just saved — resets the form.
watch(
	[
		() => props.lesson,
		() => submission.value?.id,
		() => submission.value?.version,
	],
	() => {
		draft.value = submission.value?.answer ?? ''
		removed.value = []
		added.value = []
	},
	{ immediate: true }
)

// «Homework» links here with `#homework`. The router does not scroll to a hash,
// and the block appears only once its read answers, so it scrolls itself.
watch(homework, (value, before) => {
	if (!value || before || window.location.hash !== '#homework') return
	nextTick(() =>
		document
			.getElementById('homework')
			?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
	)
})

function onFiles(event: Event) {
	const input = event.target as HTMLInputElement
	added.value.push(...Array.from(input.files ?? []))
	input.value = ''
}

async function send() {
	if (tooLarge.value || empty.value || saving.value) return
	await save({
		answer: textAllowed.value ? draft.value : undefined,
		removeFiles: filesAllowed.value ? [...removed.value] : [],
		files: filesAllowed.value ? [...added.value] : [],
	})
}
</script>
