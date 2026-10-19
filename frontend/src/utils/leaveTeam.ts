// Leaving a team is anyone's own choice (learning-services#585): consent to what
// the team sees is given on joining and withdrawn by leaving. The switcher and
// the phone's «You» page offer it to every member, not only to those who manage
// the team; the server still refuses the last administrator.
import { call, toast } from 'frappe-ui'
import { confirmAction } from '@/utils/confirm'

type Answer = { ok: boolean; error?: { code: string; message: string } }

export const leaveTeam = (organization: string, user: string) =>
	confirmAction({
		title: __('Leave the team?'),
		message: __(
			'You will lose access to the team and its documents. The team will no longer see your work, and we will email you a copy of your documents in this team, if you have any.'
		),
		label: __('Leave'),
		onConfirm: async () => {
			const result = (await call('lms_frappe_app.api.team.remove_member', {
				organization,
				user,
			})) as Answer
			if (!result?.ok) {
				toast.error(result?.error?.message ?? __('Could not save'))
				return
			}
			// Who left has no team space to stay in.
			window.location.href = '/lms'
		},
	})
