/**
 * LegalLayout — shared shell for the /legal/* pages.
 * Loads a markdown doc by (slug, lang), renders a TOC + reading column,
 * handles loading / error states, and keeps document.title + <html lang>
 * in sync. Lazy-loaded only on /legal/* routes.
 */
import { Component, useState, useEffect, useMemo } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadDoc, type LegalSlug } from '../../lib/legal/loadDoc';
import { MarkdownRenderer, slugifyHeading } from './MarkdownRenderer';
import { LanguageToggle } from './LanguageToggle';
import { FIcon } from '../futuristic';
import { PageMeta } from '../PageMeta';

interface LegalLayoutProps {
  slug: LegalSlug;
  titleEn: string;
  titleHi: string;
}

interface TocItem { id: string; text: string; }

/**
 * UI chrome strings, translated per language. The legal document body comes
 * from the markdown files; this object only covers the layout's own labels —
 * so a Hindi page has Hindi chrome too. No i18n library: a plain lookup.
 * The "Legal" eyebrow stays English globally (a brand-style label).
 */
const chromeStrings = {
  en: {
    skipToContent: 'Skip to content',
    goBack: 'Go back',
    onThisPage: 'On this page',
    errorTitle: "We couldn't load this page.",
    errorBody: 'Please check your connection and try again.',
    retry: 'Retry',
    lastUpdated: 'Last Updated: 18 May 2026 • Baseline (pending legal review)',
  },
  hi: {
    skipToContent: 'सामग्री पर जाएँ',
    goBack: 'वापस जाएँ',
    onThisPage: 'इस पृष्ठ पर',
    errorTitle: 'हम यह पृष्ठ लोड नहीं कर सके।',
    errorBody: 'कृपया अपना कनेक्शन जाँचें और पुनः प्रयास करें।',
    retry: 'पुनः प्रयास करें',
    lastUpdated: 'अंतिम अद्यतन: 18 मई 2026 • आधार (कानूनी समीक्षा लंबित)',
  },
} as const;

const shimmer: CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '200% 100%',
  animation: 'f-shimmer 1.5s linear infinite',
  borderRadius: 8,
};

/** Pull H2 headings out of the raw markdown for the table of contents. */
function extractToc(md: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /^##[ \t]+(.+?)[ \t]*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const text = m[1].trim();
    if (text) items.push({ id: slugifyHeading(text), text });
  }
  return items;
}

/** Localised error boundary — a render failure in the markdown tree shows a
 *  retry panel instead of bubbling to the global (full-page) ErrorBoundary. */
class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.error('[LegalLayout] markdown render failed:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map(item => (
        <li key={item.id}>
          <a href={`#${item.id}`} style={{ fontSize: 12.5, color: 'var(--f-text-3)', textDecoration: 'none', lineHeight: 1.45, display: 'block' }}>
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function LegalLayout({ slug, titleEn, titleHi }: LegalLayoutProps) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lang: 'en' | 'hi' = params.get('lang') === 'hi' ? 'hi' : 'en';
  const title = lang === 'hi' ? titleHi : titleEn;
  const t = chromeStrings[lang];

  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  // Load the doc whenever slug / lang / retry changes.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    loadDoc(slug, lang)
      .then(md => { if (!cancelled) { setContent(md); setStatus('loaded'); } })
      .catch(err => {
        console.error('[LegalLayout] loadDoc failed:', err);
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [slug, lang, reloadKey]);

  // Session 128.39 — title + canonical + og:url moved to declarative <PageMeta>
  // below (rendered inline at the start of the JSX). Helmet manages the DOM
  // mutations + restores on unmount automatically. We still keep ONE effect
  // for html lang because Helmet doesn't manage <html lang>. The em-dash
  // suffix is preserved exactly via `appendBrand={false}` on PageMeta.
  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    root.lang = lang;
    return () => { root.lang = prevLang; };
  }, [lang]);

  const toc = useMemo(() => (status === 'loaded' ? extractToc(content) : []), [content, status]);
  const retry = () => setReloadKey(k => k + 1);

  const errorPanel = (
    <div role="alert" className="f-glass" style={{ padding: 24, borderRadius: 16, textAlign: 'center', background: 'var(--f-glass-bg)' }}>
      <p style={{ fontSize: 14, color: 'var(--f-text-1)', fontWeight: 600, margin: '0 0 4px' }}>
        {t.errorTitle}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--f-text-3)', margin: '0 0 16px' }}>
        {t.errorBody}
      </p>
      <button
        onClick={retry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9999,
          border: 'none', cursor: 'pointer', fontFamily: 'var(--f-font)', fontSize: 13, fontWeight: 700,
          background: 'var(--b-grad)', color: 'white', boxShadow: 'var(--b-elev-card)',
        }}
      >
        {t.retry}
      </button>
    </div>
  );

  return (
    <>
    <PageMeta
      title={`${title} — Dukanchi`}
      description={`${titleEn} for Dukanchi — local market discovery app for India. Read the latest version of this document in English or हिन्दी.`}
      canonical={`https://dukanchi.com/legal/${slug}`}
      type="article"
      appendBrand={false}
    />
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 88, fontFamily: 'var(--f-font)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />

      {/* Skip link — visible only on keyboard focus */}
      <a
        href="#legal-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: 'absolute', top: 8, left: 8, zIndex: 60, padding: '8px 14px', borderRadius: 10,
          background: 'var(--b-grad)', color: 'white', fontSize: 12, fontWeight: 700, textDecoration: 'none',
        }}
      >
        {t.skipToContent}
      </a>

      {/* Header */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--f-sticky-bg)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--f-glass-border)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label={t.goBack}
          className="f-glass"
          style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          <FIcon name="chevL" size={20} color="var(--f-text-1)" />
        </button>
        <span className="f-eyebrow">Legal</span>
        <LanguageToggle />
      </header>

      {/* Body */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '20px 16px 0' }}>
        {/* Mobile TOC — accordion */}
        {toc.length > 0 && (
          <nav aria-label="Table of contents" className="md:hidden" style={{ marginBottom: 18 }}>
            <details className="f-glass" style={{ borderRadius: 14, background: 'var(--f-glass-bg)', padding: 4 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--f-text-1)' }}>
                {t.onThisPage}
              </summary>
              <div style={{ padding: '4px 12px 10px' }}>
                <TocList items={toc} />
              </div>
            </details>
          </nav>
        )}

        <div className="flex flex-col md:flex-row md:gap-8">
          {/* Desktop TOC — sticky sidebar */}
          {(toc.length > 0 || status === 'loading') && (
            <nav aria-label="Table of contents" className="hidden md:block" style={{ width: 200, flexShrink: 0 }}>
              <div style={{ position: 'sticky', top: 78 }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--f-text-3)', margin: '0 0 10px' }}>
                  {t.onThisPage}
                </p>
                {status === 'loading' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[70, 92, 58, 80].map((w, i) => <div key={i} style={{ ...shimmer, height: 11, width: `${w}%` }} />)}
                  </div>
                ) : (
                  <TocList items={toc} />
                )}
              </div>
            </nav>
          )}

          {/* Reading column */}
          <main id="legal-content" className="text-[16px] md:text-[17px]" style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
            {status === 'loading' && (
              <div aria-hidden="true">
                <div style={{ ...shimmer, height: 30, width: '58%', marginBottom: 22 }} />
                {[92, 100, 86, 96, 74, 90].map((w, i) => (
                  <div key={i} style={{ ...shimmer, height: 13, width: `${w}%`, marginBottom: 13 }} />
                ))}
              </div>
            )}

            {status === 'error' && errorPanel}

            {status === 'loaded' && (
              <>
                <MarkdownErrorBoundary fallback={errorPanel}>
                  <MarkdownRenderer content={content} />
                </MarkdownErrorBoundary>
                <p style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--f-glass-border)', fontSize: 11.5, color: 'var(--f-text-4)' }}>
                  {t.lastUpdated}
                </p>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
    </>
  );
}
