/**
 * A count with its noun in the right form — «1 студент», «3 студента»,
 * «8 студентов» — rather than «1 Студенты» (learning-services#325).
 *
 * The translation catalogue has no plural forms, so each form is its own
 * message: `one` and `other` are the English ones every language translates;
 * `few` and `many` are extra messages only languages that need them do. English
 * never selects them, so they never show untranslated.
 */

export type PluralForms = {
	one: string
	other: string
	few?: string
	many?: string
}

type Catalogue = Record<string, string> | undefined

const currentLang = (): string =>
	(typeof document !== 'undefined' && document.documentElement.lang) ||
	(typeof window !== 'undefined' &&
		(window as Window & { lang?: string }).lang) ||
	'en'

/** The message for `count` in `lang`; each form carries a `{0}` for the number. */
export function pluralMessage(
	count: number,
	forms: PluralForms,
	lang: string = currentLang(),
	catalogue: Catalogue = (
		globalThis as { translatedMessages?: Record<string, string> }
	).translatedMessages
): string {
	let category: string
	try {
		category = new Intl.PluralRules(lang).select(count)
	} catch {
		category = count === 1 ? 'one' : 'other'
	}
	const form = forms[category as keyof PluralForms]
	// A form the catalogue does not translate would show in English; `other`
	// is always translated, so it is the safer fallback.
	if (category === 'few' || category === 'many')
		return form && catalogue?.[form] ? form : forms.other
	return form ?? forms.other
}

/**
 * The translated count. `display` is what stands for the number when it is not
 * the number itself — `1,200` or `50+` — while `count` still picks the form.
 */
export function plural(
	count: number,
	forms: PluralForms,
	display: string = String(count)
): string {
	return __(pluralMessage(count, forms)).format(display)
}

// The counts on the course page and card. A form's text is its message id.
export const STUDENTS: PluralForms = {
	one: '{0} student',
	few: '{0} students [few]',
	many: '{0} students [many]',
	other: '{0} students',
}

export const LESSONS: PluralForms = {
	one: '{0} lesson',
	few: '{0} lessons [few]',
	many: '{0} lessons [many]',
	other: '{0} lessons',
}

export const SECTIONS: PluralForms = {
	one: '{0} section',
	few: '{0} sections [few]',
	many: '{0} sections [many]',
	other: '{0} sections',
}

// A program's size (learning-services#417).
export const COURSES: PluralForms = {
	one: '{0} course',
	few: '{0} courses [few]',
	many: '{0} courses [many]',
	other: '{0} courses',
}
