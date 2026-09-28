<template>
	<section
		:id="`block-${block.key}`"
		class="doc-block rounded-lg border border-outline-gray-2 bg-surface-base p-4 sm:p-5"
		:class="{ 'is-focused': focused }"
		:data-testid="`block-${block.key}`"
	>
		<header class="flex flex-wrap items-start justify-between gap-2">
			<div class="min-w-0">
				<h2 class="text-lg-semibold text-ink-gray-9">{{ block.title }}</h2>
				<router-link
					v-if="lesson"
					:to="lesson.route"
					class="mt-0.5 inline-block text-p-sm text-ink-gray-5 underline decoration-outline-gray-2 underline-offset-2 hover:text-ink-gray-8"
					data-testid="block-lesson"
				>
					{{ __('Built in lesson {0}').format(String(lesson.number)) }}
				</router-link>
			</div>
			<span
				class="shrink-0 rounded-full px-2 py-0.5 text-p-xs font-medium"
				:class="status.class"
				data-testid="block-status"
				>{{ status.label }}</span
			>
		</header>

		<!-- The author's hint is addressed to the agent, but it is also the
		clearest statement of «done» the student has. Folded once filled. -->
		<details v-if="block.hint" class="mt-2" :open="!filled">
			<summary class="cursor-pointer text-p-sm text-ink-gray-6">
				{{ __('When the block is done') }}
			</summary>
			<p class="mt-1 text-p-sm leading-relaxed text-ink-gray-6">
				{{ block.hint }}
			</p>
		</details>

		<div v-if="block.fields?.length" class="mt-4">
			<BlockFields
				:fields="block.fields"
				:values="document.fields"
				@save="(key, value) => api.setField(block.key, key, value)"
			/>
		</div>

		<!-- The table is drawn once, at the block that starts its rows. Other
		blocks of the table point at their group of columns there. -->
		<div v-if="ownTable" class="mt-4 space-y-5">
			<DocTableEditor
				:table="ownTable"
				:tables="document.tables"
				:blocks="document.blocks"
				:canEditRows="true"
				@setCell="(b, row, column, value) => api.setCell(b, ownTable!.name, row, column, value)"
				@addRow="api.addRow(block.key)"
				@deleteRow="(id) => api.deleteRow(block.key, id)"
				@focusBlock="(key) => $emit('focusBlock', key)"
			/>
			<template v-for="view in ownTable.views" :key="view.type">
				<MatrixView
					v-if="view.type === 'matrix'"
					:table="ownTable"
					:view="view"
					class="max-w-xl"
					@pickRow="(id) => $emit('pickRow', id)"
				/>
			</template>
		</div>
		<!-- Another block of the table: its columns, filled in place, beside the
		row's name; the whole register is one click away. -->
		<div v-else-if="otherTable" class="mt-4 space-y-2">
			<DocTableEditor
				:table="otherTable"
				:tables="document.tables"
				:blocks="document.blocks"
				:canEditRows="false"
				:only="block.key"
				@setCell="(b, row, column, value) => api.setCell(b, otherTable!.name, row, column, value)"
			/>
			<button
				type="button"
				class="text-p-sm font-medium text-ink-gray-7 underline underline-offset-2 hover:text-ink-gray-9"
				@click="$emit('showTable', block.table!, block.key)"
			>
				{{ __('The whole table «{0}»').format(tableTitle) }}
			</button>
		</div>

		<div v-if="reports.length" class="mt-3 flex flex-wrap gap-2">
			<router-link
				v-for="report in reports"
				:key="report.table"
				:to="{
					name: 'DocumentReport',
					params: {
						courseName: document.course,
						artifact: document.artifact,
						table: report.table,
					},
				}"
			>
				<Button variant="subtle" :label="report.title">
					<template #prefix>
						<span class="lucide-printer size-4" />
					</template>
				</Button>
			</router-link>
		</div>

		<!-- File and link blocks: the file itself, the address. -->
		<div v-if="block.kind === 'file'" class="mt-4 space-y-2">
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
			class="mt-4 flex flex-wrap gap-2"
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

		<!-- Text: the block itself, or a note beside a table or fields. -->
		<div class="mt-4">
			<div v-if="editing" class="space-y-2">
				<textarea
					ref="editor"
					v-model="draft"
					rows="8"
					class="w-full rounded-md border border-outline-gray-2 p-3 text-p-sm leading-relaxed text-ink-gray-9"
					:aria-label="block.title"
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
			</div>
			<template v-else>
				<div v-if="block.content" class="relative">
					<p
						v-if="structured"
						class="mb-1 text-p-xs font-medium uppercase text-ink-gray-5"
					>
						{{ __('Note') }}
					</p>
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
				</div>
				<div class="mt-2 flex gap-2">
					<Button
						variant="ghost"
						size="sm"
						:label="
							block.content
								? __('Edit text')
								: structured
								? __('Add a note')
								: __('Write')
						"
						@click="startEditing"
					>
						<template #prefix>
							<span class="lucide-pencil size-3.5" />
						</template>
					</Button>
					<!-- A structured block's clear would take its table too: its
					note is rewritten, not cleared. -->
					<Button
						v-if="block.content && !structured"
						variant="ghost"
						size="sm"
						:label="__('Clear')"
						@click="clearText"
					/>
				</div>
			</template>
		</div>
	</section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import MarkdownIt from 'markdown-it'
import { Button } from 'frappe-ui'
import BlockFields from '@/components/Documents/BlockFields.vue'
import DocTableEditor from '@/components/Documents/DocTableEditor.vue'
import MatrixView from '@/components/Documents/MatrixView.vue'
import { safeUrl } from '@/utils/safeUrl'
import type { DocumentApi } from '@/composables/useDocument'
import type { DocBlock, DocumentData, ReportView } from '@/utils/documentTable'

const props = defineProps<{
	block: DocBlock
	document: DocumentData
	api: DocumentApi
	/** The lesson that builds the block, and the way to it. */
	lesson?: { number: number; route: RouteLocationRaw } | null
	focused?: boolean
}>()

defineEmits<{
	focusBlock: [key: string]
	showTable: [table: string, block: string]
	pickRow: [id: string]
}>()

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)

const editing = ref(false)
const draft = ref('')
const editor = ref<HTMLTextAreaElement | null>(null)
const url = ref(props.block.url ?? '')
watch(
	() => props.block.url,
	(value) => (url.value = value ?? '')
)

const structured = computed(() =>
	Boolean(props.block.fields?.length || props.block.columns?.length)
)

const ownTable = computed(() => {
	const table = props.block.table
		? props.document.tables[props.block.table]
		: null
	return table && table.owner === props.block.key ? table : null
})

const otherTable = computed(() => {
	const table = props.block.table
		? props.document.tables[props.block.table]
		: null
	return table && table.owner !== props.block.key && props.block.columns?.length
		? table
		: null
})

const tableTitle = computed(() => {
	const table = props.block.table
		? props.document.tables[props.block.table]
		: null
	return table?.title || props.block.table || ''
})

const filled = computed(
	() =>
		props.block.filled ??
		Boolean(props.block.content || props.block.file || props.block.url)
)

// Text written before the block had columns: it still counts, but it belongs
// in the table.
const legacy = computed(() => {
	if (!props.block.columns?.length || !props.block.content) return false
	const table = props.block.table
		? props.document.tables[props.block.table]
		: null
	const own = props.block.columns.map((c) => c.key)
	return !table?.rows.some((r) =>
		own.some((k) => r[k] !== undefined && r[k] !== null && r[k] !== '')
	)
})

const status = computed(() => {
	const missing = props.block.empty_cells?.length ?? 0
	if (filled.value)
		return { label: __('Done'), class: 'bg-surface-green-2 text-ink-green-8' }
	if (missing)
		return {
			label: __('{0} to fill').format(String(missing)),
			class: 'bg-surface-amber-2 text-ink-amber-8',
		}
	return { label: __('Empty'), class: 'bg-surface-gray-2 text-ink-gray-6' }
})

const reports = computed(() => {
	const out: { table: string; title: string }[] = []
	for (const table of Object.values(props.document.tables))
		for (const view of table.views)
			if (
				view.type === 'report' &&
				(view as ReportView).filter &&
				ownsReport(view as ReportView)
			)
				out.push({
					table: table.name,
					title: view.title || __('Report for the sponsor'),
				})
	return out
})

// The report belongs to the block whose tick picks its rows.
function ownsReport(view: ReportView): boolean {
	return Boolean(props.block.columns?.some((c) => c.key === view.filter))
}

async function startEditing() {
	draft.value = props.block.content ?? ''
	editing.value = true
	await nextTick()
	editor.value?.focus()
}

async function saveText() {
	const text = draft.value.trim()
	if (!text) {
		if (props.block.content && !structured.value) await clearText()
		editing.value = false
		return
	}
	const answer = await props.api.write(props.block.key, { content: text })
	if (answer) editing.value = false
}

async function clearText() {
	if (!window.confirm(__('Clear this block?'))) return
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

<style scoped>
.doc-block {
	scroll-margin-top: 4.5rem;
	transition: box-shadow 300ms ease;
}

.doc-block.is-focused {
	box-shadow: 0 0 0 2px var(--outline-gray-4);
}
</style>
