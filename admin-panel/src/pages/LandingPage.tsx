import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Save, ExternalLink, Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { useToast } from '../context/ToastContext';

const SECTIONS = ['Nav', 'Hero', 'Problem', 'Hook Cards', 'Features', 'How It Works', 'Illustration', 'Campaigns', 'Final CTA', 'Footer'] as const;
type Section = typeof SECTIONS[number];

const Field = ({ label, value, onChange, multiline = false, maxLen, emoji = false }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; maxLen?: number; emoji?: boolean;
}) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {maxLen && <span className="text-xs text-gray-400">{value.length}/{maxLen}</span>}
    </div>
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={maxLen}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        maxLength={emoji ? 4 : maxLen}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
      />
    )}
  </div>
);

const ListField = ({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <button onClick={() => onChange([...items, ''])} className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-700">
        <Plus size={12} /> Add
      </button>
    </div>
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={item}
            onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  </div>
);

const SectionDivider = ({ title }: { title: string }) => (
  <div className="mb-4 pb-2 border-b border-gray-100">
    <h3 className="text-sm font-bold text-gray-700">{title}</h3>
  </div>
);

export default function LandingPageCMS() {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('Hero');
  const { showToast } = useToast();

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/landing-content');
      setContent(res.data.content);
    } catch {
      showToast('Failed to load content', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContent(); }, [fetchContent]);

  const update = (path: string, value: any) => {
    setContent((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/landing-content', { content });
      setDirty(false);
      showToast('Content saved! Landing page updated.', { type: 'success' });
    } catch {
      showToast('Save failed, try again', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const g = (path: string): string => {
    const keys = path.split('.');
    let cur = content;
    for (const k of keys) cur = cur?.[k];
    return String(cur ?? '');
  };

  const ga = (path: string): string[] => {
    const keys = path.split('.');
    let cur = content;
    for (const k of keys) cur = cur?.[k];
    return Array.isArray(cur) ? cur : [];
  };

  if (loading) return (
    <AdminLayout title="Landing Page">
      <div className="flex items-center justify-center h-64 text-gray-400">Loading content...</div>
    </AdminLayout>
  );

  const renderSection = () => {
    if (!content) return null;

    switch (activeSection) {
      case 'Nav':
        return (
          <>
            <SectionDivider title="Navigation Bar" />
            <Field label="Logo subtitle" value={g('nav.logoSub')} onChange={v => update('nav.logoSub', v)} />
            <Field label="CTA Button Text" value={g('nav.ctaText')} onChange={v => update('nav.ctaText', v)} />
          </>
        );

      case 'Hero':
        return (
          <>
            <SectionDivider title="Hero Section" />
            <Field label="Badge text" value={g('hero.badge')} onChange={v => update('hero.badge', v)} maxLen={60} />
            <Field label="H1 Line 1" value={g('hero.h1Line1')} onChange={v => update('hero.h1Line1', v)} />
            <Field label="H1 Accent (orange)" value={g('hero.h1Accent')} onChange={v => update('hero.h1Accent', v)} />
            <Field label="H1 Line 2" value={g('hero.h1Line2')} onChange={v => update('hero.h1Line2', v)} />
            <Field label="Subtitle" value={g('hero.subtitle')} onChange={v => update('hero.subtitle', v)} multiline maxLen={200} />
            <Field label="Hook Accent 1 (orange)" value={g('hero.hookAccent1')} onChange={v => update('hero.hookAccent1', v)} />
            <Field label="Hook Accent 2 (orange)" value={g('hero.hookAccent2')} onChange={v => update('hero.hookAccent2', v)} />
            <Field label="Primary CTA button" value={g('hero.cta1')} onChange={v => update('hero.cta1', v)} />
            <Field label="Secondary CTA button" value={g('hero.cta2')} onChange={v => update('hero.cta2', v)} />
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
            <SectionDivider title="Bad Column (Quick Commerce)" />
            <Field label="Column title" value={g('problem.badCol.title')} onChange={v => update('problem.badCol.title', v)} />
            <ListField label="Bullet points" items={ga('problem.badCol.items')} onChange={v => update('problem.badCol.items', v)} />
            <Field label="Price" value={g('problem.badCol.price')} onChange={v => update('problem.badCol.price', v)} />
            <Field label="Price sub-text" value={g('problem.badCol.priceSub')} onChange={v => update('problem.badCol.priceSub', v)} />
            <SectionDivider title="Good Column (Dukanchi)" />
            <Field label="Column title" value={g('problem.goodCol.title')} onChange={v => update('problem.goodCol.title', v)} />
            <ListField label="Bullet points" items={ga('problem.goodCol.items')} onChange={v => update('problem.goodCol.items', v)} />
            <Field label="Price" value={g('problem.goodCol.price')} onChange={v => update('problem.goodCol.price', v)} />
            <Field label="Price sub-text" value={g('problem.goodCol.priceSub')} onChange={v => update('problem.goodCol.priceSub', v)} />
          </>
        );

      case 'Hook Cards': {
        const hooks: any[] = content.hooks || [];
        return (
          <>
            <SectionDivider title="Hook Story Cards" />
            {hooks.map((hook: any, i: number) => (
              <div key={i} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase">Hook {i + 1}</p>
                <Field label="Emoji" value={hook.emoji || ''} onChange={v => update(`hooks.${i}.emoji`, v)} emoji />
                <Field label="Title" value={hook.title || ''} onChange={v => update(`hooks.${i}.title`, v)} />
                <Field label="Paragraph 1" value={hook.para1 || ''} onChange={v => update(`hooks.${i}.para1`, v)} multiline />
                <Field label="Paragraph 2" value={hook.para2 || ''} onChange={v => update(`hooks.${i}.para2`, v)} multiline />
                <Field label="Stat / highlight" value={hook.stat || ''} onChange={v => update(`hooks.${i}.stat`, v)} />
              </div>
            ))}
          </>
        );
      }

      case 'Features': {
        const items: any[] = content.features?.items || [];
        return (
          <>
            <SectionDivider title="Features Section" />
            <Field label="Tag" value={g('features.tag')} onChange={v => update('features.tag', v)} />
            <Field label="H2" value={g('features.h2')} onChange={v => update('features.h2', v)} />
            <Field label="Subtitle" value={g('features.subtitle')} onChange={v => update('features.subtitle', v)} multiline />
            {items.map((item: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase">Feature {i + 1}</p>
                <Field label="Icon (emoji)" value={item.icon || ''} onChange={v => update(`features.items.${i}.icon`, v)} emoji />
                <Field label="Title" value={item.title || ''} onChange={v => update(`features.items.${i}.title`, v)} />
                <Field label="Description" value={item.desc || ''} onChange={v => update(`features.items.${i}.desc`, v)} multiline />
              </div>
            ))}
          </>
        );
      }

      case 'How It Works': {
        const steps: any[] = content.howItWorks?.steps || [];
        return (
          <>
            <SectionDivider title="How It Works Section" />
            <Field label="Tag" value={g('howItWorks.tag')} onChange={v => update('howItWorks.tag', v)} />
            <Field label="H2" value={g('howItWorks.h2')} onChange={v => update('howItWorks.h2', v)} />
            <Field label="Subtitle" value={g('howItWorks.subtitle')} onChange={v => update('howItWorks.subtitle', v)} multiline />
            {steps.map((step: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase">Step {i + 1}</p>
                <Field label="Step number" value={step.num || ''} onChange={v => update(`howItWorks.steps.${i}.num`, v)} />
                <Field label="Title" value={step.title || ''} onChange={v => update(`howItWorks.steps.${i}.title`, v)} />
                <Field label="Description" value={step.desc || ''} onChange={v => update(`howItWorks.steps.${i}.desc`, v)} multiline />
                <Field label="Tag badge" value={step.tag || ''} onChange={v => update(`howItWorks.steps.${i}.tag`, v)} />
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
            <Field label="Chat bubble 1 (user)" value={g('illustration.chatBubble1')} onChange={v => update('illustration.chatBubble1', v)} />
            <Field label="Chat bubble 2 (store, orange)" value={g('illustration.chatBubble2')} onChange={v => update('illustration.chatBubble2', v)} />
          </>
        );

      case 'Campaigns': {
        const cards: any[] = content.campaigns?.cards || [];
        return (
          <>
            <SectionDivider title="Campaign / Mission Section" />
            <Field label="Tag" value={g('campaigns.tag')} onChange={v => update('campaigns.tag', v)} />
            <Field label="H2" value={g('campaigns.h2')} onChange={v => update('campaigns.h2', v)} />
            <Field label="Subtitle" value={g('campaigns.subtitle')} onChange={v => update('campaigns.subtitle', v)} multiline />
            {cards.map((card: any, i: number) => (
              <div key={i} className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-orange-500 mb-3 uppercase">Card {i + 1}</p>
                <Field label="Flag / emoji" value={card.flag || ''} onChange={v => update(`campaigns.cards.${i}.flag`, v)} emoji />
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
            <Field label="Subtitle" value={g('finalCta.subtitle')} onChange={v => update('finalCta.subtitle', v)} multiline maxLen={200} />
            <Field label="Primary CTA" value={g('finalCta.cta1')} onChange={v => update('finalCta.cta1', v)} />
            <Field label="Secondary CTA" value={g('finalCta.cta2')} onChange={v => update('finalCta.cta2', v)} />
            <Field label="Note text" value={g('finalCta.note')} onChange={v => update('finalCta.note', v)} />
          </>
        );

      case 'Footer':
        return (
          <>
            <SectionDivider title="Footer" />
            <Field label="Logo subtitle" value={g('footer.sub')} onChange={v => update('footer.sub', v)} />
            <Field label="Tagline" value={g('footer.tagline')} onChange={v => update('footer.tagline', v)} />
            <Field label="Copyright text" value={g('footer.copyright')} onChange={v => update('footer.copyright', v)} />
          </>
        );

      default:
        return null;
    }
  };

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
        </div>
        <div className="flex gap-2">
          <a
            href="http://localhost:3000/landing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={15} /> Preview
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
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
                    ? 'bg-orange-50 text-orange-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 min-w-0">
          {renderSection()}
        </div>
      </div>
    </AdminLayout>
  );
}
