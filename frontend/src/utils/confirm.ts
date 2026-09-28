// A question before an action that cannot be taken back with the same click
// (learning-services#379): marking someone as left, unassigning, revoking.
import { createDialog } from '@/utils/dialogs'

export const confirmAction = (options: {
	title: string
	message: string
	label: string
	onConfirm: () => Promise<unknown> | unknown
}) =>
	createDialog({
		title: options.title,
		message: options.message,
		actions: [
			{
				label: options.label,
				theme: 'red',
				variant: 'solid',
				async onClick({ close }: { close: () => void }) {
					await options.onConfirm()
					close()
				},
			},
		],
	})
