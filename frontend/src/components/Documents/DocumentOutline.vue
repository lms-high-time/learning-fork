<template>
	<nav
		class="space-y-4"
		:aria-label="__('Document contents')"
		data-testid="document-outline"
	>
		<div v-if="specials.length" class="space-y-0.5">
			<router-link
				v-for="item in specials"
				:key="item.view"
				:to="to(item.view)"
				class="outline-link"
				:class="{ 'is-active': active === item.view }"
				:aria-current="active === item.view ? 'page' : undefined"
				:data-testid="`outline-${item.view}`"
			>
				<span
					:class="item.icon"
					class="size-4 shrink-0 text-ink-gray-6"
					aria-hidden="true"
				/>
				<span class="min-w-0 flex-1">{{ item.title }}</span>
			</router-link>
		</div>

		<section v-for="(group, i) in groups" :key="group.lesson?.id ?? 'rest'">
			<button
				type="button"
				class="flex w-full items-center gap-1.5 px-2 py-1 text-start text-p-xs font-medium text-ink-gray-5 hover:text-ink-gray-8"
				:aria-expanded="isOpen(group, i)"
				@click="toggle(group, i)"
			>
				<span
					:class="
						isOpen(group, i) ? 'lucide-chevron-down' : 'lucide-chevron-right'
					"
					class="size-3.5 shrink-0"
					aria-hidden="true"
				/>
				<span class="min-w-0 flex-1 truncate">
					{{
						group.lesson
							? __('Lesson {0} · {1}').format(
									String(group.lesson.number),
									group.lesson.title
							  )
							: __('Other documents')
					}}
				</span>
				<span
					v-if="group.lesson && group.lesson.id === currentLesson"
					class="shrink-0 rounded bg-surface-gray-3 px-1.5 text-p-xs text-ink-gray-8"
					>{{ __('now') }}</span
				>
				<span
					v-else-if="!isOpen(group, i) && groupDone(group)"
					class="lucide-circle-check size-3.5 shrink-0 text-ink-green-6"
					:aria-label="__('Done')"
				/>
			</button>
			<div v-if="isOpen(group, i)" class="mt-0.5 space-y-0.5">
				<router-link
					v-for="block in group.blocks"
					:key="block.key"
					:to="to(block.key)"
					class="outline-link ps-7"
					:class="{ 'is-active': active === block.key }"
					:aria-current="active === block.key ? 'page' : undefined"
					:data-testid="`outline-${block.key}`"
				>
					<span class="min-w-0 flex-1">{{ block.title }}</span>
					<span class="shrink-0 text-p-xs" :class="stateClass(block)">{{
						stateWord(block)
					}}</span>
				</router-link>
			</div>
		</section>
	</nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	blockState,
	type BlockState,
	type DocBlock,
	type DocumentData,
	type OutlineGroup,
} from '@/utils/documentTable'

// The document's contents: the register and the report on top, then each
// lesson's documents under it (learning-services#342).

const props = defineProps<{
	document: DocumentData
	groups: OutlineGroup[]
	specials: { view: string; title: string; icon: string }[]
	active: string
	currentLesson?: string | null
}>()

const to = (view: string) => ({
	name: 'Document',
	params: {
		courseName: props.document.course,
		artifact: props.document.artifact,
		view,
	},
})

// Open: the lesson the student is on and the one holding the open document;
// the rest fold into a line. A click overrides either way.
const toggled = ref<Record<string, boolean>>({})
const groupKey = (group: OutlineGroup, i: number) =>
	group.lesson?.id ?? `rest-${i}`
const isOpen = (group: OutlineGroup, i: number): boolean => {
	const key = groupKey(group, i)
	if (key in toggled.value) return toggled.value[key]
	return (
		group.lesson?.id === props.currentLesson ||
		group.blocks.some((b) => b.key === props.active) ||
		!group.lesson
	)
}
function toggle(group: OutlineGroup, i: number) {
	toggled.value = { ...toggled.value, [groupKey(group, i)]: !isOpen(group, i) }
}

const state = (block: DocBlock): BlockState => blockState(block, props.document)
const groupDone = (group: OutlineGroup) =>
	group.blocks.every((b) => state(b) === 'done')

const WORDS: Record<BlockState, () => string> = {
	done: () => __('done'),
	progress: () => __('started'),
	preset: () => __('template'),
	empty: () => __('empty'),
}
const stateWord = (block: DocBlock) => WORDS[state(block)]()
const stateClass = (block: DocBlock) =>
	({
		done: 'text-ink-green-6',
		progress: 'text-ink-amber-7',
		preset: 'text-ink-blue-6',
		empty: 'text-ink-gray-4',
	}[state(block)])
</script>

<style scoped>
.outline-link {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.3rem 0.5rem;
	border-radius: 0.375rem;
	font-size: 0.8125rem;
	color: var(--ink-gray-7);
}

.outline-link:hover {
	background-color: var(--surface-gray-2);
}

.outline-link.is-active {
	background-color: var(--surface-gray-3);
	color: var(--ink-gray-9);
	font-weight: 500;
}
</style>
