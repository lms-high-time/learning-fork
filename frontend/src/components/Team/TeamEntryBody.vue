<template>
	<div
		v-if="entry.content.trim()"
		class="prose prose-sm max-w-none"
		v-safe-html:rich="render(entry.content)"
	/>
	<div
		v-if="entry.table_markdown"
		class="prose prose-sm max-w-none overflow-x-auto"
		v-safe-html:rich="render(entry.table_markdown)"
	/>
	<a
		v-if="entry.file"
		:href="safeUrl(entry.file.url)"
		class="block text-p-sm underline"
		v-external
		>{{ entry.file.name }}</a
	>
	<a
		v-if="entry.url"
		:href="safeUrl(entry.url)"
		class="block text-p-sm underline"
		v-external
		>{{ entry.url }}</a
	>
</template>

<script setup lang="ts">
// One member's entry in a block: text, table, file or link.
import MarkdownIt from 'markdown-it'
import { safeUrl } from '@/utils/safeUrl'
import type { TeamEntry } from '@/utils/team'

defineProps<{ entry: TeamEntry }>()

const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)
</script>
