import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { FIcon, FLogo } from '../components/futuristic';

/* ── Futuristic v2 skin · Phase 9 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. The landing CMS wiring
   (/api/landing-content fetch, DEFAULT fallback content, the c() path reader,
   every editable content path) is preserved verbatim. The hero gains a Three.js
   spatial scene loaded from CDN with a graceful gradient fallback — no npm
   dependency, no app-bundle bloat. */

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

const section: React.CSSProperties = { maxWidth: 480, margin: '0 auto', padding: '52px 20px' };
const sectionHead: React.CSSProperties = { textAlign: 'center', marginBottom: 28 };
const glassCard: React.CSSProperties = {
  background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
  backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
};
const sceneTag: React.CSSProperties = {
  position: 'absolute', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 9999,
  background: 'rgba(15,15,30,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--f-glass-border-2)', fontSize: 10.5, color: 'white', fontWeight: 600,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
};

/* Three.js spatial hero — 6 floating shop pylons, a glowing user marker and a
   pulse ring. The three@0.149.0 UMD build is loaded from CDN; if it fails
   (offline / blocked) the mount falls back to a soft gradient panel. */
function Hero3DScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let raf = 0;
    let renderer: any = null;
    let canvas: HTMLCanvasElement | null = null;
    let onResize: (() => void) | null = null;
    let cancelled = false;

    const init = () => {
      if (cancelled || canvas) return;
      const THREE = (window as any).THREE;
      if (!THREE) {
        mount.style.background = 'linear-gradient(135deg, rgba(255,107,53,0.18), rgba(255,42,140,0.18))';
        mount.style.border = '1px solid var(--f-glass-border)';
        return;
      }

      const sceneSize = () => Math.min(mount.clientWidth, 460);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 4, 8);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(sceneSize(), sceneSize());
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      canvas = renderer.domElement as HTMLCanvasElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.borderRadius = '28px';
      mount.appendChild(canvas);

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const key = new THREE.DirectionalLight(0xff6b35, 1.8); key.position.set(5, 6, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(0xff2a8c, 1.4); fill.position.set(-5, 4, 3); scene.add(fill);
      const rim = new THREE.PointLight(0x00e5ff, 1.2, 12); rim.position.set(0, -2, -4); scene.add(rim);

      const grid = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.1 }),
      );
      grid.rotation.x = -Math.PI / 2;
      grid.position.y = -1.3;
      scene.add(grid);

      const SHOPS = [
        { x: -2.2, z: -1.5, h: 1.6, color: 0xff6b35 },
        { x: 1.8, z: -1.0, h: 2.4, color: 0xff2a8c },
        { x: -1.2, z: 1.6, h: 1.2, color: 0x00e5ff },
        { x: 2.4, z: 1.8, h: 1.8, color: 0xff6b35 },
        { x: -2.8, z: 0.6, h: 0.9, color: 0xffd96b },
        { x: 0.6, z: 2.6, h: 1.4, color: 0x6b33ff },
      ];
      const pylons: { mesh: any; baseY: number; phase: number }[] = [];
      SHOPS.forEach(s => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, s.h, 0.7),
          new THREE.MeshPhysicalMaterial({
            color: s.color, metalness: 0.4, roughness: 0.35,
            emissive: s.color, emissiveIntensity: 0.45, clearcoat: 1, clearcoatRoughness: 0.2,
          }),
        );
        m.position.set(s.x, s.h / 2 - 1.3, s.z);
        scene.add(m);
        pylons.push({ mesh: m, baseY: s.h / 2 - 1.3, phase: Math.random() * Math.PI * 2 });

        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.position.set(s.x, s.h - 1.25, s.z);
        scene.add(dot);
      });

      const user = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 32, 32),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xff2a8c, emissiveIntensity: 1.4, metalness: 0.5, roughness: 0.2, clearcoat: 1 }),
      );
      user.position.set(0, -1.0, 0);
      scene.add(user);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a8c, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 64), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, -1.28, 0);
      scene.add(ring);

      onResize = () => {
        const s = sceneSize();
        renderer.setSize(s, s);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      onResize();

      const targetRot = { x: 0, y: 0 };
      const currentRot = { x: 0, y: 0 };
      mount.addEventListener('pointermove', (e) => {
        const r = mount.getBoundingClientRect();
        targetRot.y = (((e.clientX - r.left) / r.width) - 0.5) * 0.6;
        targetRot.x = (((e.clientY - r.top) / r.height) - 0.5) * 0.3;
      });
      mount.addEventListener('pointerleave', () => { targetRot.x = 0; targetRot.y = 0; });

      const clock = new THREE.Clock();
      const animate = () => {
        if (cancelled) return;
        const t = clock.getElapsedTime();
        currentRot.x += (targetRot.x - currentRot.x) * 0.05;
        currentRot.y += (targetRot.y - currentRot.y) * 0.05;
        scene.rotation.y = t * 0.12 + currentRot.y;
        scene.rotation.x = currentRot.x;
        pylons.forEach(p => { p.mesh.position.y = p.baseY + Math.sin(t * 0.8 + p.phase) * 0.08; });
        user.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
        ring.scale.setScalar(1 + (t % 2) * 1.6);
        ringMat.opacity = 0.7 * (1 - (t % 2) / 2);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();
    };

    if ((window as any).THREE) {
      init();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-three-cdn]');
      if (existing) {
        existing.addEventListener('load', init);
        existing.addEventListener('error', init);
      } else {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/three@0.149.0/build/three.min.js';
        script.async = true;
        script.setAttribute('data-three-cdn', '');
        script.addEventListener('load', init);
        script.addEventListener('error', init);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (onResize) window.removeEventListener('resize', onResize);
      if (renderer) { try { renderer.dispose(); } catch { /* noop */ } }
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '32px auto 0' }}>
      <div ref={mountRef} style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 28 }} />
      <span style={{ ...sceneTag, top: '6%', left: '0%' }}>
        <span style={{ color: 'var(--f-success)', textShadow: '0 0 8px var(--f-success)' }}>●</span> Sharma Electronics · 1.2km
      </span>
      <span style={{ ...sceneTag, top: '46%', right: '0%' }}>
        <span style={{ color: 'var(--f-success)', textShadow: '0 0 8px var(--f-success)' }}>●</span> Mehta Kirana · 300m
      </span>
      <span style={{ ...sceneTag, bottom: '10%', left: '8%' }}>
        <span style={{ color: 'var(--f-success)', textShadow: '0 0 8px var(--f-success)' }}>●</span> Vivo Mobile · 800m
      </span>
    </div>
  );
}

export default function LandingPage() {
  const [ct, setCt] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/landing-content')
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
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', color: 'var(--f-text-1)', fontFamily: 'var(--f-font)', overflowX: 'hidden' }}>
      {/* Aurora wash */}
      <div style={{ position: 'fixed', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── NAV ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', background: 'var(--f-sticky-bg)', backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid var(--f-glass-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FLogo size={34} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <span className="f-display" style={{ fontSize: 16, color: 'var(--f-text-1)' }}>Dukanchi</span>
              <span style={{ fontSize: 9, color: 'var(--f-text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{c(d, 'nav.logoSub')}</span>
            </div>
          </div>
          <Link
            to="/login"
            style={{
              background: 'var(--f-grad-primary)', color: 'white', borderRadius: 9999, padding: '9px 18px',
              fontSize: 12.5, fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 18px rgba(255,107,53,0.4)',
            }}
          >
            {c(d, 'nav.ctaText')}
          </Link>
        </nav>

        {/* ── HERO ── */}
        <section style={{ ...section, paddingTop: 48, textAlign: 'center' }}>
          <span className="f-eyebrow">{c(d, 'hero.badge')}</span>
          <h1 className="f-display" style={{ fontSize: 42, lineHeight: 1.02, margin: '16px 0 16px' }}>
            {c(d, 'hero.h1Line1')}{' '}
            <span className="f-grad-text">{c(d, 'hero.h1Accent')}</span>
            <br />{c(d, 'hero.h1Line2')}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--f-text-2)', lineHeight: 1.6, margin: '0 0 16px' }}>{c(d, 'hero.subtitle')}</p>
          <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: '0 0 26px' }}>
            <span style={{ color: 'var(--f-orange-light)', fontWeight: 700 }}>{c(d, 'hero.hookAccent1')}</span>{' '}
            Delivery se fast.{' '}
            <span style={{ color: 'var(--f-orange-light)', fontWeight: 700 }}>{c(d, 'hero.hookAccent2')}</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              to="/signup"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--f-grad-primary)',
                color: 'white', borderRadius: 14, padding: '16px 24px', fontSize: 15, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 0 28px rgba(255,107,53,0.42)',
              }}
            >
              {c(d, 'hero.cta1')} <FIcon name="arrowR" size={18} color="white" />
            </Link>
            <Link
              to="/login"
              style={{
                ...glassCard, color: 'var(--f-text-1)', borderRadius: 14, padding: '14px 24px', fontSize: 14,
                fontWeight: 600, textDecoration: 'none', textAlign: 'center',
              }}
            >
              {c(d, 'hero.cta2')}
            </Link>
          </div>

          {/* Spatial 3D scene */}
          <Hero3DScene />

          {d.hero?.heroImage && (
            <img
              src={d.hero.heroImage}
              alt="App screenshot"
              style={{ width: '100%', maxWidth: 320, margin: '28px auto 0', display: 'block', borderRadius: 20, border: '1px solid var(--f-glass-border-2)', boxShadow: '0 20px 60px rgba(0,0,0,0.55)' }}
            />
          )}
        </section>

        {/* ── PROBLEM ── */}
        <section style={section}>
          <div style={sectionHead}>
            <span className="f-eyebrow">{c(d, 'problem.tag')}</span>
            <h2 className="f-display" style={{ fontSize: 28, lineHeight: 1.05, margin: '14px 0 8px' }}>
              {c(d, 'problem.h2Normal')}{' '}
              <span className="f-grad-text">{c(d, 'problem.h2Bold')}</span>
            </h2>
            <p style={{ fontSize: 14, color: 'var(--f-text-3)', margin: 0 }}>{c(d, 'problem.subtitle')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Bad */}
            <div style={{ background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.26)', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--f-danger)', marginBottom: 10, textTransform: 'uppercase' }}>
                ❌ {d.problem?.badCol?.title || DEFAULT.problem.badCol.title}
              </p>
              {badItems.map((item, i) => <p key={i} style={{ fontSize: 11, color: '#FF8FA3', marginBottom: 6 }}>• {item}</p>)}
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,77,106,0.26)', paddingTop: 12 }}>
                <p className="f-mono" style={{ fontSize: 28, fontWeight: 900, color: 'var(--f-danger)', margin: 0 }}>{d.problem?.badCol?.price || DEFAULT.problem.badCol.price}</p>
                <p style={{ fontSize: 10, color: 'var(--f-text-3)', margin: '2px 0 0' }}>{d.problem?.badCol?.priceSub || DEFAULT.problem.badCol.priceSub}</p>
              </div>
            </div>
            {/* Good */}
            <div style={{ background: 'rgba(46,231,161,0.08)', border: '1px solid rgba(46,231,161,0.26)', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--f-success)', marginBottom: 10, textTransform: 'uppercase' }}>
                ✅ {d.problem?.goodCol?.title || DEFAULT.problem.goodCol.title}
              </p>
              {goodItems.map((item, i) => <p key={i} style={{ fontSize: 11, color: '#8BF0CC', marginBottom: 6 }}>• {item}</p>)}
              <div style={{ marginTop: 14, borderTop: '1px solid rgba(46,231,161,0.26)', paddingTop: 12 }}>
                <p className="f-mono" style={{ fontSize: 28, fontWeight: 900, color: 'var(--f-success)', margin: 0 }}>{d.problem?.goodCol?.price || DEFAULT.problem.goodCol.price}</p>
                <p style={{ fontSize: 10, color: 'var(--f-text-3)', margin: '2px 0 0' }}>{d.problem?.goodCol?.priceSub || DEFAULT.problem.goodCol.priceSub}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOOKS ── */}
        <section style={{ maxWidth: 480, margin: '0 auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hooks.map((hook: any, i: number) => (
            <div key={i} className="f-glass f-glass-edge" style={{ ...glassCard, borderRadius: 20, padding: 22 }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>{hook.emoji}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.3, color: 'var(--f-text-1)', letterSpacing: '-0.02em' }}>{hook.title}</h3>
              <p style={{ fontSize: 13.5, color: 'var(--f-text-3)', margin: '0 0 8px', lineHeight: 1.6 }}>{hook.para1}</p>
              <p style={{ fontSize: 13.5, color: 'var(--f-text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>{hook.para2}</p>
              <div style={{ background: 'rgba(255,107,53,0.10)', border: '1px solid rgba(255,107,53,0.28)', borderRadius: 12, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, color: 'var(--f-orange-light)', fontWeight: 700, margin: 0 }}>⚡ {hook.stat}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ── FEATURES ── */}
        <section style={section}>
          <div style={sectionHead}>
            <span className="f-eyebrow">{c(d, 'features.tag')}</span>
            <h2 className="f-display" style={{ fontSize: 28, margin: '14px 0 8px' }}>{c(d, 'features.h2')}</h2>
            <p style={{ fontSize: 14, color: 'var(--f-text-3)', margin: 0 }}>{c(d, 'features.subtitle')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {featureItems.map((item: any, i: number) => (
              <div key={i} className="f-glass" style={{ ...glassCard, borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 6px', color: 'var(--f-text-1)' }}>{item.title}</p>
                <p style={{ fontSize: 12, color: 'var(--f-text-3)', lineHeight: 1.5, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={section}>
          <div style={sectionHead}>
            <span className="f-eyebrow">{c(d, 'howItWorks.tag')}</span>
            <h2 className="f-display" style={{ fontSize: 28, margin: '14px 0 8px' }}>{c(d, 'howItWorks.h2')}</h2>
            <p style={{ fontSize: 14, color: 'var(--f-text-3)', margin: 0 }}>{c(d, 'howItWorks.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {steps.map((step: any, i: number) => (
              <div key={i} className="f-glass" style={{ ...glassCard, display: 'flex', gap: 16, alignItems: 'flex-start', borderRadius: 16, padding: 18 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 18, flexShrink: 0, background: 'var(--f-grad-primary)', color: 'white',
                  boxShadow: '0 0 16px rgba(255,42,140,0.45)',
                }}>
                  {step.num}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--f-text-1)' }}>{step.title}</p>
                  <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.5, margin: '0 0 8px' }}>{step.desc}</p>
                  <span style={{ background: 'rgba(255,107,53,0.12)', color: 'var(--f-orange-light)', borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{step.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── ILLUSTRATION ── */}
        <section style={{ ...section, textAlign: 'center' }}>
          <h2 className="f-display" style={{ fontSize: 23, margin: '0 0 24px', lineHeight: 1.25 }}>{c(d, 'illustration.h2')}</h2>
          <div className="f-glass" style={{ ...glassCard, borderRadius: 20, padding: 22, maxWidth: 280, margin: '0 auto' }}>
            <div style={{
              background: 'var(--f-glass-bg-3)', border: '1px solid var(--f-glass-border)', borderRadius: '16px 16px 16px 4px',
              padding: '10px 16px', marginBottom: 10, textAlign: 'left', fontSize: 14, color: 'var(--f-text-1)',
            }}>
              {c(d, 'illustration.chatBubble1')}
            </div>
            <div style={{
              background: 'var(--f-grad-primary)', borderRadius: '16px 16px 4px 16px', padding: '10px 16px',
              textAlign: 'right', fontSize: 14, color: 'white', fontWeight: 700, boxShadow: '0 0 18px rgba(255,42,140,0.3)',
            }}>
              {c(d, 'illustration.chatBubble2')}
            </div>
          </div>
        </section>

        {/* ── CAMPAIGNS ── */}
        <section style={section}>
          <div style={sectionHead}>
            <span className="f-eyebrow">{c(d, 'campaigns.tag')}</span>
            <h2 className="f-display" style={{ fontSize: 28, margin: '14px 0 8px' }}>{c(d, 'campaigns.h2')}</h2>
            <p style={{ fontSize: 14, color: 'var(--f-text-3)', margin: 0 }}>{c(d, 'campaigns.subtitle')}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {campaignCards.map((card: any, i: number) => (
              <div key={i} className="f-glass" style={{ ...glassCard, borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>{card.flag}</div>
                <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--f-text-1)' }}>{card.title}</p>
                <p style={{ fontSize: 12, color: 'var(--f-text-3)', lineHeight: 1.5, margin: 0 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section style={{ ...section, textAlign: 'center', paddingTop: 64, paddingBottom: 64 }}>
          <span className="f-eyebrow">Vocal for Local · Digital Bharat 🇮🇳</span>
          <h2 className="f-display" style={{ fontSize: 32, lineHeight: 1.05, margin: '14px 0 14px' }}>
            {c(d, 'finalCta.h2Normal')}<br />
            <span className="f-grad-text">{c(d, 'finalCta.h2Accent')}</span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--f-text-3)', lineHeight: 1.6, margin: '0 0 26px' }}>{c(d, 'finalCta.subtitle')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
            <Link
              to="/signup"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--f-grad-primary)',
                color: 'white', borderRadius: 14, padding: '16px 24px', fontSize: 15, fontWeight: 800, textDecoration: 'none',
                boxShadow: '0 0 28px rgba(255,107,53,0.42)',
              }}
            >
              {c(d, 'finalCta.cta1')} <FIcon name="arrowR" size={18} color="white" />
            </Link>
            <Link
              to="/login"
              style={{ ...glassCard, color: 'var(--f-text-1)', borderRadius: 14, padding: '14px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}
            >
              {c(d, 'finalCta.cta2')}
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'var(--f-text-4)', margin: 0 }}>{c(d, 'finalCta.note')}</p>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ maxWidth: 480, margin: '0 auto', padding: '32px 20px 40px', borderTop: '1px solid var(--f-glass-border)', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <FLogo size={28} glow={false} />
            <span className="f-display" style={{ fontSize: 17, color: 'var(--f-text-1)' }}>Dukanchi</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--f-text-3)', margin: '0 0 6px' }}>{c(d, 'footer.sub')}</p>
          <p style={{ fontSize: 11, color: 'var(--f-text-4)', margin: '0 0 10px' }}>{c(d, 'footer.tagline')}</p>
          <p style={{ fontSize: 11, color: 'var(--f-text-4)', margin: 0 }}>{c(d, 'footer.copyright')}</p>
        </footer>
      </div>
    </div>
  );
}
