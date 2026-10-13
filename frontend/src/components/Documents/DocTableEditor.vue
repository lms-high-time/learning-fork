<template>
	<div class="space-y-3" :data-testid="`doc-table-${block.key}`">
		<!-- Toolbar: find, narrow down to what still lacks a cell. -->
		<div class="flex flex-wrap items-center gap-2">
			<div v-if="searchable" class="relative w-full sm:w-56">
				<span
					class="lucide-search pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5"
				/>
				<input
					v-model="search"
					type="search"
					class="h-8 w-full rounded border border-outline-gray-2 bg-surface-base ps-8 pe-2 text-p-sm text-ink-gray-8"
					:placeholder="__('Search the table')"
					:aria-label="__('Search the table')"
				/>
			</div>
			<!-- A filter with nothing to show is noise: a zero hides the chip. -->
			<button
				v-show="missingRows || onlyMissing"
				type="button"
				class="chip"
				:class="{ 'is-on': onlyMissing }"
				:aria-pressed="onlyMissing"
				data-testid="show-unfilled"
				@click="onlyMissing = !onlyMissing"
			>
				{{ __('Show unfilled') }}
				<span class="tabular-nums text-ink-gray-5">{{ missingRows }}</span>
			</button>
			<div class="ms-auto text-p-sm text-ink-gray-5 tabular-nums">
				{{
					__('{0} of {1} rows').format(
						String(rows.length),
						String(block.items.length)
					)
				}}
			</div>
		</div>

		<!-- Desktop: the table itself, scrolling sideways, ID and title pinned. -->
		<div
			v-if="!isMobile"
			class="doc-table-wrap rounded-md border border-outline-gray-2"
		>
			<table class="doc-table">
				<thead>
					<tr>
						<th class="sticky-id col-head">ID</th>
						<th
							v-for="column in block.columns"
							:key="column.key"
							:class="[
								'col-head',
								'w-wide',
								column.key === pinned ? 'sticky-title' : '',
							]"
							:aria-sort="
								sortKey === column.key
									? sortDirection === 'asc'
										? 'ascending'
										: 'descending'
									: undefined
							"
						>
							<button
								type="button"
								class="flex w-full items-center gap-1 text-start"
								:title="column.title"
								@click="sortBy(column.key)"
							>
								<span>{{ column.title }}</span>
								<span
									v-if="requiredTitle(column)"
									class="text-ink-red-4"
									:title="requiredTitle(column)"
									aria-hidden="true"
									>*</span
								>
								<span
									v-if="sortKey === column.key"
									:class="
										sortDirection === 'asc'
											? 'lucide-arrow-up'
											: 'lucide-arrow-down'
									"
									class="size-3 shrink-0 text-ink-gray-5"
								/>
							</button>
						</th>
						<th class="col-head">
							<span class="sr-only">{{ __('Row actions') }}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in rows" :key="row.id" :data-row="row.id">
						<th scope="row" class="sticky-id id-cell">
							<button
								type="button"
								class="font-medium text-ink-gray-7 underline decoration-outline-gray-3 underline-offset-2 hover:text-ink-gray-9"
								:aria-label="__('Open {0}').format(row.id)"
								@click="$emit('openRow', row.id)"
							>
								{{ row.id }}
							</button>
						</th>
						<td
							v-for="column in block.columns"
							:key="column.key"
							:class="['w-wide', column.key === pinned ? 'sticky-title' : '']"
						>
							<TableCell
								:row="row"
								:column="column"
								@save="(value) => $emit('setCell', row, column.key, value)"
							/>
						</td>
						<td class="w-10 text-center">
							<Button
								variant="ghost"
								size="sm"
								:label="__('Delete {0}').format(row.id)"
								@click="confirmDelete(row)"
							>
								<template #icon>
									<span class="lucide-trash-2 size-4 text-ink-gray-5" />
								</template>
							</Button>
						</td>
					</tr>
					<tr v-if="!rows.length">
						<td
							:colspan="block.columns.length + 2"
							class="px-3 py-6 text-center text-p-sm text-ink-gray-5"
						>
							{{
								block.items.length
									? __('No rows match the filter')
									: __('No rows yet')
							}}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Phone: a card per row. -->
		<div v-else class="space-y-2">
			<details
				v-for="row in rows"
				:key="row.id"
				class="rounded-md border border-outline-gray-2 bg-surface-base"
				:data-row="row.id"
			>
				<summary class="flex cursor-pointer items-start gap-2 p-3">
					<span class="shrink-0 text-p-sm font-medium text-ink-gray-5">{{
						row.id
					}}</span>
					<span class="min-w-0 flex-1 text-p-sm text-ink-gray-9">
						{{ (title && row[title.key]) || __('Untitled') }}
					</span>
					<span
						v-if="rowMissing(row)"
						class="size-2 shrink-0 translate-y-1.5 rounded-full bg-surface-amber-5"
						:aria-label="__('Not filled')"
					/>
				</summary>
				<div class="space-y-1 border-t border-outline-gray-1 p-3">
					<div
						v-for="column in block.columns"
						:key="column.key"
						class="grid grid-cols-[7rem_1fr] items-start gap-2 py-0.5"
					>
						<span class="pt-2 text-p-xs text-ink-gray-6">{{
							column.title
						}}</span>
						<TableCell
							:row="row"
							:column="column"
							@save="(value) => $emit('setCell', row, column.key, value)"
						/>
					</div>
					<Button
						variant="subtle"
						theme="red"
						size="sm"
						class="mt-3"
						:label="__('Delete {0}').format(row.id)"
						@click="confirmDelete(row)"
					/>
				</div>
			</details>
			<p v-if="!rows.length" class="py-4 text-center text-p-sm text-ink-gray-5">
				{{
					block.items.length
						? __('No rows match the filter')
						: __('No rows yet')
				}}
			</p>
		</div>

		<Button variant="subtle" :label="__('Add a row')" @click="$emit('addRow')">
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
		</Button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from 'frappe-ui'
import TableCell from '@/components/Documents/TableCell.vue'
import { useScreenSize } from '@/utils/composables'
import {
	conditionTitle,
	filterRows,
	isMissing,
	sortRows,
	titleColumn,
	type DocColumn,
	type DocRow,
	type ManyBlock,
	type SortDirection,
} from '@/utils/documentTable'

// A block filled row by row (`rows: many`, learning-services#515): its rows,
// one column per column of the section, every cell text.

// The row's ID opens its card: a wide block reads better there.
const props = defineProps<{
	block: ManyBlock
}>()

const emit = defineEmits<{
	setCell: [row: DocRow, column: string, value: string]
	addRow: []
	deleteRow: [id: string]
	openRow: [id: string]
}>()

const { isMobile } = useScreenSize()

// A handful of rows is read at a glance; a search earns its place on a longer
// table.
const SEARCH_FROM = 8
const searchable = computed(() => props.block.items.length >= SEARCH_FROM)

const search = ref('')
const onlyMissing = ref(false)
const sortKey = ref<string | null>(null)
const sortDirection = ref<SortDirection>('asc')

const title = computed(() => titleColumn(props.block.columns))

// The row's name stays in view beside its ID while the table scrolls — only
// when it is the first column: pinned further in, it would slide over the
// columns before it.
const pinned = computed(() =>
	props.block.columns[0]?.key === title.value?.key ? title.value?.key : null
)

const rows = computed(() =>
	sortRows(
		filterRows(props.block.items, props.block.columns, {
			search: search.value,
			missing: onlyMissing.value,
		}),
		sortKey.value,
		sortDirection.value
	)
)

const rowMissing = (row: DocRow): number =>
	props.block.columns.filter((c) => isMissing(c, row)).length

const missingRows = computed(
	() => props.block.items.filter((r) => rowMissing(r) > 0).length
)

function sortBy(key: string) {
	if (sortKey.value !== key) {
		sortKey.value = key
		sortDirection.value = 'asc'
	} else if (sortDirection.value === 'asc') sortDirection.value = 'desc'
	else sortKey.value = null
}

/** Why a column is marked: always, or once the column it depends on is filled. */
function requiredTitle(column: DocColumn): string {
	if (column.required === true) return __('Required')
	const other = conditionTitle(column, props.block.columns)
	return other ? __('Required when «{0}» is filled').format(other) : ''
}

function confirmDelete(row: DocRow) {
	const name = title.value ? row[title.value.key] : ''
	const text = name
		? __('Delete {0} «{1}»?').format(row.id, String(name))
		: __('Delete {0}?').format(row.id)
	if (window.confirm(text)) emit('deleteRow', row.id)
}
</script>

<style scoped>
.chip {
	display: inline-flex;
	align-items: center;
	gap: 0.375rem;
	height: 2rem;
	padding: 0 0.625rem;
	border-radius: 9999px;
	border: 1px solid var(--outline-gray-2);
	font-size: 0.8125rem;
	color: var(--ink-gray-7);
	background-color: var(--surface-base, #fff);
}

.chip.is-on {
	border-color: var(--outline-gray-5);
	color: var(--ink-gray-9);
	background-color: var(--surface-gray-2);
}

/* Positioned, so an absolute child — the sr-only header of the actions
   column — is clipped with the rest instead of widening the page. */
.doc-table-wrap {
	position: relative;
	overflow-x: auto;
	max-width: 100%;
}

.doc-table {
	border-collapse: separate;
	border-spacing: 0;
	min-width: 100%;
	font-size: 0.8125rem;
}

.doc-table th,
.doc-table td {
	border-bottom: 1px solid var(--outline-gray-1);
	border-inline-end: 1px solid var(--outline-gray-1);
	vertical-align: top;
	background-color: var(--surface-base, #fff);
}

.col-head {
	padding: 0.375rem 0.625rem;
	font-weight: 500;
	text-align: start;
	color: var(--ink-gray-6);
	background-color: var(--surface-gray-1) !important;
}

.id-cell {
	padding: 0.5rem 0.625rem;
	font-weight: 500;
	color: var(--ink-gray-6);
	white-space: nowrap;
}

.sticky-id {
	position: sticky;
	inset-inline-start: 0;
	z-index: 2;
	width: 3.25rem;
	min-width: 3.25rem;
}

.sticky-title {
	position: sticky;
	inset-inline-start: 3.25rem;
	z-index: 1;
	box-shadow: 1px 0 0 var(--outline-gray-2);
}

.w-wide {
	min-width: 14rem;
	max-width: 22rem;
}
</style>
