<template>
	<div class="grid gap-3 sm:grid-cols-2" data-testid="block-fields">
		<label
			v-for="column in columns"
			:key="column.key"
			class="block space-y-1"
			:data-testid="`field-${column.key}`"
		>
			<span class="flex items-center gap-1 text-p-sm text-ink-gray-7">
				{{ column.title }}
				<span
					v-if="required(column)"
					class="text-ink-red-4"
					:title="required(column)"
					aria-hidden="true"
					>*</span
				>
			</span>
			<textarea
				rows="2"
				class="field-input resize-y"
				:class="{
					'is-missing': isMissing(column, values),
					'is-clarify': isToClarify(values[column.key]),
				}"
				:maxlength="MAX_TEXT"
				:value="shown(column)"
				:aria-required="isRequired(column, values) || undefined"
				:aria-invalid="isMissing(column, values) || undefined"
				@focus="focus(column)"
				@input="draft = ($event.target as HTMLTextAreaElement).value"
				@blur="save(column)"
			/>
		</label>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	MAX_TEXT,
	conditionTitle,
	isMissing,
	isRequired,
	isToClarify,
	type CellValue,
	type DocColumn,
} from '@/utils/documentTable'

// The fields of a block filled once (`rows: one`, learning-services#515): its
// columns, each a text the student writes.

const props = defineProps<{
	columns: DocColumn[]
	values: Record<string, CellValue>
}>()

/** The field's new text; empty clears it. */
const emit = defineEmits<{ save: [key: string, value: string] }>()

// The field being typed into keeps its own copy: the document read back after
// another field's write must not wipe what is half typed.
const focused = ref<string | null>(null)
const draft = ref('')

const stored = (column: DocColumn): string =>
	String(props.values[column.key] ?? '')

const shown = (column: DocColumn): string =>
	focused.value === column.key ? draft.value : stored(column)

function focus(column: DocColumn) {
	focused.value = column.key
	draft.value = stored(column)
}

/** Why the field is marked: always, or once the field it depends on is filled. */
function required(column: DocColumn): string {
	if (column.required === true) return __('Required')
	const other = conditionTitle(column, props.columns)
	return other ? __('Required when “{0}” is filled').format(other) : ''
}

function save(column: DocColumn) {
	if (focused.value !== column.key) return
	const value = draft.value.trim()
	focused.value = null
	if (stored(column).trim() === value) return
	emit('save', column.key, value)
}
</script>

<style scoped>
.field-input {
	display: block;
	width: 100%;
	min-height: 2.25rem;
	padding: 0.4rem 0.625rem;
	font-size: 0.875rem;
	color: var(--ink-gray-9);
	background-color: var(--surface-base, #fff);
	border: 1px solid var(--outline-gray-2);
	border-radius: 0.375rem;
}

.field-input:focus {
	outline: 2px solid var(--outline-gray-4);
	outline-offset: -1px;
}

.field-input.is-missing {
	border-color: var(--outline-red-3);
	background-color: var(--surface-red-1);
}

.field-input.is-clarify {
	background-color: var(--surface-amber-1, #fffbeb);
}
</style>
