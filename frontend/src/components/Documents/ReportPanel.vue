<template>
	<article
		v-if="report"
		class="report-page space-y-5"
		data-testid="report-panel"
	>
		<header class="flex items-start justify-between gap-3">
			<div class="space-y-1">
				<p class="text-p-sm text-ink-gray-5">{{ courseTitle }} · {{ today }}</p>
				<h1 class="text-2xl-semibold text-ink-gray-9">{{ report.title }}</h1>
			</div>
			<div class="flex shrink-0 gap-2 print:hidden">
				<Button
					v-if="report.rows.length"
					variant="subtle"
					:label="__('Copy as text')"
					data-testid="copy-report"
					@click="copy"
				>
					<template #prefix>
						<span class="lucide-copy size-4" />
					</template>
				</Button>
				<Button
					variant="solid"
					:label="__('Print or save as PDF')"
					@click="print"
				>
					<template #prefix>
						<span class="lucide-printer size-4" />
					</template>
				</Button>
			</div>
		</header>

		<!-- Nothing ticked yet: the report offers the top of the table
		rather than an empty page. -->
		<div
			v-if="!report.rows.length"
			class="space-y-3 rounded-lg border border-outline-gray-2 p-4 print:hidden"
			data-testid="report-suggest"
		>
			<p class="text-p-base text-ink-gray-7">
				{{ __('Nothing is ticked for the report yet.') }}
				<template v-if="suggested.length && report.rank">
					{{ __('Top by «{0}»:').format(report.rank.title) }}
				</template>
			</p>
			<ol v-if="suggested.length" class="space-y-1 text-p-sm text-ink-gray-8">
				<li v-for="row in suggested" :key="row.id">
					<span class="font-medium text-ink-gray-5">{{ row.id }}</span>
					{{ name(row) }}
					<span v-if="report.rank" class="text-ink-gray-5"
						>· {{ formatValue(report.rank, row[report.rank.key]) }}</span
					>
				</li>
			</ol>
			<Button
				v-if="suggested.length"
				variant="solid"
				:label="__('Tick these')"
				data-testid="tick-suggested"
				@click="tickSuggested"
			/>
		</div>

		<ol v-else class="space-y-4">
			<li
				v-for="row in report.rows"
				:key="row.id"
				class="break-inside-avoid rounded-lg border border-outline-gray-2 p-4"
			>
				<div class="text-p-xs font-medium text-ink-gray-5">{{ row.id }}</div>
				<dl class="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-[10rem_1fr]">
					<template v-for="column in report.columns" :key="column.key">
						<dt class="text-p-sm text-ink-gray-5">{{ column.title }}</dt>
						<dd class="text-p-base text-ink-gray-9">
							{{ cell(column, row) || '—' }}
						</dd>
					</template>
				</dl>
			</li>
		</ol>

		<p v-if="report.dateLabel" class="text-p-base text-ink-gray-8">
			{{ report.dateLabel }}: <strong>{{ report.date || '—' }}</strong>
		</p>
	</article>
	<p v-else class="text-p-base text-ink-gray-6">
		{{ __('This document has no report.') }}
	</p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button, toast } from 'frappe-ui'
import type { DocumentApi } from '@/composables/useDocument'
import {
	cellOptions,
	formatCell,
	formatValue,
	rankColumn,
	reportOf,
	reportRows,
	titleColumn,
	type DocColumn,
	type DocRow,
	type DocumentData,
} from '@/utils/documentTable'

// The document's report, inside its workspace; printing leaves only the
// report on the page (learning-services#342). Its title is the view's own —
// each course names its report (learning-services#360).

const props = defineProps<{
	document: DocumentData
	courseTitle: string
	api?: Pick<DocumentApi, 'write'>
}>()

const today = new Date().toLocaleDateString('ru-RU')

const report = computed(() => {
	const found = reportOf(props.document)
	if (!found) return null
	const { table, view } = found
	const { columns, rows } = reportRows(table, view)
	const field = view.field
		? props.document.blocks
				.flatMap((b) => b.fields ?? [])
				.find((f) => f.key === view.field)
		: undefined
	const tick = table.columns.find((c) => c.key === view.filter)
	return {
		title: view.title || __('Report'),
		table,
		tick,
		rank: rankColumn(table) ?? null,
		columns,
		rows,
		dateLabel: field?.title ?? '',
		date: field ? formatCell(field, props.document.fields[field.key]) : '',
	}
})

// A scale or a reference reads better by its label than by its number; a
// number, in groups of digits (learning-services#386).
function cell(column: DocColumn, row: DocRow): string {
	const option = cellOptions(column, props.document.tables).find(
		(o) => String(o.value) === String(row[column.key])
	)
	return option && column.type !== 'select'
		? option.label
		: formatValue(column, row[column.key])
}

const print = () => window.print()

const name = (row: DocRow) => {
	const title = report.value ? titleColumn(report.value.table) : undefined
	return title ? String(row[title.key] ?? '') : ''
}

// As many as the tick allows (three when it does not say), by rank.
const suggested = computed(() => {
	const r = report.value
	if (!r?.tick || !r.rank) return []
	const key = r.rank.key
	const limit = r.tick.max ?? 3
	return [...r.table.rows]
		.filter((row) => typeof row[key] === 'number')
		.sort((a, b) => Number(b[key]) - Number(a[key]))
		.slice(0, limit)
})

async function tickSuggested() {
	const r = report.value
	if (!r?.tick || !props.api) return
	await props.api.write(r.tick.block, {
		rows: suggested.value.map((row) => ({ id: row.id, [r.tick!.key]: true })),
	})
}

// The report as plain text, for a letter or a messenger.
async function copy() {
	const r = report.value
	if (!r) return
	const lines = [`${r.title} — ${props.courseTitle}, ${today}`, '']
	for (const row of r.rows) {
		lines.push(`${row.id}. ${name(row)}`)
		for (const column of r.columns) {
			const title = titleColumn(r.table)
			if (column.key === title?.key) continue
			lines.push(`   ${column.title}: ${cell(column, row) || '—'}`)
		}
		lines.push('')
	}
	if (r.dateLabel) lines.push(`${r.dateLabel}: ${r.date || '—'}`)
	try {
		await navigator.clipboard.writeText(lines.join('\n').trim())
		toast.success(__('Copied'))
	} catch {
		toast.error(__('Could not copy'))
	}
}
</script>

<style>
/* The report prints alone: the app's sidebar, the contents and the header
   stay on screen. */
@media print {
	body * {
		visibility: hidden;
	}
	.report-page,
	.report-page * {
		visibility: visible;
	}
	.report-page {
		position: absolute;
		inset: 0;
	}
	.report-page .print\:hidden {
		display: none;
	}
}
</style>
