import { Helmet } from 'react-helmet-async';

/**
 * Session 128.39 — declarative per-page meta tags via react-helmet-async.
 *
 * Why this exists:
 *  - index.html ships a baseline title + description + OG block (the
 *    "fallback" any non-PageMeta route inherits).
 *  - The pre-existing `usePageMeta` hook (src/hooks/usePageMeta.ts) does the
 *    same job imperatively for auth-only routes (Home/Search/Map/Messages
 *    etc.). It's fine for tab-title UX but only patches title+og:title; it
 *    doesn't manage canonical/twitter/og:url/og:type/og:image consistently.
 *  - This component is for PUBLIC routes where SEO + social-link previews
 *    matter (landing, search, map, /store/:id, /legal/*). It renders every
 *    tag we care about in one place, and react-helmet-async deduplicates
 *    against the index.html baseline.
 *
 * Default title format: `${title} | Dukanchi`. Pass `appendBrand={false}`
 * if the caller is supplying the full title verbatim (e.g. legal pages
 * which historically use `${title} — Dukanchi` and that wording must be
 * preserved — see CLAUDE.md note + Session 128.39 spec).
 *
 * `image` defaults to the brand icon so social link previews always
 * render *something* — pass a route-specific image (a store photo, a
 * marketing card) when one is available.
 */
export interface PageMetaProps {
  /** Page title — the `| Dukanchi` suffix is auto-appended unless appendBrand=false. */
  title: string;
  /** ≤ 160 chars — what Google + Twitter + WhatsApp show below the title. */
  description: string;
  /** Absolute URL — what `<link rel="canonical">` + og:url point to. Must be the dukanchi.com origin (no localhost / no env-dependent host). */
  canonical: string;
  /** Optional preview image — absolute URL. Defaults to the 512×512 brand icon. */
  image?: string;
  /** og:type. Defaults to "website"; use "profile" or "article" where appropriate. */
  type?: 'website' | 'article' | 'profile';
  /**
   * When true (default), renders `<title>{title} | Dukanchi</title>`.
   * When false, renders `<title>{title}</title>` verbatim — for callers
   * that already supply a fully-formed title (e.g. LegalLayout, which uses
   * a localised "Privacy Policy — Dukanchi" format).
   */
  appendBrand?: boolean;
  /** Optional extra <script type="application/ld+json"> payload. Stringified inline. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const DEFAULT_IMAGE = 'https://dukanchi.com/icons/icon-512x512.png';

export function PageMeta({
  title,
  description,
  canonical,
  image,
  type = 'website',
  appendBrand = true,
  jsonLd,
}: PageMetaProps) {
  const fullTitle = appendBrand ? `${title} | Dukanchi` : title;
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph — WhatsApp, Facebook, LinkedIn, Slack link previews */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter / X cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
