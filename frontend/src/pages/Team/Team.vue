<template>
	<div>
		<PageHeader
			:breadcrumbs="[{ label: __('Team'), route: { name: 'Team' } }]"
		/>

		<div
			v-if="state === 'loading'"
			class="flex justify-center p-10"
			data-testid="team-loading"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>

		<p
			v-else-if="state === 'personal'"
			class="mx-auto max-w-3xl p-5 text-p-base text-ink-gray-6"
			data-testid="team-personal"
		>
			{{
				__(
					'A team belongs to an organization. Choose it in the space switcher.'
				)
			}}
		</p>

		<p
			v-else-if="state === 'closed'"
			class="mx-auto max-w-3xl p-5 text-p-base text-ink-gray-6"
			data-testid="team-closed"
		>
			{{ __('This organization shows its documents to managers only.') }}
		</p>

		<div v-else-if="team" class="mx-auto max-w-5xl space-y-5 p-4 sm:p-5">
			<h1 class="text-xl-semibold text-ink-gray-9">{{ team.title }}</h1>

			<nav class="flex gap-1 border-b" role="tablist">
				<button
					v-for="item in tabs"
					:key="item.value"
					type="button"
					role="tab"
					:aria-selected="tab === item.value"
					:data-testid="`team-tab-${item.value}`"
					class="-mb-px border-b-2 px-3 py-2 text-p-base"
					:class="
						tab === item.value
							? 'border-ink-gray-9 text-ink-gray-9'
							: 'border-transparent text-ink-gray-5 hover:text-ink-gray-8'
					"
					@click="tab = item.value"
				>
					{{ item.label }}
				</button>
			</nav>

			<!-- Members: the current ones, then who left and when. -->
			<ul v-if="tab === 'members'" class="divide-y" data-testid="team-members">
				<li
					v-for="member in team.members"
					:key="member.user"
					class="flex items-center justify-between gap-3 py-2"
				>
					<span
						class="text-p-base"
						:class="member.left ? 'text-ink-gray-5' : 'text-ink-gray-9'"
					>
						{{ member.full_name || member.user }}
					</span>
					<span class="text-p-sm text-ink-gray-5">
						{{
							member.left
								? __('Left {0}').format(member.left_on || '')
								: roleLabel(member.role)
						}}
					</span>
				</li>
			</ul>

			<!-- Documents: one block at a time, everyone's entry side by side. -->
			<div v-else-if="tab === 'documents'" class="space-y-5">
				<p v-if="!documentChoices.length" class="text-p-base text-ink-gray-6">
					{{ __('No course of this organization builds a document yet.') }}
				</p>
				<template v-else>
					<div class="flex flex-wrap gap-2">
						<FormControl
							v-model="picked"
							type="select"
							:options="documentChoices"
							:aria-label="__('Document')"
						/>
					</div>

					<div
						v-if="documents.loading && !compared"
						class="flex justify-center p-6"
					>
						<LoadingIndicator class="size-5 text-ink-gray-5" />
					</div>

					<template v-else-if="compared">
						<p
							v-if="!compared.authors.length"
							class="text-p-base text-ink-gray-6"
						>
							{{
								__('Nobody has started this document in the organization yet.')
							}}
						</p>
						<ul v-else class="flex flex-wrap gap-2" data-testid="team-authors">
							<li
								v-for="author in compared.authors"
								:key="author.user"
								class="rounded bg-surface-gray-2 px-2 py-1 text-p-sm text-ink-gray-7"
							>
								{{ author.full_name || author.user }} ·
								{{ author.blocks_filled }}/{{ author.blocks_total }}
								<span v-if="author.left" class="text-ink-gray-5">
									· {{ __('left') }}</span
								>
							</li>
						</ul>

						<section
							v-for="block in compared.blocks"
							:key="block.key"
							class="space-y-2"
							:data-testid="`team-block-${block.key}`"
						>
							<h2 class="text-lg-semibold text-ink-gray-9">
								{{ block.title }}
							</h2>
							<div class="grid gap-3 sm:grid-cols-2">
								<article
									v-for="entry in block.entries"
									:key="entry.user"
									class="rounded border p-3"
									:class="isEmpty(entry) ? 'border-dashed' : ''"
								>
									<div class="mb-1 text-p-sm-medium text-ink-gray-7">
										{{ entry.full_name || entry.user }}
										<span v-if="entry.left" class="text-ink-gray-5">
											· {{ __('left') }}</span
										>
									</div>
									<p v-if="isEmpty(entry)" class="text-p-sm text-ink-gray-5">
										{{ __('Not filled yet') }}
									</p>
									<template v-else>
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
								</article>
							</div>
						</section>
					</template>
				</template>
			</div>

			<!-- Report: the manager's only; the same rows the agent gets. -->
			<div
				v-else-if="tab === 'report'"
				class="overflow-x-auto"
				data-testid="team-report"
			>
				<table class="w-full text-p-sm">
					<thead class="text-ink-gray-5">
						<tr class="border-b text-start">
							<th class="py-2 text-start font-normal">{{ __('Member') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Course') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Status') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Progress') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Deadline') }}</th>
							<th class="py-2 text-start font-normal">{{ __('Document') }}</th>
							<th class="py-2 text-start font-normal">
								{{ __('Passed first try') }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in reportRows"
							:key="`${row.user}-${row.course}`"
							class="border-b"
						>
							<td class="py-2">{{ row.full_name || row.user }}</td>
							<td class="py-2">{{ courseTitle(row.course) }}</td>
							<td class="py-2">{{ statusLabel(row.status) }}</td>
							<td class="py-2">{{ percent(row.progress) }}</td>
							<td class="py-2" :class="row.overdue ? 'text-ink-red-4' : ''">
								{{ row.deadline || '—' }}
							</td>
							<td class="py-2">
								{{ row.document.blocks_filled }}/{{ row.document.blocks_total }}
							</td>
							<td class="py-2">
								{{ row.quiz.first_try }}/{{ row.quiz.passed }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// The organization's team (learning-services#358): who is in it, what they
// wrote in the organization's space, and — for a manager — how their study goes.
// Access is the server's (`team_not_available`); the page only says so plainly.
import { computed, onMounted, ref, watch } from 'vue'
import {
	createResource,
	FormControl,
	LoadingIndicator,
	usePageMeta,
} from 'frappe-ui'
import MarkdownIt from 'markdown-it'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import { useSpace } from '@/stores/space'
import { safeUrl } from '@/utils/safeUrl'
import {
	firstDocument,
	isEmpty,
	percent,
	roleLabel,
	statusLabel,
	type ReportRow,
	type TeamData,
	type TeamDocuments,
} from '@/utils/team'

type Answer<T> = {
	ok: boolean
	data?: T
	error?: { code: string; message: string }
}

const space = useSpace()
const markdown = new MarkdownIt({ html: false, linkify: true })
const render = (text: string) => markdown.render(text)

const teamResource = createResource({
	url: 'lms_frappe_app.api.team.team',
	auto: false,
})
const documents = createResource({
	url: 'lms_frappe_app.api.team.team_documents',
	auto: false,
})
const report = createResource({
	url: 'lms_frappe_app.api.manager.org_report',
	auto: false,
})

const loaded = ref(false)
onMounted(async () => {
	await space.load()
	if (space.isOrganization)
		await teamResource.reload({ organization: space.current }).catch(() => {})
	loaded.value = true
})

const teamAnswer = computed(() => teamResource.data as Answer<TeamData> | null)
const team = computed(() =>
	teamAnswer.value?.ok ? teamAnswer.value.data ?? null : null
)

const state = computed(() => {
	if (!loaded.value) return 'loading'
	if (!space.isOrganization) return 'personal'
	if (!team.value) return 'closed'
	return 'ready'
})

const tab = ref<'members' | 'documents' | 'report'>('documents')
const tabs = computed(() => [
	{ value: 'documents' as const, label: __('Documents') },
	{ value: 'members' as const, label: __('Members') },
	...(team.value?.can_see_report
		? [{ value: 'report' as const, label: __('Progress report') }]
		: []),
])

// One picker for course and document together: "Course — Document".
const documentChoices = computed(() =>
	(team.value?.courses ?? []).flatMap((course) =>
		course.documents.map((doc) => ({
			label: `${course.title ?? course.id} — ${doc.title}`,
			value: `${course.id}::${doc.artifact}`,
		}))
	)
)
const picked = ref('')
watch(team, (value) => {
	const first = value ? firstDocument(value.courses) : null
	if (first && !picked.value)
		picked.value = `${first.course}::${first.artifact}`
})
watch(picked, (value) => {
	if (!value || !team.value) return
	const [course, artifact] = value.split('::')
	documents.reload({ organization: team.value.organization, course, artifact })
})
const compared = computed(() => {
	const answer = documents.data as Answer<TeamDocuments> | null
	return answer?.ok ? answer.data ?? null : null
})

watch(tab, (value) => {
	if (value === 'report' && team.value && !report.data)
		report.reload({ organization: team.value.organization })
})
const reportRows = computed<ReportRow[]>(() => {
	const answer = report.data as Answer<{ rows: ReportRow[] }> | null
	return answer?.ok ? answer.data?.rows ?? [] : []
})
const courseTitle = (course: string) =>
	team.value?.courses.find((item) => item.id === course)?.title ?? course

usePageMeta(() => ({ title: team.value?.title || __('Team') }))
</script>
