<template>
	<div class="fixed inset-0 z-30" @keydown.esc="$emit('close')">
		<div
			class="absolute inset-0 bg-black/20"
			aria-hidden="true"
			@click="$emit('close')"
		/>
		<aside
			ref="panel"
			class="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-surface-base shadow-xl"
			role="dialog"
			aria-modal="true"
			:aria-label="`${row.id} — ${name}`"
			tabindex="-1"
			data-testid="row-card"
		>
			<header class="flex items-start gap-3 border-b border-outline-gray-1 p-4">
				<div class="min-w-0 flex-1">
					<div class="text-p-xs font-medium text-ink-gray-5">{{ row.id }}</div>
					<h2 class="text-lg-semibold text-ink-gray-9">{{ name }}</h2>
				</div>
				<Button variant="ghost" :label="__('Close')" @click="$emit('close')">
					<template #icon>
						<span class="lucide-x size-4" />
					</template>
				</Button>
			</header>

			<div class="min-w-0 flex-1 space-y-5 overflow-y-auto p-4">
				<section v-for="group in groups" :key="group.block">
					<h3 class="mb-1 text-p-xs font-medium uppercase text-ink-gray-5">
						{{ group.title }}
					</h3>
					<div
						v-for="column in group.columns"
						:key="column.key"
						class="grid grid-cols-[8rem_1fr] items-start gap-2 py-0.5"
					>
						<span class="pt-2 text-p-xs text-ink-gray-6">{{
							column.title
						}}</span>
						<TableCell
							:row="row"
							:column="column"
							:tables="document.tables"
							@save="
								(value) =>
									api.setCell(column.block, table.name, row, column.key, value)
							"
						/>
					</div>
				</section>
			</div>

			<footer
				v-if="referring.length"
				class="space-y-2 border-t border-outline-gray-1 p-4"
			>
				<Button
					v-for="item in referring"
					:key="item.table.name"
					variant="subtle"
					class="w-full"
					:label="
						__('Add to «{0}»').format(item.table.title || item.table.name)
					"
					:data-testid="`refer-${item.table.name}`"
					@click="refer(item.table.owner, item.column.key)"
				>
					<template #prefix>
						<span class="lucide-corner-down-right size-4" />
					</template>
				</Button>
			</footer>
		</aside>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from 'frappe-ui'
import TableCell from '@/components/Documents/TableCell.vue'
import type { DocumentApi } from '@/composables/useDocument'
import {
	columnGroups,
	referringTables,
	titleColumn,
	type DocRow,
	type DocTable,
	type DocumentData,
} from '@/utils/documentTable'

// A row of the register whole: every field under the lesson that adds it,
// and a way to carry it into a table that points at it — a triggered risk
// into «Проблемы» (learning-services#342).

const props = defineProps<{
	row: DocRow
	table: DocTable
	document: DocumentData
	api: DocumentApi
}>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const panel = ref<HTMLElement | null>(null)
onMounted(() => panel.value?.focus())

const name = computed(() => {
	const title = titleColumn(props.table)
	return (title && (props.row[title.key] as string)) || ''
})
const groups = computed(() => columnGroups(props.table, props.document.blocks))
const referring = computed(() =>
	referringTables(props.table, props.document.tables)
)

async function refer(block: string, column: string) {
	const created = await props.api.addRow(block, { [column]: props.row.id })
	if (!created) return
	emit('close')
	router.push({
		name: 'Document',
		params: {
			courseName: props.document.course,
			artifact: props.document.artifact,
			view: block,
		},
	})
}
</script>
