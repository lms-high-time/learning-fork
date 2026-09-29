<template>
	<div
		class="doc-cell"
		:class="{
			'is-missing': missing,
			'is-clarify': clarify,
			'is-formula': column.type === 'formula',
			'is-editing': editing,
		}"
		:data-testid="`cell-${row.id}-${column.key}`"
	>
		<!-- Formula: the server's, read-only. A boolean reads as a mark. -->
		<template v-if="column.type === 'formula'">
			<span
				v-if="typeof value === 'boolean'"
				class="inline-flex items-center rounded px-1.5 py-0.5 text-p-xs font-medium"
				:class="
					value ? 'bg-surface-amber-2 text-ink-amber-8' : 'text-ink-gray-4'
				"
				>{{ value ? __('Yes') : __('No') }}</span
			>
			<span v-else class="tabular-nums font-medium text-ink-gray-8">{{
				shown
			}}</span>
		</template>

		<!-- A tick is its own editor: one click, no second step. -->
		<label
			v-else-if="column.type === 'check'"
			class="flex h-full w-full cursor-pointer items-center justify-center"
		>
			<input
				type="checkbox"
				class="rounded border-outline-gray-3"
				:checked="Boolean(value)"
				:aria-label="`${row.id} — ${column.title}`"
				@change="save(($event.target as HTMLInputElement).checked)"
			/>
		</label>

		<template v-else-if="editing">
			<select
				v-if="options.length"
				ref="input"
				class="doc-input"
				:value="value ?? ''"
				:aria-label="`${row.id} — ${column.title}`"
				@change="save(($event.target as HTMLSelectElement).value)"
				@blur="editing = false"
				@keydown.esc.prevent="editing = false"
			>
				<option value="">—</option>
				<option v-for="o in options" :key="o.value" :value="o.value">
					{{ o.label }}
				</option>
			</select>
			<input
				v-else-if="column.type === 'date'"
				ref="input"
				type="date"
				class="doc-input"
				:value="value ?? ''"
				:aria-label="`${row.id} — ${column.title}`"
				@change="save(($event.target as HTMLInputElement).value)"
				@blur="editing = false"
				@keydown.esc.prevent="editing = false"
			/>
			<input
				v-else-if="column.type === 'number'"
				ref="input"
				type="text"
				inputmode="decimal"
				class="doc-input"
				:value="value ?? ''"
				:aria-label="`${row.id} — ${column.title}`"
				@keydown.enter.prevent=";($event.target as HTMLInputElement).blur()"
				@keydown.esc.prevent="cancel"
				@blur="saveText(($event.target as HTMLInputElement).value)"
			/>
			<textarea
				v-else
				ref="input"
				rows="3"
				class="doc-input resize-y"
				:value="(value as string) ?? ''"
				:aria-label="`${row.id} — ${column.title}`"
				@keydown.enter.exact.prevent="
					;($event.target as HTMLTextAreaElement).blur()
				"
				@keydown.esc.prevent="cancel"
				@blur="saveText(($event.target as HTMLTextAreaElement).value)"
			/>
		</template>

		<button
			v-else
			type="button"
			class="doc-cell-view"
			:aria-label="`${row.id} — ${column.title}: ${shown || __('empty')}`"
			@click="startEditing"
		>
			<span v-if="shown" class="whitespace-pre-line break-words">{{
				shown
			}}</span>
			<span v-else-if="missing" class="text-ink-red-4">{{
				__('Fill in')
			}}</span>
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
	cellOptions,
	formatValue,
	isMissing,
	isToClarify,
	type CellValue,
	type DocColumn,
	type DocRow,
	type DocTable,
} from '@/utils/documentTable'

const props = defineProps<{
	row: DocRow
	column: DocColumn
	tables: Record<string, DocTable>
}>()

const emit = defineEmits<{ save: [value: CellValue] }>()

const editing = ref(false)
const input = ref<
	HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
>(null)
let cancelled = false

const value = computed(() => props.row[props.column.key])
const options = computed(() => cellOptions(props.column, props.tables))
const missing = computed(() => isMissing(props.column, props.row))
const clarify = computed(() => isToClarify(value.value))

// A scale cell shows its label too: «4 — Вероятно» says more than «4».
// A number is read in groups of digits, «900 000», as the canvas writes it;
// its input keeps the bare number (learning-services#386).
const shown = computed(() => {
	const option = options.value.find(
		(o) => String(o.value) === String(value.value)
	)
	if (option && props.column.type !== 'select') return option.label
	return formatValue(props.column, value.value)
})

async function startEditing() {
	editing.value = true
	cancelled = false
	await nextTick()
	input.value?.focus()
}

function cancel() {
	cancelled = true
	editing.value = false
}

function save(next: CellValue) {
	editing.value = false
	const typed =
		props.column.type === 'scale' && next !== '' && next !== null
			? Number(next)
			: next
	if (String(typed ?? '') === String(value.value ?? '')) return
	emit('save', typed === '' ? null : typed)
}

function saveText(text: string) {
	if (cancelled) {
		cancelled = false
		return
	}
	save(text.trim())
}
</script>

<style scoped>
.doc-cell {
	position: relative;
	min-height: 2.25rem;
	height: 100%;
}

.doc-cell-view {
	display: block;
	width: 100%;
	height: 100%;
	min-height: 2.25rem;
	padding: 0.5rem 0.625rem;
	text-align: start;
	font-size: 0.8125rem;
	line-height: 1.35;
	color: var(--ink-gray-8);
	border-radius: 0.25rem;
}

.doc-cell-view:hover {
	background-color: var(--surface-gray-1);
}

.doc-cell-view:focus-visible {
	outline: 2px solid var(--outline-gray-4);
	outline-offset: -2px;
}

.is-formula {
	display: flex;
	align-items: center;
	padding: 0.5rem 0.625rem;
	font-size: 0.8125rem;
	background-color: var(--surface-gray-1);
}

.is-missing .doc-cell-view {
	box-shadow: inset 0 0 0 1px var(--outline-red-2, #fecaca);
	background-color: var(--surface-red-1, #fef2f2);
}

.is-clarify .doc-cell-view {
	background-color: var(--surface-amber-1, #fffbeb);
}

.doc-input {
	display: block;
	width: 100%;
	min-height: 2.25rem;
	padding: 0.4rem 0.5rem;
	font-size: 0.8125rem;
	line-height: 1.35;
	color: var(--ink-gray-9);
	background-color: var(--surface-base, #fff);
	border: 1px solid var(--outline-gray-3);
	border-radius: 0.25rem;
}

.doc-input:focus {
	outline: 2px solid var(--outline-gray-4);
	outline-offset: -1px;
}
</style>
