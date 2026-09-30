import {
	computed,
	inject,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
	type Ref,
} from 'vue'
import { call, createResource, toast } from 'frappe-ui'
import type { CellValue, DocumentData, DocRow } from '@/utils/documentTable'
import { useSpace } from '@/stores/space'
import { postForm, type ContractAnswer } from '@/utils/postForm'

/**
 * A course document: read with `artifact`, written with `update_artifact` —
 * the same method the student's agent writes with; the page has no path of
 * its own (learning-services#331).
 *
 * A write answers with the fill counts, not the document, so the document is
 * read again after it: the formulas (rank, «in work») and what each block
 * still lacks are the server's to compute. A cell changes on screen at once
 * and goes back if the server refuses.
 */

interface WriteAnswer {
	blocks_total: number
	blocks_filled: number
	created: string[]
	empty_cells: { row?: string; column?: string; field?: string }[]
}

interface LiveEvent {
	course: string
	artifact: string
}

export interface BlockWrite {
	content?: string
	clear?: boolean
	url?: string
	rows?: Record<string, CellValue>[]
	delete_rows?: string[]
	fields?: Record<string, CellValue>
}

export function useDocument(course: Ref<string>, artifact: Ref<string>) {
	const spaces = useSpace()
	const resource = createResource({
		url: 'lms_frappe_app.api.student.artifact',
		// The read is whitelisted for GET as well; it only reads.
		method: 'GET',
		makeParams: () => ({
			course: course.value,
			artifact: artifact.value,
			space: spaces.paramFor(course.value),
		}),
		auto: false,
	})

	// Read once the space is known: the document is the chosen space's, and a
	// read before that would show another space's and then swap
	// (learning-services#347). Again on every other document the route opens.
	watch(
		[course, artifact],
		() => {
			spaces.load().then(() => resource.fetch())
		},
		{ immediate: true }
	)

	const answer = computed(
		() =>
			resource.data as ContractAnswer<DocumentData & { space?: string }> | null
	)
	// The space the read answered for. Writes, uploads and the download name it
	// back, so the page never reads one space's document and writes another's.
	const space = computed(() =>
		answer.value?.ok ? answer.value.data?.space : undefined
	)
	const document = computed<DocumentData | null>(() =>
		answer.value?.ok ? answer.value.data ?? null : null
	)
	const refusal = computed(() =>
		answer.value && !answer.value.ok ? answer.value.error ?? null : null
	)
	const saving = ref(0)
	// When this page last wrote: the server's echo of its own write is not
	// news, the page has read the document back already.
	let lastOwnWrite = 0

	async function write(
		key: string,
		change: BlockWrite
	): Promise<WriteAnswer | null> {
		saving.value++
		try {
			const result = (await call('lms_frappe_app.api.student.update_artifact', {
				course: course.value,
				artifact: artifact.value,
				key,
				space: space.value,
				...change,
			})) as ContractAnswer<WriteAnswer>
			if (!result?.ok) {
				toast.error(result?.error?.message || __('Could not save'))
				await resource.reload()
				return null
			}
			await resource.reload()
			return result.data ?? null
		} catch (error) {
			toast.error(__('Could not save'))
			await resource.reload()
			return null
		} finally {
			saving.value--
			lastOwnWrite = Date.now()
		}
	}

	/** One cell: shown at once, written, read back with the formulas. */
	function setCell(
		block: string,
		table: string,
		row: DocRow,
		column: string,
		value: CellValue
	) {
		const rows = document.value?.tables[table]?.rows
		const local = rows?.find((r) => r.id === row.id)
		if (local) local[column] = value
		return write(block, {
			rows: [{ id: row.id, [column]: value === '' ? null : value }],
		})
	}

	function setField(block: string, key: string, value: CellValue) {
		if (document.value) document.value.fields[key] = value
		return write(block, { fields: { [key]: value === '' ? null : value } })
	}

	async function addRow(block: string, values: Record<string, CellValue> = {}) {
		const answer = await write(block, { rows: [values] })
		return answer?.created?.[0] ?? null
	}

	function deleteRow(block: string, id: string) {
		return write(block, { delete_rows: [id] })
	}

	/** A block-file upload goes as a form: the bytes as the browser sends them. */
	async function upload(key: string, file: File): Promise<boolean> {
		const form = new FormData()
		form.append('course', course.value)
		form.append('artifact', artifact.value)
		form.append('key', key)
		if (space.value) form.append('space', space.value)
		form.append('file', file)
		saving.value++
		try {
			const result = await postForm(
				'lms_frappe_app.api.student.upload_artifact_file',
				form
			)
			if (!result.ok) {
				toast.error(result.message || __('Could not upload the file'))
				return false
			}
			await resource.reload()
			return true
		} finally {
			saving.value--
			lastOwnWrite = Date.now()
		}
	}

	const downloadUrl = (format: 'md' | 'xlsx') =>
		`/api/method/lms_frappe_app.www.artifacts.download?course=${encodeURIComponent(
			course.value
		)}&artifact=${encodeURIComponent(artifact.value)}&format=${format}${
			space.value ? `&space=${encodeURIComponent(space.value)}` : ''
		}`

	// Live: the agent writes to the document from the chat or over MCP, and
	// the open page reads it again without a reload (learning-services#348).
	// Back on the tab — in case the socket was down meanwhile.
	const updatedAt = ref<Date | null>(null)
	const OWN_ECHO_MS = 4000
	const socket = inject<{
		on: (event: string, handler: (data: LiveEvent) => void) => void
		off: (event: string, handler: (data: LiveEvent) => void) => void
	} | null>('$socket', null)

	async function onUpdated(data: LiveEvent) {
		if (data?.course !== course.value || data?.artifact !== artifact.value)
			return
		if (saving.value > 0 || Date.now() - lastOwnWrite < OWN_ECHO_MS) return
		await resource.reload()
		updatedAt.value = new Date()
	}
	function onVisible() {
		if (window.document.visibilityState === 'visible' && saving.value === 0)
			resource.reload()
	}
	onMounted(() => {
		socket?.on('artifact_updated', onUpdated)
		window.document.addEventListener('visibilitychange', onVisible)
	})
	onBeforeUnmount(() => {
		socket?.off('artifact_updated', onUpdated)
		window.document.removeEventListener('visibilitychange', onVisible)
	})

	return {
		resource,
		space,
		document,
		updatedAt,
		refusal,
		saving: computed(() => saving.value > 0),
		write,
		setCell,
		setField,
		addRow,
		deleteRow,
		upload,
		downloadUrl,
	}
}

export type DocumentApi = ReturnType<typeof useDocument>
