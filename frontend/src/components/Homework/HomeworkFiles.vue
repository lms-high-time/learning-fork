<template>
	<ul v-if="files.length" class="space-y-1">
		<li v-for="file in files" :key="file.id" class="text-p-sm">
			<a
				:href="safeUrl(file.url)"
				download
				class="font-medium text-ink-gray-8 underline underline-offset-2"
				>{{ file.name }}</a
			>
			<span v-if="file.size" class="ms-2 text-ink-gray-5">{{
				formatSize(file.size)
			}}</span>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { safeUrl } from '@/utils/safeUrl'
import { formatSize, type HomeworkFile } from '@/utils/homework'

// The files of a homework answer, each a download (learning-services#439).
defineProps<{ files: HomeworkFile[] }>()
</script>
