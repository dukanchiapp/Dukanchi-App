/**
 * Session 128.40 — SEO HTML + LD-JSON builders.
 *
 * Single source of truth shared by:
 *  - the new bot-render middleware (serves a static HTML doc to crawlers /
 *    link-unfurlers), and
 *  - StoreProfile.tsx (passes the LD-JSON payload to PageMeta / Helmet).
 *
 * Keeping both consumers on ONE builder means the bot HTML and the
 * client-rendered HTML can never drift apart for the LD-JSON payload.
 */

const DEFAULT_OG_IMAGE = 'https://dukanchi.com/icons/icon-512x512.png';

/**
 * WhatsApp + several other unfurlers reject image/webp in link previews
 * (despite supporting it elsewhere). Strip a webp URL and fall back to the
 * brand icon — the brand icon is a 512×512 PNG that satisfies the 300×200+
 * floor every documented unfurler uses.
 */
function unfurlSafeImage(image: string | undefined | null): string {
  if (!image) return DEFAULT_OG_IMAGE;
  if (image.toLowerCase().endsWith('.webp')) return DEFAULT_OG_IMAGE;
  return image;
}

// ── Types — narrow shape, intentionally LOOSE on the consumer side so this
// file doesn't pin a specific Prisma version (the Store row shape is set by
// the consumer; we read only the fields documented below).
export interface SeoStore {
  id: string;
  storeName: string;
  description?: string | null;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  /** Stored as Int in Prisma; we accept either shape since the LD-JSON output is stringified anyway. */
  postalCode?: string | number | null;
  phone?: string | null;
  /** Privacy gate — when explicitly false, omit phone from public meta + LD-JSON. */
  phoneVisible?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  /** The R2 image we use for og:image + LD-JSON image. Caller picks coverUrl ?? logoUrl. */
  image?: string | null;
}

export interface BaseHtmlInput {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  /** og:type — defaults to 'website' on landing pages; 'profile' for /store/:id; 'article' for /legal/*. */
  type?: 'website' | 'article' | 'profile';
  /** Optional JSON-LD payload(s). When provided, emitted as application/ld+json script tags. */
  ldJson?: Array<Record<string, unknown>>;
  /** Optional plain-text body content for the noscript fallback — keeps bot HTML lean but readable. */
  bodyText?: string;
}

/** Escape user-supplied strings for safe HTML attribute/text interpolation. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build the complete bot-facing HTML document. NO React, NO Vite bundle,
 * NO inline scripts. Just <head> meta + LD-JSON + a noscript <body> link to
 * the canonical URL.
 *
 * Crawlers that DO execute JS (Googlebot's Web Rendering Service) will see
 * this document, run zero JS (we ship no scripts), and be done. That's
 * fine — the meta + LD-JSON is what they index regardless.
 */
export function buildBaseHtml(input: BaseHtmlInput): string {
  const safeImage = unfurlSafeImage(input.image);
  const title = escapeHtml(input.title);
  const description = escapeHtml(input.description);
  const canonical = escapeHtml(input.canonical);
  const image = escapeHtml(safeImage);
  const type = escapeHtml(input.type ?? 'website');
  const bodyText = input.bodyText ? escapeHtml(input.bodyText) : title;

  const ldJsonBlocks = (input.ldJson ?? [])
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
${ldJsonBlocks}
</head>
<body>
<h1>${bodyText}</h1>
<p>${description}</p>
<p><a href="${canonical}">View on Dukanchi</a></p>
</body>
</html>`;
}

/**
 * Schema.org LocalBusiness payload for a single store. Mirrors the inline
 * builder that previously lived in StoreProfile.tsx (Session 128.39); now
 * the single source of truth for both the bot HTML and the client-rendered
 * Helmet block.
 *
 * PII discipline:
 *  - owner.name / owner.id / ownerId NEVER emitted.
 *  - `telephone` ONLY when `phoneVisible !== false` — the retailer's explicit
 *    privacy choice. Defaults to true per prisma/schema.prisma:113.
 *  - `aggregateRating` only when reviewCount >= 5 (Google's SERP-star threshold;
 *    anything below is misleading thumbnail noise).
 *  - Address fields OMITTED (not blank) when null.
 */
export function buildStoreLdJson(store: SeoStore): Record<string, unknown> {
  const image = unfurlSafeImage(store.image);
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.storeName,
    url: `https://dukanchi.com/store/${store.id}`,
    image,
  };

  if (store.description) ld.description = store.description;

  const address: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: 'IN' };
  if (store.address) address.streetAddress = store.address;
  if (store.city) address.addressLocality = store.city;
  if (store.state) address.addressRegion = store.state;
  if (store.postalCode != null && store.postalCode !== '') address.postalCode = String(store.postalCode);
  ld.address = address;

  if (store.phone && store.phoneVisible !== false) ld.telephone = store.phone;

  if (typeof store.latitude === 'number' && typeof store.longitude === 'number') {
    ld.geo = {
      '@type': 'GeoCoordinates',
      latitude: store.latitude,
      longitude: store.longitude,
    };
  }

  if (typeof store.reviewCount === 'number' && store.reviewCount >= 5 && typeof store.averageRating === 'number') {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: store.averageRating.toFixed(1),
      reviewCount: store.reviewCount,
    };
  }

  return ld;
}

/**
 * Organization + WebSite payload for landing / generic public pages. Mirrors
 * what index.html ships today (Session 128.11 baseline) — kept here so the
 * bot-render middleware emits the same JSON-LD for non-store routes.
 */
export function buildLandingLdJson(): Array<Record<string, unknown>> {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Dukanchi',
      url: 'https://dukanchi.com/',
      logo: 'https://dukanchi.com/icons/icon-512x512.png',
      description: 'Hyperlocal B2B2C retail discovery platform for India.',
      sameAs: ['https://dukanchi.com/'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Dukanchi',
      url: 'https://dukanchi.com/',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://dukanchi.com/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

// ── Per-route builders — bot-render middleware calls these in Phase 3.

interface MetaInput {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  ldJson?: Array<Record<string, unknown>>;
}

/** Convenience: pre-baked landing meta (same shape used for / and /landing). */
export function landingMeta(): MetaInput {
  return {
    title: 'Dukanchi — Local Market Discovery in India',
    description: 'Discover stores in your neighbourhood, chat directly with shop owners, and find products near you. Apki local market ab aapke phone par.',
    canonical: 'https://dukanchi.com/',
    type: 'website',
    ldJson: buildLandingLdJson(),
  };
}

export function searchMeta(): MetaInput {
  return {
    title: 'Search Local Stores | Dukanchi',
    description: 'Find shops, products, and services near you. Smart search across local retailers in your area.',
    canonical: 'https://dukanchi.com/search',
    type: 'website',
  };
}

export function mapMeta(): MetaInput {
  return {
    title: 'Stores Near You — Map View | Dukanchi',
    description: 'Explore local stores around you on the map. Live open/closed status, distance, and directions to neighbourhood shops.',
    canonical: 'https://dukanchi.com/map',
    type: 'website',
  };
}

const LEGAL_TITLES: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  'account-deletion': 'Account Deletion',
  grievance: 'Grievance Officer',
  cookies: 'Cookie Policy',
};

export function legalMeta(slug: string): MetaInput | null {
  if (!Object.prototype.hasOwnProperty.call(LEGAL_TITLES, slug)) return null;
  const titleEn = LEGAL_TITLES[slug];
  return {
    title: `${titleEn} — Dukanchi`,
    description: `${titleEn} for Dukanchi — local market discovery app for India. Read the latest version of this document in English or हिन्दी.`,
    canonical: `https://dukanchi.com/legal/${slug}`,
    type: 'article',
  };
}

export function storeMeta(store: SeoStore): MetaInput {
  const title = `${store.storeName}${store.category ? ` — ${store.category}` : ''}${store.address ? ` in ${store.address}` : ''} | Dukanchi`;
  const description = store.description
    ? store.description.slice(0, 200)
    : `${store.category || 'Local'} store${store.address ? ` in ${store.address}` : ''}. Connect on Dukanchi.`;
  return {
    title,
    description,
    canonical: `https://dukanchi.com/store/${store.id}`,
    image: unfurlSafeImage(store.image),
    type: 'profile',
    ldJson: [buildStoreLdJson(store)],
  };
}

/**
 * Fallback meta when the requested store ID doesn't exist. We still serve a
 * 200-bodied HTML to crawlers (with a 404 status code) so they get a real
 * meta block instead of an upstream error page. The shape matches landing —
 * crawlers retrying later will pick up the canonical landing meta.
 */
export function storeNotFoundMeta(storeId: string): MetaInput {
  return {
    title: 'Store not found | Dukanchi',
    description: 'This store profile is no longer available. Discover other local stores on Dukanchi.',
    canonical: `https://dukanchi.com/store/${storeId}`,
    type: 'website',
  };
}
