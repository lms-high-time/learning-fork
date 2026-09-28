<template>
	<div class="space-y-3" :data-testid="`doc-table-${table.name}`">
		<!-- Toolbar: find, narrow down, pick which lessons' columns to see. -->
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
				v-for="flag in flags"
				v-show="flagCount(flag.key) || flagFilter === flag.key"
				:key="flag.key"
				type="button"
				class="chip"
				:class="{ 'is-on': flagFilter === flag.key }"
				:aria-pressed="flagFilter === flag.key"
				@click="flagFilter = flagFilter === flag.key ? null : flag.key"
			>
				{{ flag.title }}
				<span class="tabular-nums text-ink-gray-5">{{
					flagCount(flag.key)
				}}</span>
			</button>
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
						String(table.rows.length)
					)
				}}
			</div>
		</div>

		<div
			v-if="!only && groups.length > 1"
			class="flex flex-wrap items-center gap-1.5"
		>
			<span class="text-p-xs text-ink-gray-5">{{ __('Columns') }}:</span>
			<button
				v-for="group in groups"
				:key="group.block"
				type="button"
				class="chip chip-sm"
				:class="{ 'is-on': !hidden.has(group.block) }"
				:aria-pressed="!hidden.has(group.block)"
				@click="toggleGroup(group.block)"
			>
				{{ group.title }}
			</button>
		</div>

		<!-- Desktop: the table itself, scrolling sideways, ID and title pinned. -->
		<div
			v-if="!isMobile"
			class="doc-table-wrap rounded-md border border-outline-gray-2"
		>
			<table class="doc-table">
				<thead>
					<tr>
						<th class="sticky-id group-head" rowspan="2">ID</th>
						<th
							v-for="group in shownGroups"
							:key="group.block"
							class="group-head"
							:colspan="group.columns.length"
						>
							<a
								v-if="group.block && !only"
								:href="safeUrl(`#block-${group.block}`)"
								class="hover:underline"
								@click.prevent="$emit('focusBlock', group.block)"
								>{{ group.title }}</a
							>
							<span v-else>{{ group.title }}</span>
						</th>
						<th v-if="canEditRows" class="group-head" rowspan="2">
							<span class="sr-only">{{ __('Row actions') }}</span>
						</th>
					</tr>
					<tr>
						<th
							v-for="column in shownColumns"
							:key="column.key"
							:class="[
								'col-head',
								column.key === pinned ? 'sticky-title' : '',
								widthClass(column),
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
								:title="column.hint || column.title"
								@click="sortBy(column.key)"
							>
								<span>{{ column.title }}</span>
								<span
									v-if="column.required"
									class="text-ink-red-4"
									:title="
										column.required === true
											? __('Required')
											: __('Required when «{0}»').format(requiredTitle(column))
									"
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
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.id"
						:class="{ 'is-flagged': flags[0] && row[flags[0].key] === true }"
						:data-row="row.id"
					>
						<th scope="row" class="sticky-id id-cell">{{ row.id }}</th>
						<td
							v-for="column in shownColumns"
							:key="column.key"
							:class="[
								column.key === pinned ? 'sticky-title' : '',
								widthClass(column),
							]"
						>
							<TableCell
								:row="row"
								:column="column"
								:tables="tables"
								@save="
									(value) =>
										$emit('setCell', column.block, row, column.key, value)
								"
							/>
						</td>
						<td v-if="canEditRows" class="w-10 text-center">
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
							:colspan="shownColumns.length + (canEditRows ? 2 : 1)"
							class="px-3 py-6 text-center text-p-sm text-ink-gray-5"
						>
							{{
								table.rows.length
									? __('No rows match the filter')
									: __('No rows yet')
							}}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Phone: a card per row, its columns under the lesson that adds them. -->
		<div v-else class="space-y-2">
			<details
				v-for="row in rows"
				:key="row.id"
				class="rounded-md border border-outline-gray-2 bg-surface-base"
				:class="{
					'border-s-4 border-s-outline-amber-4':
						flags[0] && row[flags[0].key] === true,
				}"
				:data-row="row.id"
			>
				<summary class="flex cursor-pointer items-start gap-2 p-3">
					<span class="shrink-0 text-p-sm font-medium text-ink-gray-5">{{
						row.id
					}}</span>
					<span class="min-w-0 flex-1">
						<span class="block text-p-sm text-ink-gray-9">
							{{ (title && row[title.key]) || __('Untitled') }}
						</span>
						<!-- A lesson's view shows its values without opening the row. -->
						<span
							v-if="only && rowSummary(row)"
							class="mt-1 block text-p-sm text-ink-gray-6"
							data-testid="row-summary"
							>{{ rowSummary(row) }}</span
						>
					</span>
					<span
						v-if="rowMissing(row)"
						class="size-2 shrink-0 translate-y-1.5 rounded-full bg-surface-amber-5"
						:aria-label="__('Not filled')"
					/>
				</summary>
				<div class="space-y-4 border-t border-outline-gray-1 p-3">
					<section v-for="group in shownGroups" :key="group.block">
						<h4 class="mb-1 text-p-xs font-medium uppercase text-ink-gray-5">
							{{ group.title }}
						</h4>
						<div
							v-for="column in group.columns"
							:key="column.key"
							class="grid grid-cols-[7rem_1fr] items-start gap-2 py-0.5"
						>
							<span class="pt-2 text-p-xs text-ink-gray-6">{{
								column.title
							}}</span>
							<TableCell
								:row="row"
								:column="column"
								:tables="tables"
								@save="
									(value) =>
										$emit('setCell', column.block, row, column.key, value)
								"
							/>
						</div>
					</section>
					<Button
						v-if="canEditRows"
						variant="subtle"
						theme="red"
						size="sm"
						:label="__('Delete {0}').format(row.id)"
						@click="confirmDelete(row)"
					/>
				</div>
			</details>
			<p v-if="!rows.length" class="py-4 text-center text-p-sm text-ink-gray-5">
				{{
					table.rows.length ? __('No rows match the filter') : __('No rows yet')
				}}
			</p>
		</div>

		<Button
			v-if="canEditRows"
			variant="subtle"
			:label="__('Add a row')"
			@click="$emit('addRow')"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
		</Button>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from 'frappe-ui'
import TableCell from '@/components/Documents/TableCell.vue'
import { safeUrl } from '@/utils/safeUrl'
import { useScreenSize } from '@/utils/composables'
import {
	cellOptions,
	columnGroups,
	filterRows,
	flagColumns,
	formatCell,
	isBlank,
	isMissing,
	sortRows,
	titleColumn,
	viewColumns,
	type CellValue,
	type DocBlock,
	type DocColumn,
	type DocRow,
	type DocTable,
	type SortDirection,
} from '@/utils/documentTable'

const props = defineProps<{
	table: DocTable
	tables: Record<string, DocTable>
	blocks: DocBlock[]
	/** Rows are added and removed by the block that starts them. */
	canEditRows: boolean
	/**
	 * Only this block's columns, beside the row's name: a later lesson's block
	 * fills its own columns in place instead of in the whole register.
	 */
	only?: string
	/** Search belongs to the whole register, not to a lesson's view. */
	searchable?: boolean
}>()

const emit = defineEmits<{
	setCell: [block: string, row: DocRow, column: string, value: CellValue]
	addRow: []
	deleteRow: [id: string]
	focusBlock: [block: string]
}>()

const { isMobile } = useScreenSize()

const search = ref('')
const flagFilter = ref<string | null>(null)
const onlyMissing = ref(false)
const sortKey = ref<string | null>(null)
const sortDirection = ref<SortDirection>('asc')

// Which lessons' columns are hidden, per table, kept across visits: a wide
// register is read a few groups at a time.
const storageKey = computed(() => `lms-doc-hidden-${props.table.name}`)
const hidden = ref<Set<string>>(new Set())
try {
	const saved = JSON.parse(localStorage.getItem(storageKey.value) || '[]')
	if (Array.isArray(saved)) hidden.value = new Set(saved)
} catch {
	// Storage may be blocked; every group shows.
}
watch(
	hidden,
	(value) => {
		try {
			localStorage.setItem(storageKey.value, JSON.stringify([...value]))
		} catch {
			// Not kept: the choice lasts this visit.
		}
	},
	{ deep: true }
)

const groups = computed(() => columnGroups(props.table, props.blocks))
const title = computed(() => titleColumn(props.table))
const flags = computed(() => flagColumns(props.table))

const shownGroups = computed(() => {
	if (props.only) {
		// A lesson's view: the row's name and the numbers it is read by, then
		// the lesson's own columns (learning-services#342).
		const columns = viewColumns(props.table, props.only)
		const own = columns.filter((c) => c.block === props.only)
		const lead = columns.filter((c) => c.block !== props.only)
		const blockTitle =
			props.blocks.find((b) => b.key === props.only)?.title ?? props.only
		return [
			...(lead.length
				? [{ block: '', title: props.table.title || '', columns: lead }]
				: []),
			...(own.length
				? [{ block: props.only, title: blockTitle, columns: own }]
				: []),
		]
	}
	return groups.value.filter((g) => !hidden.value.has(g.block))
})
const shownColumns = computed(() => shownGroups.value.flatMap((g) => g.columns))

// The row's name stays in view beside its ID while the table scrolls — only
// when it is the first column shown: pinned further in, it would slide over
// the columns before it.
const pinned = computed(() =>
	shownColumns.value[0]?.key === title.value?.key ? title.value?.key : null
)

// What the counts and filters look at: in a block's own view, its columns
// only — «empty cells» there means the block's, not the whole register's.
const scope = computed(() =>
	props.only ? { ...props.table, columns: shownColumns.value } : props.table
)

const rows = computed(() =>
	sortRows(
		filterRows(scope.value, {
			search: search.value,
			flag: flagFilter.value,
			missing: onlyMissing.value,
		}),
		sortKey.value,
		sortDirection.value
	)
)

// «4 — Вероятно · 5 — Критическое · 20»: a row's lesson values in a line.
function rowSummary(row: DocRow): string {
	return shownColumns.value
		.filter((c) => c.key !== title.value?.key && !isBlank(row[c.key]))
		.map((c) => {
			const option = cellOptions(c, props.tables).find(
				(o) => String(o.value) === String(row[c.key])
			)
			if (c.type === 'formula' && typeof row[c.key] === 'boolean')
				return row[c.key] ? c.title : ''
			return option && c.type !== 'select'
				? option.label
				: formatCell(c, row[c.key])
		})
		.filter(Boolean)
		.join(' · ')
}

const rowMissing = (row: DocRow): number =>
	scope.value.columns.filter((c) => isMissing(c, row)).length

const missingRows = computed(
	() => props.table.rows.filter((r) => rowMissing(r) > 0).length
)

const flagCount = (key: string): number =>
	props.table.rows.filter((r) => r[key] === true).length

function toggleGroup(block: string) {
	const next = new Set(hidden.value)
	if (next.has(block)) next.delete(block)
	else next.add(block)
	// At least one group stays: an empty table reads as a broken one.
	if (next.size < groups.value.length) hidden.value = next
}

function sortBy(key: string) {
	if (sortKey.value !== key) {
		sortKey.value = key
		sortDirection.value = 'asc'
	} else if (sortDirection.value === 'asc') sortDirection.value = 'desc'
	else sortKey.value = null
}

function requiredTitle(column: DocColumn): string {
	const other = props.table.columns.find((c) => c.key === column.required)
	return other?.title ?? String(column.required)
}

function widthClass(column: DocColumn): string {
	if (['scale', 'number', 'formula', 'check'].includes(column.type))
		return 'w-narrow'
	if (['date', 'select', 'ref'].includes(column.type)) return 'w-mid'
	return 'w-wide'
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

.chip-sm {
	height: 1.625rem;
	font-size: 0.75rem;
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

.group-head {
	padding: 0.375rem 0.625rem;
	font-size: 0.75rem;
	font-weight: 600;
	text-align: start;
	color: var(--ink-gray-7);
	background-color: var(--surface-gray-1) !important;
	white-space: nowrap;
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

.w-narrow {
	min-width: 5.5rem;
}

.w-mid {
	min-width: 9rem;
}

.w-wide {
	min-width: 14rem;
	max-width: 22rem;
}

tr.is-flagged .id-cell {
	box-shadow: inset 3px 0 0 var(--outline-amber-4);
}
</style>
