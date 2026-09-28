<template>
	<section class="space-y-4" data-testid="table-panel">
		<header class="space-y-2">
			<h1 class="text-2xl-semibold text-ink-gray-9">
				{{ table.title || __('The whole table') }}
			</h1>
			<!-- The table at a glance; each part narrows the table to it. -->
			<p
				class="flex flex-wrap items-center gap-x-3 gap-y-1 text-p-sm text-ink-gray-6"
				data-testid="table-summary"
			>
				<span>{{ __('{0} rows').format(String(table.rows.length)) }}</span>
				<button
					v-if="flag"
					type="button"
					class="underline decoration-outline-gray-3 underline-offset-2 hover:text-ink-gray-9"
					@click="flagOn = !flagOn"
				>
					{{ flag.title }}: {{ flagCount }}
				</button>
				<span v-for="field in flagFields" :key="field.key">
					{{ field.title }}: {{ field.value }}
				</span>
				<span
					v-for="date in dates"
					:key="date.key"
					:class="date.days < 0 ? 'font-medium text-ink-red-5' : ''"
					:data-testid="`table-date-${date.key}`"
				>
					{{ date.title }}: {{ formatCell({ type: 'date' }, date.value) }}
					<template v-if="date.days < 0">
						· {{ __('overdue by {0} d').format(String(-date.days)) }}
					</template>
					<template v-else-if="date.days <= 7">
						·
						{{
							date.days === 0
								? __('today')
								: __('in {0} d').format(String(date.days))
						}}
					</template>
				</span>
			</p>
		</header>

		<div class="flex flex-wrap items-center gap-2">
			<div class="segmented" role="group" :aria-label="__('Show as')">
				<button
					type="button"
					:class="{ 'is-on': mode === 'table' }"
					:aria-pressed="mode === 'table'"
					@click="mode = 'table'"
				>
					{{ __('Table') }}
				</button>
				<button
					v-if="matrixView"
					type="button"
					:class="{ 'is-on': mode === 'matrix' }"
					:aria-pressed="mode === 'matrix'"
					data-testid="mode-matrix"
					@click="mode = 'matrix'"
				>
					{{ __('Matrix') }}
				</button>
			</div>
			<template v-if="mode === 'table'">
				<div
					v-if="columnViews.length"
					class="segmented"
					role="group"
					:aria-label="__('Columns')"
				>
					<button
						type="button"
						:class="{ 'is-on': !viewTitle }"
						:aria-pressed="!viewTitle"
						@click="viewTitle = ''"
					>
						{{ __('All') }}
					</button>
					<button
						v-for="view in columnViews"
						:key="view.title"
						type="button"
						:class="{ 'is-on': viewTitle === view.title }"
						:aria-pressed="viewTitle === view.title"
						:data-testid="`view-${view.title}`"
						@click="viewTitle = view.title"
					>
						{{ view.title }}
					</button>
				</div>
				<select
					v-if="filterColumns.length"
					v-model="filterColumn"
					class="h-8 rounded border border-outline-gray-2 bg-surface-base px-2 text-p-sm"
					:aria-label="__('Filter by')"
				>
					<option value="">{{ __('Filter by…') }}</option>
					<option v-for="c in filterColumns" :key="c.key" :value="c.key">
						{{ c.title }}
					</option>
				</select>
				<select
					v-if="filterColumn"
					v-model="filterValue"
					class="h-8 rounded border border-outline-gray-2 bg-surface-base px-2 text-p-sm"
					:aria-label="__('Value')"
					data-testid="filter-value"
				>
					<option value="">{{ __('Any') }}</option>
					<option v-for="v in filterValues" :key="v" :value="v">{{ v }}</option>
				</select>
				<Button
					variant="ghost"
					:label="__('Download this view (CSV)')"
					@click="downloadCsv"
				>
					<template #prefix>
						<span class="lucide-download size-4" />
					</template>
				</Button>
			</template>
		</div>

		<DocTableEditor
			v-if="mode === 'table'"
			ref="editor"
			:table="table"
			:tables="document.tables"
			:blocks="document.blocks"
			:canEditRows="true"
			:searchable="true"
			:columnKeys="columnKeys"
			:filterBy="filterBy"
			:defaultSort="rank?.key ?? null"
			:openable="true"
			:flagOn="flagOn"
			@setCell="
				(b, row, column, value) =>
					api.setCell(b, table.name, row, column, value)
			"
			@addRow="api.addRow(table.owner)"
			@deleteRow="(id) => api.deleteRow(table.owner, id)"
			@openRow="(id) => (openId = id)"
			@shown="(r, c) => (shown = { rows: r, columns: c })"
		/>
		<MatrixView
			v-else-if="matrixView"
			:table="table"
			:view="matrixView"
			class="max-w-2xl"
			@pickRow="(id) => (openId = id)"
		/>

		<RowCard
			v-if="openRow"
			:row="openRow"
			:table="table"
			:document="document"
			:api="api"
			@close="openId = null"
		/>
	</section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import DocTableEditor from '@/components/Documents/DocTableEditor.vue'
import MatrixView from '@/components/Documents/MatrixView.vue'
import RowCard from '@/components/Documents/RowCard.vue'
import type { DocumentApi } from '@/composables/useDocument'
import {
	columnValues,
	filterableColumns,
	flagColumns,
	formatCell,
	rankColumn,
	tableDates,
	toCsv,
	type ColumnsView,
	type DocColumn,
	type DocRow,
	type DocTable,
	type DocumentData,
	type MatrixView as Matrix,
} from '@/utils/documentTable'

// The whole table: every column, the views the author named, filters,
// the matrix and a card per row (learning-services#342). Its name is the
// table's own title — each course names its table (learning-services#360).

const props = defineProps<{
	table: DocTable
	document: DocumentData
	api: DocumentApi
}>()

const mode = ref<'table' | 'matrix'>('table')
const flag = computed(() => flagColumns(props.table)[0])
const flagOn = ref(false)
const flagCount = computed(
	() =>
		props.table.rows.filter((r) => flag.value && r[flag.value.key] === true)
			.length
)
const rank = computed(() => rankColumn(props.table))

// The fields the flag's formula reads — what decides a row is flagged.
const flagFields = computed(() => {
	const formula = flag.value?.formula ?? ''
	return props.document.blocks
		.flatMap((b) => b.fields ?? [])
		.filter(
			(f) =>
				new RegExp(`\\b${f.key}\\b`).test(formula) &&
				props.document.fields[f.key] != null
		)
		.map((f) => ({
			key: f.key,
			title: f.title,
			value: props.document.fields[f.key],
		}))
})
const dates = computed(() => tableDates(props.table, props.document))

const matrixView = computed(
	() =>
		(props.table.views.find((v) => v.type === 'matrix') as
			| Matrix
			| undefined) ?? null
)
const columnViews = computed(
	() => props.table.views.filter((v) => v.type === 'columns') as ColumnsView[]
)

// The chosen view and filter are remembered per table.
const store = (key: string) => `lms-table-${props.table.name}-${key}`
const remembered = (key: string) => {
	try {
		return localStorage.getItem(store(key)) ?? ''
	} catch {
		return ''
	}
}
const viewTitle = ref(remembered('view'))
watch(viewTitle, (v) => {
	try {
		localStorage.setItem(store('view'), v)
	} catch {
		// Not kept: the view lasts this visit.
	}
})
const columnKeys = computed(
	() =>
		columnViews.value.find((v) => v.title === viewTitle.value)?.columns ?? null
)

const filterColumns = computed(() => filterableColumns(props.table))
const filterColumn = ref('')
const filterValue = ref('')
watch(filterColumn, () => (filterValue.value = ''))
const filterValues = computed(() =>
	filterColumn.value ? columnValues(props.table, filterColumn.value) : []
)
const filterBy = computed(() =>
	filterColumn.value && filterValue.value
		? { column: filterColumn.value, value: filterValue.value }
		: null
)

const openId = ref<string | null>(null)
const openRow = computed(
	() => props.table.rows.find((r) => r.id === openId.value) ?? null
)

// What is on screen, for the CSV: the editor reports its rows and columns.
const shown = ref<{ rows: DocRow[]; columns: DocColumn[] }>({
	rows: [],
	columns: [],
})

function downloadCsv() {
	const csv = toCsv(
		shown.value.columns,
		shown.value.rows,
		props.document.tables
	)
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
	const link = window.document.createElement('a')
	link.href = URL.createObjectURL(blob)
	link.download = `${props.document.artifact}-${props.table.name}${
		viewTitle.value ? '-' + viewTitle.value : ''
	}.csv`
	link.click()
	URL.revokeObjectURL(link.href)
}
</script>

<style scoped>
.segmented {
	display: inline-flex;
	padding: 0.125rem;
	border-radius: 0.5rem;
	background-color: var(--surface-gray-2);
}

.segmented button {
	height: 1.75rem;
	padding: 0 0.75rem;
	border-radius: 0.375rem;
	font-size: 0.8125rem;
	color: var(--ink-gray-6);
}

.segmented button.is-on {
	background-color: var(--surface-base, #fff);
	color: var(--ink-gray-9);
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}
</style>
