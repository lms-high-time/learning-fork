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
			<Button
				class="print:hidden"
				variant="solid"
				:label="__('Print or save as PDF')"
				@click="print"
			>
				<template #prefix>
					<span class="lucide-printer size-4" />
				</template>
			</Button>
		</header>

		<p v-if="!report.rows.length" class="text-p-base text-ink-gray-6">
			{{ __('No rows are ticked for the report yet. Tick them in the table.') }}
		</p>

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
import { Button } from 'frappe-ui'
import {
	cellOptions,
	formatCell,
	reportRows,
	type DocColumn,
	type DocRow,
	type DocumentData,
	type ReportView,
} from '@/utils/documentTable'

// The report for the sponsor, inside the document's workspace; printing
// leaves only the report on the page (learning-services#342).

const props = defineProps<{ document: DocumentData; courseTitle: string }>()

const today = new Date().toLocaleDateString('ru-RU')

const report = computed(() => {
	for (const table of Object.values(props.document.tables)) {
		const view = table.views.find((v) => v.type === 'report') as
			| ReportView
			| undefined
		if (!view) continue
		const { columns, rows } = reportRows(table, view)
		const field = view.field
			? props.document.blocks
					.flatMap((b) => b.fields ?? [])
					.find((f) => f.key === view.field)
			: undefined
		return {
			title: view.title || __('Report for the sponsor'),
			columns,
			rows,
			dateLabel: field?.title ?? '',
			date: field ? formatCell(field, props.document.fields[field.key]) : '',
		}
	}
	return null
})

// A scale or a reference reads better by its label than by its number.
function cell(column: DocColumn, row: DocRow): string {
	const option = cellOptions(column, props.document.tables).find(
		(o) => String(o.value) === String(row[column.key])
	)
	return option && column.type !== 'select'
		? option.label
		: formatCell(column, row[column.key])
}

const print = () => window.print()
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
