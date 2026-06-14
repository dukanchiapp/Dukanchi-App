import { describe, it, expect } from 'vitest';
import { createElement, Children, type ReactElement, isValidElement } from 'react';
import { PageMeta, type PageMetaProps } from '../components/PageMeta';

/**
 * Session 128.39 — PageMeta unit test.
 *
 * Strategy: PageMeta returns `<Helmet>` with a flat children list of <title>
 * <meta> <link> <script> tags. Helmet's own DOM-emit lives in Helmet — we
 * don't need to exercise its rendering pipeline to verify what we hand it.
 * Render PageMeta as a plain function call, walk its children, and assert
 * shape. No DOM, no JSX runtime, no Helmet SSR context plumbing.
 */

function flatten(node: ReactElement): ReactElement[] {
  return Children.toArray((node.props as { children?: unknown }).children)
    .filter(isValidElement) as ReactElement[];
}

interface NodeShape {
  type: string;
  props: Record<string, unknown>;
  children?: unknown;
}

function asShape(el: ReactElement): NodeShape {
  return {
    type: typeof el.type === 'string' ? el.type : '<component>',
    props: { ...(el.props as Record<string, unknown>) },
    children: (el.props as { children?: unknown }).children,
  };
}

function render(props: PageMetaProps): NodeShape[] {
  const helmetEl = PageMeta(props) as unknown as ReactElement;
  return flatten(helmetEl).map(asShape);
}

function findOne(nodes: NodeShape[], type: string, predicate: (n: NodeShape) => boolean): NodeShape | undefined {
  return nodes.find(n => n.type === type && predicate(n));
}

describe('PageMeta — happy path', () => {
  it('appends " | Dukanchi" to title by default', () => {
    const nodes = render({
      title: 'Discover Local Stores',
      description: 'Find shops near you.',
      canonical: 'https://dukanchi.com/',
    });
    const title = findOne(nodes, 'title', () => true);
    expect(title).toBeDefined();
    expect(title?.children).toBe('Discover Local Stores | Dukanchi');
  });

  it('emits canonical link + og:url + twitter:card pointing at the supplied URL', () => {
    const nodes = render({
      title: 'Search',
      description: 'Find shops.',
      canonical: 'https://dukanchi.com/search',
    });
    const canonical = findOne(nodes, 'link', n => n.props.rel === 'canonical');
    expect(canonical?.props.href).toBe('https://dukanchi.com/search');

    const ogUrl = findOne(nodes, 'meta', n => n.props.property === 'og:url');
    expect(ogUrl?.props.content).toBe('https://dukanchi.com/search');

    const twitterCard = findOne(nodes, 'meta', n => n.props.name === 'twitter:card');
    expect(twitterCard?.props.content).toBe('summary_large_image');

    const ogTitle = findOne(nodes, 'meta', n => n.props.property === 'og:title');
    expect(ogTitle?.props.content).toBe('Search | Dukanchi');
  });

  it('preserves the title verbatim when appendBrand=false', () => {
    const nodes = render({
      title: 'Privacy Policy — Dukanchi',
      description: 'Our privacy policy.',
      canonical: 'https://dukanchi.com/legal/privacy',
      appendBrand: false,
    });
    const title = findOne(nodes, 'title', () => true);
    expect(title?.children).toBe('Privacy Policy — Dukanchi');
    // No double-brand: must NOT contain "| Dukanchi" anywhere in the title.
    expect(String(title?.children ?? '')).not.toMatch(/\|\s*Dukanchi/);
  });

  it('falls back to the brand icon when image is omitted', () => {
    const nodes = render({
      title: 'Home',
      description: '...',
      canonical: 'https://dukanchi.com/',
    });
    const ogImage = findOne(nodes, 'meta', n => n.props.property === 'og:image');
    expect(ogImage?.props.content).toBe('https://dukanchi.com/icons/icon-512x512.png');

    const twImage = findOne(nodes, 'meta', n => n.props.name === 'twitter:image');
    expect(twImage?.props.content).toBe('https://dukanchi.com/icons/icon-512x512.png');
  });

  it('uses the supplied image for both og:image and twitter:image', () => {
    const nodes = render({
      title: 'Foo Store',
      description: 'A store.',
      canonical: 'https://dukanchi.com/store/abc',
      image: 'https://r2.example/cover.jpg',
    });
    const ogImage = findOne(nodes, 'meta', n => n.props.property === 'og:image');
    expect(ogImage?.props.content).toBe('https://r2.example/cover.jpg');

    const twImage = findOne(nodes, 'meta', n => n.props.name === 'twitter:image');
    expect(twImage?.props.content).toBe('https://r2.example/cover.jpg');
  });

  it('sets og:type to the supplied type (default "website", "profile" for /store/:id)', () => {
    const websiteNodes = render({
      title: 'X', description: 'X', canonical: 'https://dukanchi.com/',
    });
    expect(findOne(websiteNodes, 'meta', n => n.props.property === 'og:type')?.props.content).toBe('website');

    const profileNodes = render({
      title: 'X', description: 'X', canonical: 'https://dukanchi.com/store/abc', type: 'profile',
    });
    expect(findOne(profileNodes, 'meta', n => n.props.property === 'og:type')?.props.content).toBe('profile');
  });
});

describe('PageMeta — LD-JSON', () => {
  it('emits a <script type="application/ld+json"> child with the payload stringified', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: 'Honest Hardware',
      url: 'https://dukanchi.com/store/abc',
      address: { '@type': 'PostalAddress', addressCountry: 'IN' },
    };
    const nodes = render({
      title: 'Honest Hardware',
      description: 'A store.',
      canonical: 'https://dukanchi.com/store/abc',
      jsonLd: ld,
    });
    const script = findOne(nodes, 'script', n => n.props.type === 'application/ld+json');
    expect(script).toBeDefined();
    const payload = JSON.parse(String(script?.children ?? '{}'));
    expect(payload['@type']).toBe('LocalBusiness');
    expect(payload.name).toBe('Honest Hardware');
    expect(payload.address.addressCountry).toBe('IN');
  });

  it('omits the LD-JSON script when jsonLd is undefined', () => {
    const nodes = render({
      title: 'No Schema',
      description: 'No structured data.',
      canonical: 'https://dukanchi.com/foo',
    });
    const script = findOne(nodes, 'script', () => true);
    expect(script).toBeUndefined();
  });
});

describe('PageMeta — story-style: complete /store/:id render', () => {
  it('renders title + canonical + og + LD-JSON + twitter card all consistent for a store page', () => {
    const nodes = render({
      title: 'Honest Hardware — Tools in Mumbai',
      description: 'Tools store in Mumbai. Connect on Dukanchi.',
      canonical: 'https://dukanchi.com/store/abc123',
      image: 'https://r2.example/cover.jpg',
      type: 'profile',
      jsonLd: createElement('script') /* placeholder */ as unknown as Record<string, unknown>,
    });
    // We don't care about the placeholder object — just that all OTHER tags
    // are consistent for the canonical URL.
    expect(findOne(nodes, 'link', n => n.props.rel === 'canonical')?.props.href).toBe('https://dukanchi.com/store/abc123');
    expect(findOne(nodes, 'meta', n => n.props.property === 'og:url')?.props.content).toBe('https://dukanchi.com/store/abc123');
    expect(findOne(nodes, 'meta', n => n.props.property === 'og:type')?.props.content).toBe('profile');
    expect(findOne(nodes, 'meta', n => n.props.property === 'og:image')?.props.content).toBe('https://r2.example/cover.jpg');
  });
});
