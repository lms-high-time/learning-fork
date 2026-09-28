<template>
	<div>
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #actions>
				<span
					v-if="readers"
					class="flex items-center gap-1 text-p-sm text-ink-gray-5"
					data-testid="document-readers"
				>
					<span class="lucide-eye size-3.5 shrink-0" />{{ readers }}
				</span>
				<span
					v-if="api.saving.value"
					class="text-p-sm text-ink-gray-5"
					data-testid="saving"
					>{{ __('Saving…') }}</span
				>
				<span
					v-else-if="savedAt"
					class="text-p-sm text-ink-gray-5"
					data-testid="saved"
					>{{ __('Saved at {0}').format(savedAt) }}</span
				>
				<Dropdown
					v-if="doc"
					:options="downloads"
					:button="{
						label: __('Download'),
						variant: 'subtle',
						iconLeft: 'download',
					}"
				/>
				<Dropdown
					v-if="doc && doc.version"
					:options="about"
					:button="{
						icon: 'more-horizontal',
						variant: 'ghost',
						label: __('More'),
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
			v-else-if="
				(api.resource.loading && !doc) || (courseMap.loading && !mapData)
			"
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

		<!-- A phone opens on the contents; a document is the next screen. -->
		<div v-else-if="isMobile && !view" class="p-4">
			<h1 class="mb-1 text-xl-semibold text-ink-gray-9">{{ doc.title }}</h1>
			<p class="mb-4 text-p-sm text-ink-gray-5">{{ courseTitle }}</p>
			<DocumentOutline
				:document="doc"
				:groups="groups"
				:specials="specials"
				:active="''"
				:currentLesson="currentLesson"
			/>
		</div>

		<div v-else class="mx-auto flex max-w-[90rem] gap-8 p-4 sm:p-5">
			<aside
				v-if="!isMobile"
				class="sticky top-16 h-fit max-h-[calc(100vh-5rem)] w-64 shrink-0 overflow-y-auto"
			>
				<p class="mb-3 px-2 text-p-sm text-ink-gray-5">{{ courseTitle }}</p>
				<DocumentOutline
					:document="doc"
					:groups="groups"
					:specials="specials"
					:active="active"
					:currentLesson="currentLesson"
				/>
			</aside>

			<main class="min-w-0 flex-1">
				<RegisterPanel
					v-if="active === REGISTER_VIEW && register"
					:table="register"
					:document="doc"
					:api="api"
				/>

				<ReportPanel
					v-else-if="active === REPORT_VIEW"
					:document="doc"
					:courseTitle="courseTitle"
					:api="api"
				/>

				<LessonDocument
					v-else-if="block"
					:key="block.key"
					:block="block"
					:document="doc"
					:api="api"
					:lesson="lessonOf(block)"
					:prev="neighbour(-1)"
					:next="neighbour(1)"
					@pickRow="pickRow"
				/>
			</main>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import {
	createResource,
	Dropdown,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import DocumentOutline from '@/components/Documents/DocumentOutline.vue'
import LessonDocument from '@/components/Documents/LessonDocument.vue'
import RegisterPanel from '@/components/Documents/RegisterPanel.vue'
import ReportPanel from '@/components/Documents/ReportPanel.vue'
import { useDocument } from '@/composables/useDocument'
import { useSpace, type Space } from '@/stores/space'
import { documentReaders } from '@/utils/space'
import { sessionStore } from '@/stores/session'
import { useScreenSize } from '@/utils/composables'
import {
	defaultView,
	isSharedTable,
	outline,
	REGISTER_VIEW,
	REPORT_VIEW,
	type DocBlock,
	type OutlineLesson,
} from '@/utils/documentTable'

// The course document as a workspace (learning-services#342): the contents on
// the left, one document open at a time, each with an address of its own.

const props = defineProps<{
	courseName: string
	artifact: string
	view?: string
}>()

const { isLoggedIn } = sessionStore()
const { isMobile } = useScreenSize()
const route = useRoute()
const router = useRouter()
const api = useDocument(toRef(props, 'courseName'), toRef(props, 'artifact'))
const doc = api.document

// Who else reads this document — said on the document itself, so a learner in
// a company knows before writing (learning-services#132, #347). Only to someone
// with an organization: a private learner has nothing to be told.
const spaces = useSpace()
const readers = computed(() => {
	if (!spaces.hasOrganizations || !api.space.value) return ''
	const space = spaces.spaces.find((item: Space) => item.id === api.space.value)
	return space ? documentReaders(space) : ''
})

// The course's lessons — titles, numbers, the one the student is on — come
// from the course map; the document names lessons by id only.
const courseMap = createResource({
	url: 'lms_frappe_app.api.public.course_map',
	method: 'GET',
	makeParams: () => ({
		course: props.courseName,
		space: api.space.value ?? spaces.paramFor(props.courseName),
	}),
	auto: true,
})
type MapLesson = { id: string; number: number; title: string }
const mapData = computed(
	() =>
		(
			courseMap.data as {
				data?: {
					title?: string
					next_lesson?: string | null
					chapters?: { lessons: MapLesson[] }[]
				}
			} | null
		)?.data
)
const courseTitle = computed(() => mapData.value?.title ?? props.courseName)
const lessons = computed<
	(OutlineLesson & { chapter: number; index: number })[]
>(() =>
	(mapData.value?.chapters ?? []).flatMap((chapter, c) =>
		chapter.lessons.map((l, i) => ({
			id: l.id,
			number: l.number,
			title: l.title,
			chapter: c + 1,
			index: i + 1,
		}))
	)
)
const currentLesson = computed(() => mapData.value?.next_lesson ?? null)

const groups = computed(() =>
	doc.value ? outline(doc.value, lessons.value) : []
)
const ordered = computed(() => groups.value.flatMap((g) => g.blocks))

const register = computed(
	() => Object.values(doc.value?.tables ?? {}).find(isSharedTable) ?? null
)
const hasReport = computed(() =>
	Object.values(doc.value?.tables ?? {}).some((t) =>
		t.views.some((v) => v.type === 'report')
	)
)
const specials = computed(() => [
	...(register.value
		? [
				{
					view: REGISTER_VIEW,
					title: __('The whole register'),
					icon: 'lucide-table',
				},
		  ]
		: []),
	...(hasReport.value
		? [
				{
					view: REPORT_VIEW,
					title: __('Report for the sponsor'),
					icon: 'lucide-printer',
				},
		  ]
		: []),
])

// What is open: the address, or where the document opens by itself — the
// current lesson during the course, the register after it.
const active = computed(() => {
	const known = new Set([
		...(register.value ? [REGISTER_VIEW] : []),
		...(hasReport.value ? [REPORT_VIEW] : []),
		...(doc.value?.blocks.map((b) => b.key) ?? []),
	])
	if (props.view && known.has(props.view)) return props.view
	return doc.value
		? defaultView(doc.value, groups.value, currentLesson.value)
		: ''
})
const block = computed<DocBlock | null>(
	() => doc.value?.blocks.find((b) => b.key === active.value) ?? null
)

const to = (view: string): RouteLocationRaw => ({
	name: 'Document',
	params: { courseName: props.courseName, artifact: props.artifact, view },
})
const open = (view: string) => router.push(to(view))

function neighbour(step: -1 | 1) {
	const i = ordered.value.findIndex((b) => b.key === active.value)
	const other = i < 0 ? null : ordered.value[i + step]
	return other ? { title: other.title, to: to(other.key) } : null
}

function lessonOf(b: DocBlock) {
	const lesson = lessons.value.find((l) => l.id === b.lesson)
	return lesson
		? {
				number: lesson.number,
				title: lesson.title,
				route: {
					name: 'Lesson',
					params: {
						courseName: props.courseName,
						chapterNumber: lesson.chapter,
						lessonNumber: lesson.index,
					},
				},
		  }
		: null
}

// Links made before the workspace pointed at #block-key: open that document.
watch(
	() => route.hash,
	(hash) => {
		if (hash?.startsWith('#block-'))
			router.replace(to(hash.slice('#block-'.length)))
	},
	{ immediate: true }
)

function pickRow(id: string) {
	const row = window.document.querySelector(`[data-row="${CSS.escape(id)}"]`)
	row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	row?.classList.add('row-picked')
	setTimeout(() => row?.classList.remove('row-picked'), 1600)
}

// «Сохранено в 14:32» once a write lands; the time and the version number live
// in the menu, for support rather than for the student.
const savedAt = ref('')
const clock = (d: Date) =>
	d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
watch(
	() => api.saving.value,
	(now, before) => {
		if (before && !now) savedAt.value = clock(new Date())
	}
)
const about = computed(() => {
	const modified = doc.value?.modified ? new Date(doc.value.modified) : null
	return [
		{
			label: __('Changed {0} · version {1}').format(
				modified
					? `${modified.toLocaleDateString('ru-RU')} ${clock(modified)}`
					: '—',
				String(doc.value?.version ?? 0)
			),
			icon: 'history',
			onClick: () => {},
		},
	]
})

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

const viewTitle = computed(() => {
	if (active.value === REGISTER_VIEW) return __('The whole register')
	if (active.value === REPORT_VIEW) return __('Report for the sponsor')
	return block.value?.title ?? ''
})

const breadcrumbs = computed(() => [
	{ label: __('My documents'), route: { name: 'Documents' } },
	{
		label: doc.value?.title ?? __('Document'),
		route: {
			name: 'Document',
			params: { courseName: props.courseName, artifact: props.artifact },
		},
	},
	...(viewTitle.value && (props.view || !isMobile.value)
		? [{ label: viewTitle.value }]
		: []),
])

usePageMeta(() => ({
	title: viewTitle.value || doc.value?.title || __('My documents'),
}))
</script>

<style>
tr.row-picked > *,
details.row-picked {
	background-color: var(--surface-amber-1) !important;
	transition: background-color 300ms ease;
}
</style>
