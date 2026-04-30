import { useState, useRef } from 'react';
import { Sparkles, X, Loader2, Mic, MicOff } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleClose = () => {
    setStep('input'); setResult(null); setUserContext('');
    setIsRecording(false); setRecordingSeconds(0);
    onClose();
  };

  const handleGenerate = async () => {
    if (!storeName) { showToast('Pehle store name bharo', { type: 'warning' }); onClose(); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/generate-store-description', {
        credentials: 'include', method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName, category: selectedCategory, userContext: userContext.trim() }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      if (!data.bio?.trim()) { showToast('AI se generate nahi hua, dobara try karo', { type: 'error' }); return; }
      setResult(data);
      setStep('result');
    } catch {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0); setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setLoading(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          const res = await fetch('/api/ai/transcribe-voice', {
            credentials: 'include', method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64, mimeType: 'audio/webm' }),
          });
          if (res.ok) {
            const data = await res.json();
            const transcript = [data.productName, data.caption].filter(Boolean).join(' — ');
            if (transcript) setUserContext(prev => prev ? `${prev} ${transcript}` : transcript);
          } else {
            showToast('Voice transcription failed, manually likho', { type: 'error' });
          }
        } catch {
          showToast('AI abhi available nahi, manually bharo', { type: 'error' });
        } finally {
          setLoading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true); setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      showToast('Microphone access nahi mila', { type: 'error' });
    }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-[380px] rounded-2xl p-6 shadow-xl" style={{ background: 'white' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--dk-accent)' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-accent)' }}>AI Store Description</h3>
          </div>
          <button type="button" onClick={handleClose} className="p-1">
            <X size={18} style={{ color: 'var(--dk-text-tertiary)' }} />
          </button>
        </div>
        <p className="mb-4 text-xs" style={{ color: 'var(--dk-text-tertiary)', lineHeight: 1.5 }}>
          Apni dukaan ke baare mein kuch bolo ya likho — AI perfect bio banayega
        </p>

        {step === 'input' ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                className="w-full p-3 pb-10 rounded-xl outline-none text-sm dk-input"
                rows={4}
                placeholder="e.g. meri electronics shop hai, mobiles aur accessories bechta hu, 10 saal ka experience hai..."
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
              />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                className="absolute bottom-2 right-2 flex items-center justify-center rounded-full disabled:opacity-50"
                style={{ width: 32, height: 32, background: isRecording ? '#EF4444' : 'var(--dk-accent)' }}
              >
                {isRecording ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
              </button>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444', flexShrink: 0 }} />
                <p className="text-xs" style={{ color: 'var(--dk-text-tertiary)' }}>Recording... {recordingSeconds}s — ruk ne ke liye mic dabao</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || isRecording}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'var(--dk-accent)', color: 'white' }}
            >
              {loading ? <><Loader2 size={15} className="animate-spin" /> AI soch raha hai...</> : <><Sparkles size={14} /> ✨ Generate karo</>}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {result?.bio && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dk-text-tertiary)' }}>Bio</p>
                <p className="text-sm mb-3" style={{ color: 'var(--dk-text-primary)', lineHeight: 1.55 }}>{result.bio}</p>
                <button
                  type="button"
                  onClick={() => { onBioApply(result!.bio); handleClose(); }}
                  className="w-full py-2 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--dk-accent)', color: 'white' }}
                >
                  Bio use karo
                </button>
              </div>
            )}
            {result?.tagline && (
              <div className="p-3 rounded-xl" style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dk-text-tertiary)' }}>Tagline</p>
                <p className="text-sm mb-3 font-medium" style={{ color: 'var(--dk-text-primary)', fontStyle: 'italic' }}>"{result.tagline}"</p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(result!.tagline).catch(() => {}); showToast('Tagline copied!', { type: 'success' }); }}
                  className="w-full py-2 rounded-xl font-bold text-sm"
                  style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                >
                  Tagline copy karo
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setStep('input'); setResult(null); }}
              className="w-full text-center text-xs font-semibold pt-1"
              style={{ color: 'var(--dk-text-tertiary)' }}
            >
              ← Wapas (dobara generate karo)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
