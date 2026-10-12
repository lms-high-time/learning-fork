<template>
	<div
		v-if="entry.markdown?.trim()"
		class="prose prose-sm max-w-none overflow-x-auto"
		v-safe-html:rich="render(entry.markdown)"
	/>
</template>

<script setup lang="ts">
// One member's entry in a block: its rows or fields as markdown
// (learning-services#515).
import MarkdownIt from 'markdown-it'
import type { TeamEntry } from '@/utils/team'

defineProps<{ entry: TeamEntry }>()

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)
</script>
