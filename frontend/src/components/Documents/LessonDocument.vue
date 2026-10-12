<template>
	<article class="space-y-5" :data-testid="`lesson-document-${block.key}`">
		<header class="space-y-1">
			<div class="flex items-start justify-between gap-3">
				<h1 class="text-2xl-semibold text-ink-gray-9">{{ block.title }}</h1>
				<div class="flex shrink-0 items-center gap-2">
					<StateBadge :state="state" />
					<Dropdown
						v-if="menu.length"
						:options="menu"
						:button="{
							icon: 'more-horizontal',
							variant: 'ghost',
							label: __('More'),
						}"
					/>
				</div>
			</div>
			<router-link
				v-if="lesson"
				:to="lesson.route"
				class="inline-block text-p-sm text-ink-gray-5 underline decoration-outline-gray-2 underline-offset-2 hover:text-ink-gray-8"
				data-testid="block-lesson"
			>
				{{ __('Lesson {0} · {1}').format(String(lesson.number), lesson.title) }}
			</router-link>
		</header>

		<!-- What the block is for, as the course says it to the student. -->
		<p
			v-if="block.description"
			class="whitespace-pre-line text-p-sm leading-relaxed text-ink-gray-7"
			data-testid="block-description"
		>
			{{ block.description }}
		</p>

		<DocTableEditor
			v-if="many"
			:block="many"
			:openable="true"
			@setCell="
				(row, column, value) => api.setCell(block.key, row, column, value)
			"
			@addRow="api.addRow(block.key)"
			@deleteRow="(id) => api.deleteRow(block.key, id)"
			@openRow="(id) => (openId = id)"
		/>
		<BlockFields
			v-else-if="one"
			:columns="one.columns"
			:values="one.values ?? {}"
			@save="(key, value) => api.setField(block.key, key, value)"
		/>

		<RowCard
			v-if="openRow && many"
			:row="openRow"
			:block="many"
			:api="api"
			@close="openId = null"
		/>

		<!-- Documents in course order, without going back to the contents. -->
		<nav
			v-if="prev || next"
			class="flex items-center justify-between gap-3 border-t border-outline-gray-1 pt-4 text-p-sm"
			:aria-label="__('Other documents')"
		>
			<router-link
				v-if="prev"
				:to="prev.to"
				class="flex min-w-0 items-center gap-1 text-ink-gray-7 hover:text-ink-gray-9"
				data-testid="prev-document"
			>
				<span class="lucide-arrow-left size-4 shrink-0" />
				<span class="truncate">{{ prev.title }}</span>
			</router-link>
			<span v-else />
			<router-link
				v-if="next"
				:to="next.to"
				class="flex min-w-0 items-center gap-1 text-ink-gray-7 hover:text-ink-gray-9"
				data-testid="next-document"
			>
				<span class="truncate">{{ next.title }}</span>
				<span class="lucide-arrow-right size-4 shrink-0" />
			</router-link>
		</nav>
	</article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Dropdown } from 'frappe-ui'
import BlockFields from '@/components/Documents/BlockFields.vue'
import DocTableEditor from '@/components/Documents/DocTableEditor.vue'
import RowCard from '@/components/Documents/RowCard.vue'
import StateBadge from '@/components/Documents/StateBadge.vue'
import type { DocumentApi } from '@/composables/useDocument'
import {
	blockState,
	isMany,
	isTouched,
	type DocBlock,
} from '@/utils/documentTable'

// One lesson's block, on its own page (learning-services#342): rows for a
// block filled row by row, fields for one filled once (#515).

const props = defineProps<{
	block: DocBlock
	api: DocumentApi
	/** The lesson that builds it, and the way back to it. */
	lesson?: { number: number; title: string; route: RouteLocationRaw } | null
	prev?: { title: string; to: RouteLocationRaw } | null
	next?: { title: string; to: RouteLocationRaw } | null
}>()

const state = computed(() => blockState(props.block))
const many = computed(() => (isMany(props.block) ? props.block : null))
const one = computed(() => (isMany(props.block) ? null : props.block))

const openId = ref<string | null>(null)
const openRow = computed(
	() => many.value?.items.find((r) => r.id === openId.value) ?? null
)
watch(
	() => props.block.key,
	() => (openId.value = null)
)

const menu = computed(() =>
	isTouched(props.block)
		? [{ label: __('Clear'), icon: 'trash-2', onClick: clear }]
		: []
)

async function clear() {
	const question = isMany(props.block)
		? __('Delete every row of this document?')
		: __('Clear every field of this document?')
	if (!window.confirm(question)) return
	await props.api.clear(props.block.key)
}
</script>
