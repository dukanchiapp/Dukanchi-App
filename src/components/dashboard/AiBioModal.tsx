import { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';
import { Sentry } from '../../lib/sentry-frontend';

interface AiBioModalProps {
  open: boolean;
  onClose: () => void;
  storeName: string;
  selectedCategory: string;
  onBioApply: (bio: string) => void;
}

export function AiBioModal({ open, onClose, storeName, selectedCategory, onBioApply }: AiBioModalProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<'input' | 'result'>('input');
  const [userContext, setUserContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ bio: string; tagline: string } | null>(null);

  const handleClose = () => {
    setStep('input'); setResult(null); setUserContext('');
    onClose();
  };

  const handleGenerate = async () => {
    if (!storeName) { showToast('Pehle store name bharo', { type: 'warning' }); onClose(); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/api/ai/generate-store-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, category: selectedCategory, userContext: userContext.trim() }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (!data.bio?.trim()) { showToast('AI se generate nahi hua, dobara try karo', { type: 'error' }); return; }
      setResult(data);
      setStep('result');
    } catch (err) {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'aiBioModal.generateBio' } });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-[380px] rounded-2xl p-6" style={{ background: 'var(--f-modal-bg)', border: '1px solid var(--f-glass-border-2)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', boxShadow: '0 16px 48px rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--f-orange)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--f-orange)' }}>AI Store Description</h3>
          </div>
          <button type="button" onClick={handleClose} className="p-1">
            <X size={18} style={{ color: 'var(--f-text-3)' }} />
          </button>
        </div>
        <p className="mb-4 text-xs" style={{ color: 'var(--f-text-3)', lineHeight: 1.5 }}>
          Apni dukaan ke baare mein likho — AI perfect bio banayega
        </p>

        {step === 'input' ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                className="w-full p-3 rounded-xl outline-none text-sm"
                style={{ background: 'var(--f-bg-elev)', border: '1px solid var(--f-glass-border-2)', color: 'var(--f-text-1)' }}
                rows={4}
                placeholder="e.g. meri electronics shop hai, mobiles aur accessories bechta hu, 10 saal ka experience hai..."
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'var(--b-grad)', color: 'white', boxShadow: 'var(--b-elev-card)' }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> AI soch raha hai...</> : <><Sparkles size={14} /> ✨ Generate karo</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {result?.bio && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--f-bg-elev)', border: '0.5px solid var(--f-glass-border)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--f-text-3)' }}>Bio</p>
                <p className="text-sm mb-3" style={{ color: 'var(--f-text-1)', lineHeight: 1.55 }}>{result.bio}</p>
                <button
                  type="button"
                  onClick={() => { onBioApply(result!.bio); handleClose(); }}
                  className="w-full py-2 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--b-grad)', color: 'white', boxShadow: 'var(--b-elev-card)' }}
                >
                  Bio use karo
                </button>
              </div>
            )}
            {result?.tagline && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--f-bg-elev)', border: '0.5px solid var(--f-glass-border)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--f-text-3)' }}>Tagline</p>
                <p className="text-sm mb-3 font-medium" style={{ color: 'var(--f-text-1)', fontStyle: 'italic' }}>"{result.tagline}"</p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(result!.tagline).catch(() => {}); showToast('Tagline copied!', { type: 'success' }); }}
                  className="w-full py-2 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--f-glass-bg-2)', border: '0.5px solid var(--f-glass-border)', color: 'var(--f-text-1)' }}
                >
                  Tagline copy karo
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setStep('input'); setResult(null); }}
              className="w-full text-center text-xs font-semibold pt-1"
              style={{ color: 'var(--f-text-3)' }}
            >
              ← Wapas (dobara generate karo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
