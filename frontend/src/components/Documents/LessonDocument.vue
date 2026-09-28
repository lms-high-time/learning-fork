<template>
	<article class="space-y-5" :data-testid="`lesson-document-${block.key}`">
		<header class="space-y-1">
			<div class="flex items-start justify-between gap-3">
				<h1 class="text-2xl-semibold text-ink-gray-9">{{ block.title }}</h1>
				<div class="flex shrink-0 items-center gap-2">
					<StateBadge :state="state" />
					<Dropdown
						v-if="menu.length"
						:options="menu"
						:button="{
							icon: 'more-horizontal',
							variant: 'ghost',
							label: __('More'),
						}"
					/>
				</div>
			</div>
			<router-link
				v-if="lesson"
				:to="lesson.route"
				class="inline-block text-p-sm text-ink-gray-5 underline decoration-outline-gray-2 underline-offset-2 hover:text-ink-gray-8"
				data-testid="block-lesson"
			>
				{{ __('Lesson {0} · {1}').format(String(lesson.number), lesson.title) }}
			</router-link>
		</header>

		<!-- One sentence of «done»; the rest of the hint is written for the
		agent and folds away. -->
		<div v-if="block.hint" class="text-p-sm text-ink-gray-7">
			<p v-if="ready" data-testid="ready-line">{{ ready }}</p>
			<details class="mt-1">
				<summary class="cursor-pointer text-ink-gray-5">
					{{
						ready
							? __('More about this document')
							: __('When the document is done')
					}}
				</summary>
				<p class="mt-1 leading-relaxed text-ink-gray-6">{{ block.hint }}</p>
			</details>
		</div>

		<p
			v-if="state === 'preset'"
			class="rounded-md bg-surface-amber-1 px-3 py-2 text-p-sm text-ink-amber-8"
		>
			{{ __('This is a template from the lesson. Adjust it to your project.') }}
		</p>

		<BlockFields
			v-if="block.fields?.length"
			:fields="block.fields"
			:values="document.fields"
			@save="(key, value) => api.setField(block.key, key, value)"
		/>

		<template v-if="table">
			<DocTableEditor
				:table="table"
				:tables="document.tables"
				:blocks="document.blocks"
				:canEditRows="table.owner === block.key"
				:only="shared ? block.key : undefined"
				@setCell="(b, row, column, value) => api.setCell(b, table!.name, row, column, value)"
				@addRow="api.addRow(block.key)"
				@deleteRow="(id) => api.deleteRow(block.key, id)"
			/>
			<MatrixView
				v-if="matrix"
				:table="table"
				:view="matrix"
				class="max-w-xl"
				@pickRow="(id) => $emit('pickRow', id)"
			/>
		</template>

		<router-link
			v-if="report"
			:to="report"
			class="inline-block"
			data-testid="report-link"
		>
			<Button variant="subtle" :label="__('Report for the sponsor')">
				<template #prefix>
					<span class="lucide-printer size-4" />
				</template>
			</Button>
		</router-link>

		<!-- File and link blocks: the file itself, the address. -->
		<div v-if="block.kind === 'file'" class="space-y-2">
			<p v-if="block.file" class="text-p-sm text-ink-gray-8">
				<a
					:href="safeUrl(block.file.url)"
					download
					class="font-medium underline underline-offset-2"
					>{{ block.file.name }}</a
				>
			</p>
			<p v-else class="text-p-sm text-ink-gray-5">{{ __('No file yet.') }}</p>
			<label class="inline-flex cursor-pointer">
				<input
					type="file"
					class="sr-only"
					:accept="block.accept.map((a) => `.${a}`).join(',') || undefined"
					@change="onFile"
				/>
				<span
					class="rounded bg-surface-gray-2 px-3 py-1.5 text-p-sm font-medium text-ink-gray-8"
				>
					{{ block.file ? __('Replace the file') : __('Upload a file') }}
				</span>
			</label>
			<details v-if="block.preview" class="text-p-sm">
				<summary class="cursor-pointer text-ink-gray-6">
					{{ __('What the agent sees') }}
				</summary>
				<div
					v-safe-html:rich="render(block.preview)"
					class="prose prose-sm mt-2 max-w-none overflow-x-auto"
				/>
			</details>
		</div>
		<form
			v-if="block.kind === 'link'"
			class="flex flex-wrap gap-2"
			@submit.prevent="saveUrl"
		>
			<input
				v-model="url"
				type="url"
				class="h-8 min-w-0 flex-1 rounded border border-outline-gray-2 px-2 text-p-sm"
				placeholder="https://…"
				:aria-label="__('Link')"
			/>
			<Button type="submit" variant="subtle" :label="__('Save link')" />
		</form>

		<!-- Text: the document itself, or a note beside a table or fields. -->
		<section v-if="editing" class="space-y-2">
			<textarea
				ref="editor"
				v-model="draft"
				rows="10"
				class="w-full rounded-md border border-outline-gray-2 p-3 text-p-sm leading-relaxed text-ink-gray-9"
				:aria-label="structured ? __('Note') : block.title"
				@keydown.meta.enter.prevent="saveText"
				@keydown.ctrl.enter.prevent="saveText"
				@keydown.esc.prevent="editing = false"
			/>
			<div class="flex items-center gap-2">
				<Button variant="solid" :label="__('Save')" @click="saveText" />
				<Button
					variant="ghost"
					:label="__('Cancel')"
					@click="editing = false"
				/>
				<span class="text-p-xs text-ink-gray-5">{{
					__('Markdown works here')
				}}</span>
			</div>
		</section>
		<section v-else-if="block.content">
			<h2
				v-if="structured"
				class="mb-1 text-p-xs font-medium uppercase text-ink-gray-5"
			>
				{{ __('Note') }}
			</h2>
			<div
				v-safe-html:rich="render(block.content)"
				class="prose prose-sm max-w-none text-ink-gray-8"
				data-testid="block-content"
			/>
			<p v-if="legacy" class="mt-2 text-p-xs text-ink-amber-7">
				{{
					__(
						'This was written as text before the table existed. Move it into the table with your agent, or by hand.'
					)
				}}
			</p>
		</section>
		<Button
			v-if="!structured && !editing"
			variant="subtle"
			:label="block.content ? __('Edit text') : __('Write')"
			@click="startEditing"
		>
			<template #prefix>
				<span class="lucide-pencil size-3.5" />
			</template>
		</Button>

		<!-- Documents in course order, without going back to the contents. -->
		<nav
			v-if="prev || next"
			class="flex items-center justify-between gap-3 border-t border-outline-gray-1 pt-4 text-p-sm"
			:aria-label="__('Other documents')"
		>
			<router-link
				v-if="prev"
				:to="prev.to"
				class="flex min-w-0 items-center gap-1 text-ink-gray-7 hover:text-ink-gray-9"
				data-testid="prev-document"
			>
				<span class="lucide-arrow-left size-4 shrink-0" />
				<span class="truncate">{{ prev.title }}</span>
			</router-link>
			<span v-else />
			<router-link
				v-if="next"
				:to="next.to"
				class="flex min-w-0 items-center gap-1 text-ink-gray-7 hover:text-ink-gray-9"
				data-testid="next-document"
			>
				<span class="truncate">{{ next.title }}</span>
				<span class="lucide-arrow-right size-4 shrink-0" />
			</router-link>
		</nav>
	</article>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import MarkdownIt from 'markdown-it'
import { Button, Dropdown } from 'frappe-ui'
import BlockFields from '@/components/Documents/BlockFields.vue'
import DocTableEditor from '@/components/Documents/DocTableEditor.vue'
import MatrixView from '@/components/Documents/MatrixView.vue'
import StateBadge from '@/components/Documents/StateBadge.vue'
import { safeUrl } from '@/utils/safeUrl'
import type { DocumentApi } from '@/composables/useDocument'
import {
	blockState,
	isBlank,
	isSharedTable,
	readyLine,
	REPORT_VIEW,
	type DocBlock,
	type DocumentData,
	type MatrixView as Matrix,
	type ReportView,
} from '@/utils/documentTable'

// One lesson's document, on its own page (learning-services#342).

const props = defineProps<{
	block: DocBlock
	document: DocumentData
	api: DocumentApi
	/** The lesson that builds it, and the way back to it. */
	lesson?: { number: number; title: string; route: RouteLocationRaw } | null
	prev?: { title: string; to: RouteLocationRaw } | null
	next?: { title: string; to: RouteLocationRaw } | null
}>()

defineEmits<{ pickRow: [id: string] }>()

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)

const state = computed(() => blockState(props.block, props.document))
const ready = computed(() => readyLine(props.block.hint || ''))
const structured = computed(() =>
	Boolean(props.block.fields?.length || props.block.columns?.length)
)

const table = computed(() =>
	props.block.table && props.block.columns?.length
		? props.document.tables[props.block.table] ?? null
		: null
)
const shared = computed(() =>
	Boolean(table.value && isSharedTable(table.value))
)

// The matrix sits with the lesson whose columns are its axes: «Оценка».
const matrix = computed(() => {
	const own = new Set((props.block.columns ?? []).map((c) => c.key))
	return (
		(table.value?.views.find(
			(v) =>
				v.type === 'matrix' &&
				own.has((v as Matrix).x) &&
				own.has((v as Matrix).y)
		) as Matrix | undefined) ?? null
	)
})

// The report belongs to the lesson whose tick picks its rows.
const report = computed<RouteLocationRaw | null>(() => {
	const own = new Set((props.block.columns ?? []).map((c) => c.key))
	const view = table.value?.views.find(
		(v) => v.type === 'report' && own.has((v as ReportView).filter ?? '')
	)
	return view
		? {
				name: 'Document',
				params: {
					courseName: props.document.course,
					artifact: props.document.artifact,
					view: REPORT_VIEW,
				},
		  }
		: null
})

// Text written before the block had columns: it counts, but belongs in the table.
const legacy = computed(() => {
	if (!props.block.columns?.length || !props.block.content) return false
	const own = props.block.columns.map((c) => c.key)
	return !table.value?.rows.some((r) => own.some((k) => !isBlank(r[k])))
})

const menu = computed(() =>
	structured.value
		? [
				{
					label: props.block.content ? __('Edit the note') : __('Add a note'),
					icon: 'pencil',
					onClick: startEditing,
				},
		  ]
		: props.block.content
		? [{ label: __('Clear'), icon: 'trash-2', onClick: clearText }]
		: []
)

const editing = ref(false)
const draft = ref('')
const editor = ref<HTMLTextAreaElement | null>(null)
const url = ref(props.block.url ?? '')
watch(
	() => props.block.url,
	(value) => (url.value = value ?? '')
)
watch(
	() => props.block.key,
	() => (editing.value = false)
)

async function startEditing() {
	draft.value = props.block.content ?? ''
	editing.value = true
	await nextTick()
	editor.value?.focus()
}

async function saveText() {
	const text = draft.value.trim()
	if (!text) {
		editing.value = false
		return
	}
	const answer = await props.api.write(props.block.key, { content: text })
	if (answer) editing.value = false
}

async function clearText() {
	if (!window.confirm(__('Clear this document?'))) return
	await props.api.write(props.block.key, { clear: true })
}

function saveUrl() {
	if (url.value.trim())
		props.api.write(props.block.key, { url: url.value.trim() })
}

async function onFile(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (file) await props.api.upload(props.block.key, file)
	input.value = ''
}
</script>
