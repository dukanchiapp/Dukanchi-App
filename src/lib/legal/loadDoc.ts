/**
 * loadDoc — lazy-loads a legal markdown document as a raw string.
 *
 * Vite's import.meta.glob bundles each .md file as its own async chunk
 * (query '?raw' → file contents as a string). Nothing here ships in the
 * main entry chunk — the docs load only when a /legal/* route is opened.
 */

export type LegalSlug = 'privacy' | 'terms' | 'account-deletion' | 'grievance' | 'cookies';
export type LegalLang = 'en' | 'hi';

const docs = import.meta.glob('../../content/legal/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/**
 * Load a legal doc. An invalid `lang` silently falls back to English; a
 * missing localized file also falls back to English. A genuinely missing
 * doc throws — the caller (LegalLayout) surfaces this as a visible error
 * state, never a silent blank page.
 */
export async function loadDoc(slug: LegalSlug, lang: LegalLang): Promise<string> {
  const safeLang: LegalLang = lang === 'hi' ? 'hi' : 'en';
  const loader =
    docs[`../../content/legal/${slug}.${safeLang}.md`] ??
    docs[`../../content/legal/${slug}.en.md`];

  if (!loader) {
    throw new Error(`Legal document not found: ${slug}`);
  }
  return loader();
}
