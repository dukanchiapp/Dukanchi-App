/**
 * MarkdownRenderer — react-markdown + remark-gfm, styled with the
 * futuristic v2 (--f-*) design tokens. Lazy-loaded only on /legal/* routes.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode, CSSProperties } from 'react';

/** Recursively extract plain text from a React node tree. */
function nodeText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  const props = (node as { props?: { children?: ReactNode } } | null)?.props;
  return props ? nodeText(props.children) : '';
}

/** Stable slug for an H2 — keeps ASCII word chars + Devanagari (Hindi). */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^\wऀ-ॿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

const linkStyle: CSSProperties = {
  color: 'var(--f-orange-light)',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="f-display" style={{ fontSize: 27, color: 'var(--f-text-1)', lineHeight: 1.15, margin: '0 0 6px' }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2
            id={slugifyHeading(nodeText(children))}
            style={{ fontSize: 19, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.01em', margin: '30px 0 10px', scrollMarginTop: 88 }}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--f-text-1)', margin: '20px 0 6px' }}>{children}</h3>
        ),
        p: ({ children }) => (
          <p style={{ color: 'var(--f-text-2)', lineHeight: 1.7, margin: '0 0 14px' }}>{children}</p>
        ),
        a: ({ href, children }) => {
          const external = !!href && /^https?:/i.test(href);
          return (
            <a href={href} style={linkStyle} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
              {children}
            </a>
          );
        },
        ul: ({ children }) => (
          <ul style={{ margin: '0 0 14px', paddingLeft: 22, color: 'var(--f-text-2)', lineHeight: 1.7 }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: '0 0 14px', paddingLeft: 22, color: 'var(--f-text-2)', lineHeight: 1.7 }}>{children}</ol>
        ),
        li: ({ children }) => <li style={{ margin: '0 0 5px' }}>{children}</li>,
        strong: ({ children }) => <strong style={{ color: 'var(--f-text-1)', fontWeight: 700 }}>{children}</strong>,
        em: ({ children }) => <em style={{ color: 'var(--f-text-3)' }}>{children}</em>,
        hr: () => <hr style={{ border: 'none', borderTop: '1px solid var(--f-glass-border)', margin: '24px 0' }} />,
        blockquote: ({ children }) => (
          <blockquote style={{ margin: '0 0 14px', padding: '8px 14px', borderLeft: '3px solid var(--f-orange)', background: 'var(--f-glass-bg)', borderRadius: 8, color: 'var(--f-text-2)' }}>
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="f-mono" style={{ fontSize: '0.86em', background: 'var(--f-glass-bg-2)', padding: '1px 6px', borderRadius: 6, color: 'var(--f-text-1)' }}>
            {children}
          </code>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '0 0 14px' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13.5 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ border: '1px solid var(--f-glass-border)', padding: '8px 10px', textAlign: 'left', color: 'var(--f-text-1)', background: 'var(--f-glass-bg)', fontWeight: 700 }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: '1px solid var(--f-glass-border)', padding: '8px 10px', color: 'var(--f-text-2)' }}>{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
