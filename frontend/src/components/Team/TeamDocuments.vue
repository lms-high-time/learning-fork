<template>
	<div class="space-y-5">
		<p v-if="!documentChoices.length" class="text-p-base text-ink-gray-6">
			{{ __('No course of this organization builds a document yet.') }}
		</p>
		<template v-else>
			<div class="flex flex-col gap-2 sm:flex-row">
				<FormControl
					v-model="picked"
					type="select"
					class="min-w-0 sm:flex-1"
					:options="documentChoices"
					:aria-label="__('Document')"
				/>
				<FormControl
					v-if="compared && compared.authors.length"
					v-model="person"
					type="select"
					:options="personChoices"
					class="sm:w-56"
					:aria-label="__('Member')"
					data-testid="team-person"
				/>
			</div>

			<div
				v-if="documents.loading && !compared"
				class="flex justify-center p-6"
			>
				<LoadingIndicator class="size-5 text-ink-gray-5" />
			</div>

			<template v-else-if="compared">
				<p v-if="!compared.authors.length" class="text-p-base text-ink-gray-6">
					{{ __('Nobody has started this document in the organization yet.') }}
				</p>
				<template v-else>
					<!-- Authors: a click opens the one person's document whole. -->
					<ul class="flex flex-wrap gap-2" data-testid="team-authors">
						<li v-for="author in authors" :key="author.user">
							<button
								type="button"
								class="rounded px-2 py-1 text-p-sm"
								:class="
									person === author.user
										? 'bg-surface-gray-7 text-ink-base'
										: 'bg-surface-gray-2 text-ink-gray-7 hover:bg-surface-gray-3'
								"
								:aria-pressed="person === author.user"
								@click="person = person === author.user ? '' : author.user"
							>
								{{ memberName(author) }} ·
								{{
									__('{0} of {1} blocks').format(
										author.blocks_filled,
										author.blocks_total
									)
								}}<span v-if="author.left"> · {{ __('left') }}</span>
							</button>
						</li>
					</ul>

					<label class="flex items-center gap-2 text-p-sm text-ink-gray-7">
						<input
							v-model="onlyFilled"
							type="checkbox"
							data-testid="team-only-filled"
						/>
						{{ __('Hide blocks nobody has filled') }}
					</label>

					<!-- Contents: thirteen blocks are a long page. -->
					<nav
						v-if="shown.length > 1"
						class="flex flex-wrap gap-x-4 gap-y-1 text-p-sm"
						:aria-label="__('Blocks')"
						data-testid="team-toc"
					>
						<a
							v-for="block in shown"
							:key="block.key"
							:href="safeUrl(`#team-block-${block.key}`)"
							class="text-ink-gray-6 hover:text-ink-gray-9 hover:underline"
							@click.prevent="jump(block.key)"
						>
							{{ block.title }}
							<span class="text-ink-gray-4">
								{{ block.sameFor.length || block.filled.length }}/{{
									(block.sameFor.length || block.filled.length) +
									block.missing.length
								}}</span
							>
						</a>
					</nav>

					<p v-if="!shown.length" class="text-p-base text-ink-gray-6">
						{{ __('Nobody has filled any block yet.') }}
					</p>

					<section
						v-for="block in shown"
						:id="`team-block-${block.key}`"
						:key="block.key"
						class="scroll-mt-4 space-y-2"
						:data-testid="`team-block-${block.key}`"
					>
						<h2 class="text-lg-semibold text-ink-gray-9">
							{{ block.title }}
						</h2>

						<article
							v-if="block.sameFor.length"
							class="rounded border p-3"
							data-testid="team-same"
						>
							<div class="mb-1 text-p-sm-medium text-ink-gray-7">
								{{ __('The same for {0}').format(names(block.sameFor)) }}
							</div>
							<TeamEntryBody :entry="block.filled[0]" />
						</article>

						<div
							v-else-if="block.filled.length"
							class="grid gap-3"
							:class="person ? '' : 'sm:grid-cols-2'"
						>
							<article
								v-for="entry in block.filled"
								:key="entry.user"
								class="rounded border p-3"
							>
								<div
									v-if="!person"
									class="mb-1 text-p-sm-medium text-ink-gray-7"
								>
									{{ memberName(entry) }}
									<span v-if="entry.left" class="text-ink-gray-5">
										· {{ __('left') }}</span
									>
								</div>
								<TeamEntryBody :entry="entry" />
							</article>
						</div>

						<p
							v-if="block.missing.length"
							class="text-p-sm text-ink-gray-5"
							data-testid="team-missing"
						>
							{{
								person
									? __('Not filled yet')
									: __('Not filled yet: {0}').format(names(block.missing))
							}}
						</p>
					</section>
				</template>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts">
// The documents of the team (learning-services#358): one block at a time,
// everyone's entry side by side, or one person's document whole (#378).
import { computed, ref, watch } from 'vue'
import { createResource, FormControl, LoadingIndicator } from 'frappe-ui'
import TeamEntryBody from '@/components/Team/TeamEntryBody.vue'
import { safeUrl } from '@/utils/safeUrl'
import {
	blockView,
	firstDocument,
	memberName,
	presentFirst,
	type TeamData,
	type TeamDocuments,
	type TeamEntry,
} from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

const props = defineProps<{ team: TeamData }>()

const documents = createResource({
	url: 'lms_frappe_app.api.team.team_documents',
	auto: false,
})

// One picker for course and document together: "Course — Document".
const documentChoices = computed(() =>
	props.team.courses.flatMap((course) =>
		course.documents.map((doc) => ({
			label: `${course.title ?? course.id} — ${doc.title}`,
			value: `${course.id}::${doc.artifact}`,
		}))
	)
)
const first = firstDocument(props.team.courses)
const picked = ref(first ? `${first.course}::${first.artifact}` : '')
const person = ref('')
const onlyFilled = ref(false)

watch(
	picked,
	(value) => {
		person.value = ''
		if (!value) return
		const [course, artifact] = value.split('::')
		documents.reload({
			organization: props.team.organization,
			course,
			artifact,
		})
	},
	{ immediate: true }
)

const compared = computed(() => {
	const answer = documents.data as Answer<TeamDocuments> | null
	return answer?.ok ? answer.data ?? null : null
})
const authors = computed(() => presentFirst(compared.value?.authors ?? []))
const personChoices = computed(() => [
	{ label: __('Everyone'), value: '' },
	...authors.value.map((author) => ({
		label: memberName(author),
		value: author.user,
	})),
])

const shown = computed(() =>
	(compared.value?.blocks ?? [])
		.map((block) => blockView(block, person.value || null))
		.filter((block) => !onlyFilled.value || block.filled.length)
)

const names = (entries: TeamEntry[]) =>
	entries
		.map((entry) =>
			entry.left ? `${memberName(entry)} · ${__('left')}` : memberName(entry)
		)
		.join(', ')

const jump = (key: string) =>
	document
		.getElementById(`team-block-${key}`)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>
