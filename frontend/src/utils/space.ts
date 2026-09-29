import { PERSONAL, type Space } from '@/stores/space'

// How a space and its readers are named to the learner. Kept apart from the
// store so the wording is tested without a server.

// GET parameters with the space only when there is one. frappe-ui writes GET
// parameters with String(), so an absent space would reach the server as the
// word «undefined» and be refused as a space the learner does not have — the
// page then lost its course (learning-services#382).
export const withSpace = <T extends Record<string, unknown>>(
	params: T,
	space?: string | null
): T & { space?: string } => (space ? { ...params, space } : params)

export const spaceLabel = (space: Pick<Space, 'id' | 'title'>): string =>
	space.id === PERSONAL ? __('Personal') : space.title || space.id

// Who, besides the author, reads a document of this space. The learner is told
// on the document itself — the transparency the owner asked for when managers
// were given the documents (learning-services#132).
export const documentReaders = (
	space: Pick<Space, 'id' | 'title' | 'documents_visible_to'>
): string => {
	if (space.documents_visible_to === 'members')
		return __('Visible to everyone in {0}').format(spaceLabel(space))
	if (space.documents_visible_to === 'managers')
		return __('Visible to the managers of {0}').format(spaceLabel(space))
	return __('Visible only to you')
}

// A course the learner has finished whose document in the organization's space
// is still not whole: progress is one per person, documents are per space, so a
// course passed on one's own before the company assigned it arrives here done —
// with the company's document empty (learning-services#361).
export const documentToFill = (
	course: {
		completion?: number
		documents: { blocks_total: number; blocks_filled: number }[]
	},
	isOrganization: boolean
): boolean =>
	isOrganization &&
	(course.completion ?? 0) >= 1 &&
	course.documents.some((doc) => doc.blocks_filled < doc.blocks_total)
