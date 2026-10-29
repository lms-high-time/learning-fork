/**
 * The page's language: `<html lang>`, which the server renders from the same
 * resolution the translations come from — the user's language, else the
 * language the site chose for the request (its `preferred_language` cookie),
 * else the system's (learning-services#765). Dates, sorting and plurals follow
 * it, so an English page does not show «28 сент.».
 */
export const pageLang = (): string => {
	const lang =
		(typeof document !== 'undefined' && document.documentElement.lang) ||
		(typeof window !== 'undefined' &&
			(window as Window & { lang?: string }).lang) ||
		''
	// A page without boot data carries no tag, or the template's own text;
	// Intl would throw on it at every date. Checked once here, so the callers
	// need no try/catch.
	try {
		return Intl.getCanonicalLocales(lang)[0] || 'en'
	} catch {
		return 'en'
	}
}
