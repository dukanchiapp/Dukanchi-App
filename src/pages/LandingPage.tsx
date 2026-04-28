import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const DEFAULT: any = {
  nav: { logoSub: 'apna bazaar, apni dukaan', ctaText: 'Free mein Join Karo' },
  hero: {
    badge: 'India ka apna Local Discovery App',
    h1Line1: 'Ab Aapki', h1Accent: 'Local Market', h1Line2: 'Aapke Phone Par',
    subtitle: 'Na 4 din ka wait. Na expensive delivery fees. Seedha apne ghar ke paas ki real dukaan se connect karo.',
    hookAccent1: 'Quick Commerce se sasta.', hookAccent2: 'Trust se better.',
    cta1: 'App Download Karo — Free', cta2: 'Login / Sign Up',
    heroImage: '',
  },
  problem: {
    tag: 'Sachchi Baat', h2Normal: '10 minute delivery ne', h2Bold: 'aapko loot liya',
    subtitle: 'Wahi product. Double price. Aur aapke gali ki dukaan band ho gayi. Yeh nahi chalega.',
    badCol: {
      title: 'Quick Commerce',
      items: ['Dark store se aata hai — koi human nahi, koi trust nahi', 'Delivery charge + surge pricing + packaging fee', 'Ganda product mila? Return ka drama', 'Aapki gali ka shopkeeper band ho gaya'],
      price: '₹65', priceSub: 'Lays packet — delivery + fees ke saath',
    },
    goodCol: {
      title: 'Dukanchi',
      items: ['Real dukaan, real insaan — jo aapko jaanta hai', 'MRP hi price — koi hidden charges nahi', 'Chat karo, confirm karo, trust ke saath khareedo', 'Aapka paisa aapke padosi ke ghar jaata hai'],
      price: '₹20', priceSub: 'Wahi Lays — seedha dukaan se',
    },
  },
  hooks: [
    { emoji: '🚨', title: 'Raat 2 baje medicine ki zarurat hai.', para1: 'Amazon? Kal aayega. Blinkit? Stock nahi.', para2: 'Dukanchi pe search karo — 500m mein kaunsa store open hai, exact location, phone number — sab ek jagah.', stat: 'Location + timings + phone — sab mil jaata hai' },
    { emoji: '🎮', title: 'PS5 online 3 hafte se sold out hai.', para1: 'Waiting list. Out of stock. Fake listings. Frustrating.', para2: 'Jo online nahi milta, woh offline milta hai. Aapke 1 km ke andar kisi retailer ke paas ho sakta hai PS5.', stat: 'Product search → nearby store → confirm → jao' },
    { emoji: '💬', title: 'Mann mein koi product aaye — seedha Dukanchi.', para1: 'Pehle call karo. Engaged. Phir jao. Band hai. Time waste.', para2: 'Ab seedha chat karo. Stock confirm karo. Tab jao.', stat: 'Chat karo → Confirm karo → Jao' },
  ],
  features: {
    tag: 'Kyun Dukanchi', h2: 'Jo aur koi nahi deta', subtitle: 'Ek app mein sab — local market ka poora experience digitally',
    items: [
      { icon: '⚡', title: 'Instant Connection', desc: 'Chat karo directly dukaan se — koi waiting nahi, koi IVR nahi.' },
      { icon: '📍', title: 'Real Availability', desc: 'Jo nearby available hai wahi dikhega. Real products, real stores.' },
      { icon: '💰', title: 'Better Prices', desc: '10-min delivery se better pricing — koi surge pricing nahi.' },
      { icon: '📞', title: 'Full Store Details', desc: 'Open/close timings, working days, exact location, phone — sab ek jagah.' },
    ],
  },
  howItWorks: {
    tag: 'Itna Simple', h2: '3 steps. 30 seconds.', subtitle: 'Koi tutorial nahi. Koi training nahi. Bas karo.',
    steps: [
      { num: '1', title: 'Search karo', desc: 'Jo chahiye — product, category, store name — kuch bhi type karo. AI samjhega.', tag: 'Smart search powered by AI' },
      { num: '2', title: 'Nearby store dhundho', desc: 'Map pe dekho, distance dekho, open/closed status dekho — sab real-time.', tag: 'Live store status' },
      { num: '3', title: 'Chat karo, jao', desc: 'Stock confirm karo. Deal pakki karo. Tab ghar se niklo. Zero time waste.', tag: 'Direct chat with shopkeeper' },
    ],
  },
  illustration: { h2: 'Aapka mohalla, aapki dukaan, aapke phone pe.', chatBubble1: 'PS5 hai kya?', chatBubble2: 'Haan! Aao ☑️' },
  campaigns: {
    tag: 'Humara Mission', h2: 'Movement ka hissa bano', subtitle: 'Har purchase ek choice hai — local economy ko support karo',
    cards: [
      { flag: '🇮🇳', title: 'Vocal for Local', desc: 'Aapka har rupaya aapke padosi ke ghar jaata hai. Community strong hoti hai.' },
      { flag: '💻', title: 'Digital Bharat', desc: 'India ke 63 million kirana stores ko digital banao. Technology har gali tak pahunche.' },
    ],
  },
  finalCta: {
    h2Normal: 'Jo chahiye, jab chahiye —', h2Accent: 'bas chat karo.',
    subtitle: 'Na 4 din ka wait. Na expensive delivery. Seedha apne aas-paas ki dukaan se connect karo — free mein.',
    cta1: 'App Download Karo — Free', cta2: 'Login / Sign Up',
    note: 'Free hai. Hamesha rahega. Proudly Made in India 🇮🇳',
  },
  footer: { sub: 'apna bazaar, apni dukaan', tagline: 'Vocal for Local | Digital Bharat', copyright: '© 2026 Dukanchi. Proudly Supporting Local Retail India.' },
};

const c = (fetched: any, path: string): string => {
  const keys = path.split('.');
  let cur = fetched;
  for (const k of keys) { cur = cur?.[k]; }
  let def = DEFAULT as any;
  for (const k of keys) { def = def?.[k]; }
  return (cur !== undefined && cur !== null && cur !== '') ? String(cur) : String(def ?? '');
};

const TAG_STYLE: React.CSSProperties = { display: 'inline-block', background: '#fff3e0', color: '#f97316', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, marginBottom: 12 };
const OG = '#f97316';

export default function LandingPage() {
  const [ct, setCt] = useState<any>(null);

  useEffect(() => {
    fetch('/api/landing-content')
      .then(r => r.ok ? r.json() : { content: DEFAULT })
      .then(d => setCt(d.content || DEFAULT))
      .catch(() => setCt(DEFAULT));
  }, []);

  const d = ct || DEFAULT;
  const hooks: any[] = Array.isArray(d.hooks) ? d.hooks : DEFAULT.hooks;
  const featureItems: any[] = Array.isArray(d.features?.items) ? d.features.items : DEFAULT.features.items;
  const steps: any[] = Array.isArray(d.howItWorks?.steps) ? d.howItWorks.steps : DEFAULT.howItWorks.steps;
  const campaignCards: any[] = Array.isArray(d.campaigns?.cards) ? d.campaigns.cards : DEFAULT.campaigns.cards;
  const badItems: string[] = Array.isArray(d.problem?.badCol?.items) ? d.problem.badCol.items : DEFAULT.problem.badCol.items;
  const goodItems: string[] = Array.isArray(d.problem?.goodCol?.items) ? d.problem.goodCol.items : DEFAULT.problem.goodCol.items;

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: OG }}>Dukanchi</span>
          <div style={{ fontSize: 10, color: '#666', marginTop: -2 }}>{c(d, 'nav.logoSub')}</div>
        </div>
        <Link to="/login" style={{ background: OG, color: '#fff', borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          {c(d, 'nav.ctaText')}
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section style={{ padding: '60px 20px 50px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={TAG_STYLE}>{c(d, 'hero.badge')}</div>
        <h1 style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.15, margin: '0 0 16px', letterSpacing: '-1px' }}>
          {c(d, 'hero.h1Line1')}{' '}
          <span style={{ color: OG }}>{c(d, 'hero.h1Accent')}</span>
          <br />{c(d, 'hero.h1Line2')}
        </h1>
        <p style={{ fontSize: 15, color: '#aaa', lineHeight: 1.6, marginBottom: 20 }}>{c(d, 'hero.subtitle')}</p>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 28 }}>
          <span style={{ color: OG, fontWeight: 700 }}>{c(d, 'hero.hookAccent1')}</span>{' '}
          Delivery se fast.{' '}
          <span style={{ color: OG, fontWeight: 700 }}>{c(d, 'hero.hookAccent2')}</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/signup" style={{ background: OG, color: '#fff', borderRadius: 14, padding: '16px 24px', fontSize: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center' }}>
            {c(d, 'hero.cta1')}
          </Link>
          <Link to="/login" style={{ background: '#1a1a1a', color: '#fff', borderRadius: 14, padding: '14px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center', border: '1px solid #333' }}>
            {c(d, 'hero.cta2')}
          </Link>
        </div>
        {d.hero?.heroImage && (
          <img
            src={d.hero.heroImage}
            alt="App screenshot"
            style={{ width: '100%', maxWidth: 320, margin: '28px auto 0', display: 'block', borderRadius: 20, border: '1px solid #222', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        )}
      </section>

      {/* ── PROBLEM ── */}
      <section style={{ padding: '50px 20px', background: '#0f0f0f', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={TAG_STYLE}>{c(d, 'problem.tag')}</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.2 }}>
            {c(d, 'problem.h2Normal')}{' '}
            <span style={{ color: OG }}>{c(d, 'problem.h2Bold')}</span>
          </h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{c(d, 'problem.subtitle')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Bad */}
          <div style={{ background: '#1a0000', border: '1px solid #3a0000', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', marginBottom: 10, textTransform: 'uppercase' }}>❌ {d.problem?.badCol?.title || DEFAULT.problem.badCol.title}</p>
            {badItems.map((item, i) => <p key={i} style={{ fontSize: 11, color: '#f87171', marginBottom: 6 }}>• {item}</p>)}
            <div style={{ marginTop: 14, borderTop: '1px solid #3a0000', paddingTop: 12 }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#f87171' }}>{d.problem?.badCol?.price || DEFAULT.problem.badCol.price}</p>
              <p style={{ fontSize: 10, color: '#888' }}>{d.problem?.badCol?.priceSub || DEFAULT.problem.badCol.priceSub}</p>
            </div>
          </div>
          {/* Good */}
          <div style={{ background: '#001a00', border: '1px solid #003a00', borderRadius: 16, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 10, textTransform: 'uppercase' }}>✅ {d.problem?.goodCol?.title || DEFAULT.problem.goodCol.title}</p>
            {goodItems.map((item, i) => <p key={i} style={{ fontSize: 11, color: '#4ade80', marginBottom: 6 }}>• {item}</p>)}
            <div style={{ marginTop: 14, borderTop: '1px solid #003a00', paddingTop: 12 }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: '#4ade80' }}>{d.problem?.goodCol?.price || DEFAULT.problem.goodCol.price}</p>
              <p style={{ fontSize: 10, color: '#888' }}>{d.problem?.goodCol?.priceSub || DEFAULT.problem.goodCol.priceSub}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOOKS ── */}
      <section style={{ padding: '20px 0' }}>
        {hooks.map((hook: any, i: number) => (
          <div key={i} style={{ padding: '40px 20px', background: i % 2 === 0 ? '#0a0a0a' : '#0f0f0f', borderBottom: '1px solid #1a1a1a', maxWidth: 480, margin: '0 auto' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{hook.emoji}</div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, lineHeight: 1.3 }}>{hook.title}</h3>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 10, lineHeight: 1.6 }}>{hook.para1}</p>
            <p style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6, marginBottom: 16 }}>{hook.para2}</p>
            <div style={{ background: '#1a1a00', border: '1px solid #333', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 12, color: OG, fontWeight: 700 }}>⚡ {hook.stat}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '50px 20px', background: '#0f0f0f', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={TAG_STYLE}>{c(d, 'features.tag')}</div>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>{c(d, 'features.h2')}</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{c(d, 'features.subtitle')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {featureItems.map((item: any, i: number) => (
            <div key={i} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{item.title}</p>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '50px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={TAG_STYLE}>{c(d, 'howItWorks.tag')}</div>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>{c(d, 'howItWorks.h2')}</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{c(d, 'howItWorks.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {steps.map((step: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#111', border: '1px solid #222', borderRadius: 16, padding: 18 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: OG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>{step.num}</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{step.title}</p>
                <p style={{ fontSize: 13, color: '#888', lineHeight: 1.5, marginBottom: 8 }}>{step.desc}</p>
                <span style={{ background: '#1a1a00', color: OG, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{step.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ILLUSTRATION ── */}
      <section style={{ padding: '50px 20px', background: '#0f0f0f', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, lineHeight: 1.3 }}>{c(d, 'illustration.h2')}</h2>
        <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 20, padding: 24, maxWidth: 280, margin: '0 auto' }}>
          <div style={{ background: '#222', borderRadius: 14, padding: '10px 16px', marginBottom: 10, textAlign: 'left', fontSize: 14 }}>{c(d, 'illustration.chatBubble1')}</div>
          <div style={{ background: OG, borderRadius: 14, padding: '10px 16px', textAlign: 'right', fontSize: 14, color: '#fff', fontWeight: 700 }}>{c(d, 'illustration.chatBubble2')}</div>
        </div>
      </section>

      {/* ── CAMPAIGNS ── */}
      <section style={{ padding: '50px 20px', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={TAG_STYLE}>{c(d, 'campaigns.tag')}</div>
          <h2 style={{ fontSize: 28, fontWeight: 900 }}>{c(d, 'campaigns.h2')}</h2>
          <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{c(d, 'campaigns.subtitle')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {campaignCards.map((card: any, i: number) => (
            <div key={i} style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{card.flag}</div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{card.title}</p>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '60px 20px', background: '#0f0f0f', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.2, marginBottom: 14 }}>
          {c(d, 'finalCta.h2Normal')}<br />
          <span style={{ color: OG }}>{c(d, 'finalCta.h2Accent')}</span>
        </h2>
        <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 28 }}>{c(d, 'finalCta.subtitle')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <Link to="/signup" style={{ background: OG, color: '#fff', borderRadius: 14, padding: '16px 24px', fontSize: 16, fontWeight: 800, textDecoration: 'none', textAlign: 'center' }}>
            {c(d, 'finalCta.cta1')}
          </Link>
          <Link to="/login" style={{ background: '#1a1a1a', color: '#fff', borderRadius: 14, padding: '14px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center', border: '1px solid #333' }}>
            {c(d, 'finalCta.cta2')}
          </Link>
        </div>
        <p style={{ fontSize: 12, color: '#555' }}>{c(d, 'finalCta.note')}</p>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '30px 20px', borderTop: '1px solid #1a1a1a', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: OG, marginBottom: 4 }}>Dukanchi</p>
        <p style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{c(d, 'footer.sub')}</p>
        <p style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>{c(d, 'footer.tagline')}</p>
        <p style={{ fontSize: 11, color: '#333' }}>{c(d, 'footer.copyright')}</p>
      </footer>
    </div>
  );
}
