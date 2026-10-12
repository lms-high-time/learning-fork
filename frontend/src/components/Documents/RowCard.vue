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

			<div class="min-w-0 flex-1 space-y-1 overflow-y-auto p-4">
				<div
					v-for="column in block.columns"
					:key="column.key"
					class="grid grid-cols-[8rem_1fr] items-start gap-2 py-0.5"
				>
					<span class="pt-2 text-p-xs text-ink-gray-6">{{ column.title }}</span>
					<TableCell
						:row="row"
						:column="column"
						@save="(value) => api.setCell(block.key, row, column.key, value)"
					/>
				</div>
			</div>
		</aside>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Button } from 'frappe-ui'
import TableCell from '@/components/Documents/TableCell.vue'
import type { DocumentApi } from '@/composables/useDocument'
import { titleColumn, type DocRow, type ManyBlock } from '@/utils/documentTable'

// A row in full, every column one under another: a wide block reads better
// here than scrolled sideways (learning-services#342).

const props = defineProps<{
	row: DocRow
	block: ManyBlock
	api: DocumentApi
}>()
defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
onMounted(() => panel.value?.focus())

const name = computed(() => {
	const title = titleColumn(props.block.columns)
	return (title && props.row[title.key]) || ''
})
</script>
