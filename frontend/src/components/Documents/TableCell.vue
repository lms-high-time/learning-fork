<template>
	<div
		class="doc-cell"
		:class="{
			'is-missing': missing,
			'is-clarify': clarify,
			'is-editing': editing,
		}"
		:data-testid="`cell-${row.id}-${column.key}`"
	>
		<textarea
			v-if="editing"
			ref="input"
			rows="3"
			v-model="draft"
			class="doc-input resize-y"
			:maxlength="MAX_TEXT"
			:aria-label="`${row.id} — ${column.title}`"
			:aria-required="required || undefined"
			:aria-invalid="missing || undefined"
			@keydown.enter.exact.prevent="
				;($event.target as HTMLTextAreaElement).blur()
			"
			@keydown.esc.stop.prevent="cancel"
			@blur="saveText"
		/>

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
	MAX_TEXT,
	isBlank,
	isMissing,
	isRequired,
	isToClarify,
	type DocColumn,
	type DocRow,
} from '@/utils/documentTable'

// A cell of a `many` block: text, the only kind there is (learning-services#515).

const props = defineProps<{
	row: DocRow
	column: DocColumn
}>()

/** The new text; empty clears the cell. */
const emit = defineEmits<{ save: [value: string] }>()

const editing = ref(false)
// What is being typed: its own copy, so the document read back after another
// cell's write does not wipe it.
const draft = ref('')
const input = ref<HTMLTextAreaElement | null>(null)
let cancelled = false

const value = computed(() => props.row[props.column.key])
const missing = computed(() => isMissing(props.column, props.row))
const required = computed(() => isRequired(props.column, props.row))
const clarify = computed(() => isToClarify(value.value))
const shown = computed(() => (isBlank(value.value) ? '' : String(value.value)))

async function startEditing() {
	draft.value = shown.value
	editing.value = true
	cancelled = false
	await nextTick()
	input.value?.focus()
}

function cancel() {
	cancelled = true
	editing.value = false
}

function saveText() {
	editing.value = false
	if (cancelled) {
		cancelled = false
		return
	}
	const next = draft.value.trim()
	if (next === shown.value.trim()) return
	emit('save', next)
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
