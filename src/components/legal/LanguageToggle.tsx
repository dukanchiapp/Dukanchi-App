/**
 * LanguageToggle — EN ⇄ HI pill, persisted via the ?lang= query param.
 * A search-param-only update keeps scroll position (React Router does not
 * scroll-restore on a non-pathname change). Native <button>s → keyboard
 * accessible (Tab + Enter/Space); aria-pressed reflects the active state.
 */
import { useSearchParams } from 'react-router-dom';

export function LanguageToggle() {
  const [params, setParams] = useSearchParams();
  const lang: 'en' | 'hi' = params.get('lang') === 'hi' ? 'hi' : 'en';

  const setLang = (next: 'en' | 'hi') => {
    if (next === lang) return;
    const p = new URLSearchParams(params);
    if (next === 'hi') p.set('lang', 'hi');
    else p.delete('lang');
    setParams(p, { replace: true });
  };

  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: 'inline-flex', padding: 3, gap: 2, borderRadius: 9999,
        background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
      }}
    >
      {([['en', 'EN'], ['hi', 'हिं']] as const).map(([code, label]) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            style={{
              padding: '5px 13px', borderRadius: 9999, border: 'none', cursor: 'pointer',
              fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--f-font)',
              background: active ? 'var(--b-grad)' : 'transparent',
              color: active ? 'white' : 'var(--f-text-2)',
              boxShadow: active ? 'var(--b-elev-card)' : 'none',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
