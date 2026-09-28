<template>
	<div>
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #actions>
				<span v-if="api.saving.value" class="text-p-sm text-ink-gray-5">
					{{ __('Saving…') }}
				</span>
				<Dropdown
					v-if="doc"
					:options="downloads"
					:button="{
						label: __('Download'),
						variant: 'subtle',
						iconLeft: 'download',
					}"
				/>
			</template>
		</PageHeader>

		<div v-if="!isLoggedIn" class="p-5 text-p-base text-ink-gray-7">
			{{ __('Your documents are visible only to you.') }}
			<a href="/login?redirect-to=/lms/documents" class="underline">{{
				__('Log in')
			}}</a>
		</div>

		<div
			v-else-if="api.resource.loading && !doc"
			class="flex items-center justify-center p-10"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<div v-else-if="!doc" class="p-5 text-p-base text-ink-gray-7">
			{{
				api.refusal.value?.message ||
				__(
					'This document is not available: the course is not yours or the document is gone.'
				)
			}}
			<router-link :to="{ name: 'Documents' }" class="underline">{{
				__('All documents')
			}}</router-link>
		</div>

		<div v-else class="mx-auto flex max-w-[90rem] gap-6 p-4 sm:p-5">
			<!-- Contents: where each block stands, a jump to it. -->
			<nav
				v-if="!isMobile"
				class="sticky top-16 hidden h-fit w-56 shrink-0 space-y-1 lg:block"
				:aria-label="__('Document contents')"
			>
				<div class="mb-3 space-y-1.5">
					<div class="text-p-sm text-ink-gray-6">
						{{
							__('Filled {0} of {1}').format(
								String(filledCount),
								String(doc.blocks.length)
							)
						}}
					</div>
					<ProgressBar :progress="progress" />
				</div>
				<a
					v-for="block in doc.blocks"
					:key="block.key"
					:href="safeUrl(`#block-${block.key}`)"
					class="flex items-start gap-2 rounded px-2 py-1 text-p-sm text-ink-gray-7 hover:bg-surface-gray-2"
					@click.prevent="focusBlock(block.key)"
				>
					<span
						class="mt-0.5 size-4 shrink-0"
						:class="
							isFilled(block)
								? 'lucide-circle-check text-ink-green-6'
								: block.empty_cells?.length
								? 'lucide-circle-dot text-ink-amber-6'
								: 'lucide-circle text-ink-gray-4'
						"
						aria-hidden="true"
					/>
					<span class="min-w-0">{{ block.title }}</span>
				</a>
			</nav>

			<main class="min-w-0 flex-1 space-y-4">
				<div class="space-y-1">
					<h1 class="text-2xl-semibold text-ink-gray-9">{{ doc.title }}</h1>
					<p class="text-p-sm text-ink-gray-6">
						{{ courseTitle }} ·
						{{
							__('Filled {0} of {1}').format(
								String(filledCount),
								String(doc.blocks.length)
							)
						}}
					</p>
				</div>

				<DocumentBlock
					v-for="block in doc.blocks"
					:key="block.key"
					:block="block"
					:document="doc"
					:api="api"
					:lesson="lessons.get(block.lesson ?? '') ?? null"
					:focused="focused === block.key"
					@focusBlock="focusBlock"
					@showTable="showTable"
					@pickRow="pickRow"
				/>
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import {
	createResource,
	Dropdown,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import DocumentBlock from '@/components/Documents/DocumentBlock.vue'
import { useDocument } from '@/composables/useDocument'
import { sessionStore } from '@/stores/session'
import { useScreenSize } from '@/utils/composables'
import { safeUrl } from '@/utils/safeUrl'
import type { DocBlock } from '@/utils/documentTable'

const props = defineProps<{ courseName: string; artifact: string }>()

const { isLoggedIn } = sessionStore()
const { isMobile } = useScreenSize()
const api = useDocument(toRef(props, 'courseName'), toRef(props, 'artifact'))
const doc = api.document

// The course's title and lesson numbers: the document names lessons by id.
const courseMap = createResource({
	url: 'lms_frappe_app.api.public.course_map',
	method: 'GET',
	makeParams: () => ({ course: props.courseName }),
	auto: true,
})
const mapData = computed(
	() =>
		(
			courseMap.data as {
				data?: {
					title?: string
					chapters?: { lessons: { id: string; number: number }[] }[]
				}
			} | null
		)?.data
)
const courseTitle = computed(() => mapData.value?.title ?? props.courseName)
// A block's lesson, by number and as a way back to it (#340).
const lessons = computed(() => {
	const out = new Map<string, { number: number; route: RouteLocationRaw }>()
	;(mapData.value?.chapters ?? []).forEach((chapter, c) =>
		chapter.lessons.forEach((lesson, l) =>
			out.set(lesson.id, {
				number: lesson.number,
				route: {
					name: 'Lesson',
					params: {
						courseName: props.courseName,
						chapterNumber: c + 1,
						lessonNumber: l + 1,
					},
				},
			})
		)
	)
	return out
})

// A link to a block — from the course page or a lesson — opens on it.
const route = useRoute()
watch(
	() => Boolean(doc.value) && route.hash,
	(hash) => {
		if (typeof hash === 'string' && hash.startsWith('#block-'))
			focusBlock(hash.slice('#block-'.length))
	},
	{ immediate: true }
)

const isFilled = (block: DocBlock): boolean =>
	block.filled ?? Boolean(block.content || block.file || block.url)
const filledCount = computed(
	() => doc.value?.blocks.filter(isFilled).length ?? 0
)
const progress = computed(() =>
	doc.value?.blocks.length
		? Math.round((filledCount.value / doc.value.blocks.length) * 100)
		: 0
)

const breadcrumbs = computed(() => [
	{ label: __('My documents'), route: { name: 'Documents' } },
	{
		label: courseTitle.value,
		route: { name: 'Documents', query: { course: props.courseName } },
	},
	{ label: doc.value?.title ?? __('Document') },
])

const downloads = computed(() => [
	{
		label: __('Excel workbook (.xlsx)'),
		icon: 'sheet',
		onClick: () => (window.location.href = api.downloadUrl('xlsx')),
	},
	{
		label: __('Markdown (.md)'),
		icon: 'file-text',
		onClick: () => (window.location.href = api.downloadUrl('md')),
	},
])

const focused = ref<string | null>(null)
let unfocus: ReturnType<typeof setTimeout> | undefined

async function focusBlock(key: string) {
	focused.value = key
	await nextTick()
	document
		.getElementById(`block-${key}`)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	clearTimeout(unfocus)
	unfocus = setTimeout(() => (focused.value = null), 1600)
}

// A block whose columns live in another block's table: go there.
function showTable(table: string) {
	const owner = doc.value?.tables[table]?.owner
	if (owner) focusBlock(owner)
}

function pickRow(id: string) {
	const row = window.document.querySelector(`[data-row="${CSS.escape(id)}"]`)
	row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	row?.classList.add('row-picked')
	setTimeout(() => row?.classList.remove('row-picked'), 1600)
}

usePageMeta(() => ({ title: doc.value?.title ?? __('My documents') }))
</script>

<style>
tr.row-picked > *,
details.row-picked {
	background-color: var(--surface-amber-1) !important;
	transition: background-color 300ms ease;
}
</style>
