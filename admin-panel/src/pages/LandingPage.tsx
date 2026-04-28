import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Save, ExternalLink, Plus, Trash2, Upload, PanelRight, X } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

// ── Default content (mirrors backend defaultContent) ─────────────────────────
const DEFAULT_CONTENT: any = {
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
    { emoji: '🚨', title: 'Raat 2 baje medicine ki zarurat hai.', para1: 'Amazon? Kal aayega. Blinkit? Stock nahi. Apna pata nahi kaunsa medical store khula hai.', para2: 'Dukanchi pe search karo — 500m mein kaunsa store open hai, exact location, phone number — sab ek jagah. Seedha wahan jao.', stat: 'Location + timings + phone — sab mil jaata hai' },
    { emoji: '🎮', title: 'PS5 online 3 hafte se sold out hai.', para1: 'Waiting list. Out of stock. Fake listings. Frustrating.', para2: 'Jo online nahi milta, woh offline milta hai. Aapke 1 km ke andar kisi retailer ke paas ho sakta hai PS5. Dukanchi pe search karo.', stat: 'Product search → nearby store → confirm → jao' },
    { emoji: '💬', title: 'Mann mein koi product aaye — seedha Dukanchi.', para1: 'Pehle call karo. Engaged. Phir jao. Band hai. Time waste.', para2: 'Ab seedha chat karo. Stock confirm karo. Tab jao. Ghar se nikal ke pachtao nahi.', stat: 'Chat karo → Confirm karo → Jao' },
  ],
  features: {
    tag: 'Kyun Dukanchi', h2: 'Jo aur koi nahi deta', subtitle: 'Ek app mein sab — local market ka poora experience digitally',
    items: [
      { icon: '⚡', title: 'Instant Connection', desc: 'Chat karo directly dukaan se — koi waiting nahi, koi IVR nahi. Real shopkeeper, real time mein.' },
      { icon: '📍', title: 'Real Availability', desc: 'Jo nearby available hai wahi dikhega. Dukanchi pe jo stores hain unke paas real products hain.' },
      { icon: '💰', title: 'Better Prices', desc: '10-min delivery se better pricing — kyunki beech mein koi dark store, koi surge pricing, koi nahi.' },
      { icon: '📞', title: 'Full Store Details', desc: 'Open/close timings, working days, exact location, phone number — sab ek jagah.' },
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
      { flag: '🇮🇳', title: 'Vocal for Local', desc: 'Aapka har rupaya aapke padosi ke ghar jaata hai. Local shopkeeper ka business badhta hai. Community strong hoti hai.' },
      { flag: '💻', title: 'Digital Bharat', desc: "India ke 63 million kirana stores ko digital banao. Technology har gali tak pahunche — yeh hai Dukanchi ka sapna." },
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

// ── Section list ──────────────────────────────────────────────────────────────
const SECTIONS = ['Nav', 'Hero', 'Problem', 'Hook Cards', 'Features', 'How It Works', 'Illustration', 'Campaigns', 'Final CTA', 'Footer'] as const;
type Section = typeof SECTIONS[number];

// ── Reusable field components ─────────────────────────────────────────────────
function Field({ label, value, onChange, multiline = false, maxLen, emoji = false }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; maxLen?: number; emoji?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        {maxLen && <span className="text-xs text-gray-400">{(value || '').length}/{maxLen}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          maxLength={maxLen}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          maxLength={emoji ? 4 : maxLen}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      )}
    </div>
  );
}

function ListField({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <button
          onClick={() => onChange([...safeItems, ''])}
          className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-700"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-2">
        {safeItems.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={item || ''}
              onChange={e => { const n = [...safeItems]; n[i] = e.target.value; onChange(n); }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button onClick={() => onChange(safeItems.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-5 pb-2 border-b-2 border-orange-100">
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
    </div>
  );
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/api/admin/settings/upload', fd);
      onChange(res.data.imageUrl || res.data.url || '');
      showToast('Image uploaded', { type: 'success' });
    } catch {
      showToast('Upload failed', { type: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="mb-4">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      {value && (
        <div className="relative mb-2 group">
          <img src={value} alt="" className="w-full max-h-40 object-cover rounded-lg border border-gray-200" />
          <button
            onClick={() => onChange('')}
            className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste image URL or upload..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-semibold border border-orange-200 hover:bg-orange-100 disabled:opacity-60"
        >
          <Upload size={13} /> {uploading ? '...' : 'Upload'}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LandingPageCMS() {
  const [content, setContent] = useState<any>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('Hero');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const { showToast } = useToast();

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/landing-content');
      console.log('[LandingCMS] API response:', res.data);
      const fetched = res.data?.content;
      setContent(fetched && typeof fetched === 'object' ? fetched : DEFAULT_CONTENT);
    } catch (err) {
      console.error('[LandingCMS] fetch failed, using defaults:', err);
      setContent(DEFAULT_CONTENT);
      showToast('Could not load from server — showing defaults', { type: 'info' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  // Deep-path setter
  const update = (path: string, value: any) => {
    setContent((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev ?? DEFAULT_CONTENT));
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] === undefined || cur[keys[i]] === null) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
    setDirty(true);
  };

  // Get string value — falls back through DEFAULT_CONTENT
  const g = (path: string): string => {
    const keys = path.split('.');
    let cur: any = content ?? DEFAULT_CONTENT;
    for (const k of keys) cur = cur?.[k];
    if (cur !== undefined && cur !== null && cur !== '') return String(cur);
    // Try default
    let def: any = DEFAULT_CONTENT;
    for (const k of keys) def = def?.[k];
    return def !== undefined && def !== null ? String(def) : '';
  };

  // Get array value — falls back through DEFAULT_CONTENT
  const ga = (path: string): string[] => {
    const keys = path.split('.');
    let cur: any = content ?? DEFAULT_CONTENT;
    for (const k of keys) cur = cur?.[k];
    if (Array.isArray(cur)) return cur;
    let def: any = DEFAULT_CONTENT;
    for (const k of keys) def = def?.[k];
    return Array.isArray(def) ? def : [];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/landing-content', { content });
      setDirty(false);
      setIframeKey(k => k + 1);
      showToast('Content saved! Landing page updated.', { type: 'success' });
    } catch (err) {
      console.error('[LandingCMS] save failed:', err);
      showToast('Save failed, try again', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Section renderers ───────────────────────────────────────────────────────
  const renderSection = () => {
    const ct = content ?? DEFAULT_CONTENT;

    switch (activeSection) {
      case 'Nav':
        return (
          <>
            <SectionDivider title="Navigation Bar" />
            <Field label="Logo Subtitle" value={g('nav.logoSub')} onChange={v => update('nav.logoSub', v)} />
            <Field label="CTA Button Text" value={g('nav.ctaText')} onChange={v => update('nav.ctaText', v)} />
          </>
        );

      case 'Hero':
        return (
          <>
            <SectionDivider title="Hero Section" />
            <Field label="Badge Text" value={g('hero.badge')} onChange={v => update('hero.badge', v)} maxLen={80} />
            <Field label="H1 Line 1" value={g('hero.h1Line1')} onChange={v => update('hero.h1Line1', v)} />
            <Field label="H1 Accent (shows in orange)" value={g('hero.h1Accent')} onChange={v => update('hero.h1Accent', v)} />
            <Field label="H1 Line 2" value={g('hero.h1Line2')} onChange={v => update('hero.h1Line2', v)} />
            <Field label="Subtitle" value={g('hero.subtitle')} onChange={v => update('hero.subtitle', v)} multiline maxLen={220} />
            <Field label="Hook Accent 1 (orange)" value={g('hero.hookAccent1')} onChange={v => update('hero.hookAccent1', v)} />
            <Field label="Hook Accent 2 (orange)" value={g('hero.hookAccent2')} onChange={v => update('hero.hookAccent2', v)} />
            <Field label="Primary CTA Button" value={g('hero.cta1')} onChange={v => update('hero.cta1', v)} />
            <Field label="Secondary CTA Button" value={g('hero.cta2')} onChange={v => update('hero.cta2', v)} />
            <SectionDivider title="Hero Image (optional app screenshot)" />
            <ImageField label="Hero Image" value={g('hero.heroImage')} onChange={v => update('hero.heroImage', v)} />
          </>
        );

      case 'Problem':
        return (
          <>
            <SectionDivider title="Problem Section" />
            <Field label="Tag" value={g('problem.tag')} onChange={v => update('problem.tag', v)} />
            <Field label="H2 Normal" value={g('problem.h2Normal')} onChange={v => update('problem.h2Normal', v)} />
            <Field label="H2 Bold (orange)" value={g('problem.h2Bold')} onChange={v => update('problem.h2Bold', v)} />
            <Field label="Subtitle" value={g('problem.subtitle')} onChange={v => update('problem.subtitle', v)} multiline />
            <SectionDivider title="Bad Column (Quick Commerce ❌)" />
            <Field label="Column Title" value={g('problem.badCol.title')} onChange={v => update('problem.badCol.title', v)} />
            <ListField label="Bullet Points" items={ga('problem.badCol.items')} onChange={v => update('problem.badCol.items', v)} />
            <Field label="Price" value={g('problem.badCol.price')} onChange={v => update('problem.badCol.price', v)} />
            <Field label="Price Sub-text" value={g('problem.badCol.priceSub')} onChange={v => update('problem.badCol.priceSub', v)} />
            <SectionDivider title="Good Column (Dukanchi ✅)" />
            <Field label="Column Title" value={g('problem.goodCol.title')} onChange={v => update('problem.goodCol.title', v)} />
            <ListField label="Bullet Points" items={ga('problem.goodCol.items')} onChange={v => update('problem.goodCol.items', v)} />
            <Field label="Price" value={g('problem.goodCol.price')} onChange={v => update('problem.goodCol.price', v)} />
            <Field label="Price Sub-text" value={g('problem.goodCol.priceSub')} onChange={v => update('problem.goodCol.priceSub', v)} />
          </>
        );

      case 'Hook Cards': {
        const hooks: any[] = Array.isArray(ct.hooks) ? ct.hooks : DEFAULT_CONTENT.hooks;
        return (
          <>
            <SectionDivider title="Hook Story Cards (3 cards)" />
            {hooks.map((hook: any, i: number) => (
              <div key={i} className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-bold text-orange-500 mb-4 uppercase tracking-wide">Hook {i + 1}</p>
                <Field label="Emoji" value={hook.emoji || ''} onChange={v => update(`hooks.${i}.emoji`, v)} emoji />
                <Field label="Title" value={hook.title || ''} onChange={v => update(`hooks.${i}.title`, v)} />
                <Field label="Paragraph 1" value={hook.para1 || ''} onChange={v => update(`hooks.${i}.para1`, v)} multiline />
                <Field label="Paragraph 2" value={hook.para2 || ''} onChange={v => update(`hooks.${i}.para2`, v)} multiline />
                <Field label="Stat / Highlight" value={hook.stat || ''} onChange={v => update(`hooks.${i}.stat`, v)} />
              </div>
            ))}
          </>
        );
      }

      case 'Features': {
        const items: any[] = Array.isArray(ct.features?.items) ? ct.features.items : DEFAULT_CONTENT.features.items;
        return (
          <>
            <SectionDivider title="Features Section" />
            <Field label="Tag" value={g('features.tag')} onChange={v => update('features.tag', v)} />
            <Field label="H2" value={g('features.h2')} onChange={v => update('features.h2', v)} />
            <Field label="Subtitle" value={g('features.subtitle')} onChange={v => update('features.subtitle', v)} multiline />
            {items.map((item: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase tracking-wide">Feature {i + 1}</p>
                <Field label="Icon (emoji)" value={item.icon || ''} onChange={v => update(`features.items.${i}.icon`, v)} emoji />
                <Field label="Title" value={item.title || ''} onChange={v => update(`features.items.${i}.title`, v)} />
                <Field label="Description" value={item.desc || ''} onChange={v => update(`features.items.${i}.desc`, v)} multiline />
              </div>
            ))}
          </>
        );
      }

      case 'How It Works': {
        const steps: any[] = Array.isArray(ct.howItWorks?.steps) ? ct.howItWorks.steps : DEFAULT_CONTENT.howItWorks.steps;
        return (
          <>
            <SectionDivider title="How It Works Section" />
            <Field label="Tag" value={g('howItWorks.tag')} onChange={v => update('howItWorks.tag', v)} />
            <Field label="H2" value={g('howItWorks.h2')} onChange={v => update('howItWorks.h2', v)} />
            <Field label="Subtitle" value={g('howItWorks.subtitle')} onChange={v => update('howItWorks.subtitle', v)} multiline />
            {steps.map((step: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase tracking-wide">Step {i + 1}</p>
                <Field label="Step Number" value={step.num || ''} onChange={v => update(`howItWorks.steps.${i}.num`, v)} />
                <Field label="Title" value={step.title || ''} onChange={v => update(`howItWorks.steps.${i}.title`, v)} />
                <Field label="Description" value={step.desc || ''} onChange={v => update(`howItWorks.steps.${i}.desc`, v)} multiline />
                <Field label="Tag Badge" value={step.tag || ''} onChange={v => update(`howItWorks.steps.${i}.tag`, v)} />
              </div>
            ))}
          </>
        );
      }

      case 'Illustration':
        return (
          <>
            <SectionDivider title="Illustration / Chat Demo" />
            <Field label="Heading" value={g('illustration.h2')} onChange={v => update('illustration.h2', v)} multiline />
            <Field label="Chat Bubble 1 (customer, left)" value={g('illustration.chatBubble1')} onChange={v => update('illustration.chatBubble1', v)} />
            <Field label="Chat Bubble 2 (store, orange right)" value={g('illustration.chatBubble2')} onChange={v => update('illustration.chatBubble2', v)} />
          </>
        );

      case 'Campaigns': {
        const cards: any[] = Array.isArray(ct.campaigns?.cards) ? ct.campaigns.cards : DEFAULT_CONTENT.campaigns.cards;
        return (
          <>
            <SectionDivider title="Campaign / Mission Section" />
            <Field label="Tag" value={g('campaigns.tag')} onChange={v => update('campaigns.tag', v)} />
            <Field label="H2" value={g('campaigns.h2')} onChange={v => update('campaigns.h2', v)} />
            <Field label="Subtitle" value={g('campaigns.subtitle')} onChange={v => update('campaigns.subtitle', v)} multiline />
            {cards.map((card: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase tracking-wide">Card {i + 1}</p>
                <Field label="Flag / Emoji" value={card.flag || ''} onChange={v => update(`campaigns.cards.${i}.flag`, v)} emoji />
                <Field label="Title" value={card.title || ''} onChange={v => update(`campaigns.cards.${i}.title`, v)} />
                <Field label="Description" value={card.desc || ''} onChange={v => update(`campaigns.cards.${i}.desc`, v)} multiline />
              </div>
            ))}
          </>
        );
      }

      case 'Final CTA':
        return (
          <>
            <SectionDivider title="Final Call to Action" />
            <Field label="H2 Normal" value={g('finalCta.h2Normal')} onChange={v => update('finalCta.h2Normal', v)} />
            <Field label="H2 Accent (orange)" value={g('finalCta.h2Accent')} onChange={v => update('finalCta.h2Accent', v)} />
            <Field label="Subtitle" value={g('finalCta.subtitle')} onChange={v => update('finalCta.subtitle', v)} multiline maxLen={220} />
            <Field label="Primary CTA Button" value={g('finalCta.cta1')} onChange={v => update('finalCta.cta1', v)} />
            <Field label="Secondary CTA Button" value={g('finalCta.cta2')} onChange={v => update('finalCta.cta2', v)} />
            <Field label="Note Text" value={g('finalCta.note')} onChange={v => update('finalCta.note', v)} />
          </>
        );

      case 'Footer':
        return (
          <>
            <SectionDivider title="Footer" />
            <Field label="Logo Subtitle" value={g('footer.sub')} onChange={v => update('footer.sub', v)} />
            <Field label="Tagline" value={g('footer.tagline')} onChange={v => update('footer.tagline', v)} />
            <Field label="Copyright Text" value={g('footer.copyright')} onChange={v => update('footer.copyright', v)} />
          </>
        );

      default:
        return <p className="text-sm text-gray-400">Select a section from the left.</p>;
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Landing Page">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Landing Page Content</h2>
          {dirty && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              ● Unsaved changes
            </span>
          )}
          {loading && (
            <span className="text-xs text-gray-400">Loading...</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewOpen(p => !p)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${previewOpen ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            <PanelRight size={15} /> {previewOpen ? 'Hide Preview' : 'Live Preview'}
          </button>
          <a
            href="http://localhost:3000/landing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={15} /> Open
          </a>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Section sidebar */}
        <div className="w-44 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden sticky top-20">
            {SECTIONS.map(sec => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium border-b border-gray-50 last:border-0 transition-colors ${
                  activeSection === sec
                    ? 'bg-orange-50 text-orange-600 font-semibold border-l-2 border-l-orange-400'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className={`${previewOpen ? 'w-80 flex-shrink-0' : 'flex-1'} bg-white rounded-xl border border-gray-100 p-6 min-w-0 overflow-y-auto`}>
          {renderSection()}
        </div>

        {/* Live preview iframe */}
        {previewOpen && (
          <div className="flex-1 min-w-0 rounded-xl border border-gray-100 overflow-hidden bg-gray-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live Preview (saves reflected here)</span>
              <a href="http://localhost:3000/landing" target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                <ExternalLink size={11} /> Full screen
              </a>
            </div>
            <iframe
              key={iframeKey}
              src="http://localhost:3000/landing"
              className="flex-1 w-full border-0"
              style={{ minHeight: 600 }}
              title="Landing Page Preview"
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
