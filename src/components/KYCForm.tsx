import React, { useState } from 'react';
import { Camera, Building, X, ArrowLeft, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function KYCForm({ onComplete, onLogout, onBack }: { onComplete: () => void, onLogout: () => void, onBack?: () => void }) {
  const [storeName, setStoreName] = useState('');
  const [selfie, setSelfie] = useState<string>('');
  const [storePhoto, setStorePhoto] = useState<string>('');
  const [gstBill, setGstBill] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingField(fieldName);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setter(data.url);
        setErrorMsg('');
      } else {
        setErrorMsg('Upload failed. Please try again.');
      }
    } catch {
      setErrorMsg('Upload failed. Please check your connection.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async () => {
    if (!storeName || !selfie || !storePhoto || !gstBill) {
      setErrorMsg('Please complete all KYC fields before submitting.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      // Submit KYC documents and intended store details
      const kycRes = await apiFetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: gstBill,
          selfieUrl: selfie,
          storeName: storeName,
          storePhoto: storePhoto
        })
      });
      
      if (!kycRes.ok) throw new Error("Failed to submit KYC");
      
      onComplete();
    } catch {
      setErrorMsg('Failed to submit KYC. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <header className="bg-white px-4 py-4 sticky top-0 z-20 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          {onBack && (
            <button onClick={onBack} className="mr-3 text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Set Up Your Store</h1>
        </div>
        <button onClick={onLogout} className="text-sm font-semibold text-gray-500 hover:text-gray-900">
          Log Out
        </button>
      </header>

      <main className="p-4">
        <div className="bg-indigo-50 rounded-xl p-4 mb-4 border border-indigo-100 flex items-start">
          <Building className="mr-3 flex-shrink-0 mt-0.5 text-indigo-600" size={20} />
          <p className="text-sm text-indigo-900 leading-snug font-medium">Please complete this required KYC form to verify your business. All photos must be captured live.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            <div className="space-y-6">
              {/* Store Name */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Business / Store Name</label>
                <input 
                  type="text" 
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Enter your registered business name"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm font-medium text-gray-900"
                />
              </div>

              {/* Selfie (Camera) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Live Selfie Photo</label>
                <p className="text-[11px] text-gray-500 mb-2">Required to verify your identity.</p>
                {selfie ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={selfie} alt="Selfie" className="w-full h-40 object-cover" />
                    <button onClick={() => setSelfie('')} className="absolute top-2 right-2 bg-gray-900 text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors shadow-sm border border-white/20"><X size={14}/></button>
                  </div>
                ) : (
                  <label className="relative border border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors group overflow-hidden">
                    {uploadingField === 'selfie' ? (
                      <Loader2 size={24} className="text-indigo-500 mb-2 animate-spin" />
                    ) : (
                      <>
                        <Camera size={24} className="text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-indigo-700 font-bold">Open Camera</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="user" className="hidden" disabled={!!uploadingField} onChange={(e) => handleFileUpload(e, setSelfie, 'selfie')} />
                  </label>
                )}
              </div>

              {/* Store Photo (Camera) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Live Storefront Photo</label>
                <p className="text-[11px] text-gray-500 mb-2">Take a picture of your store from the outside.</p>
                {storePhoto ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={storePhoto} alt="Store" className="w-full h-40 object-cover" />
                    <button onClick={() => setStorePhoto('')} className="absolute top-2 right-2 bg-gray-900 text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors shadow-sm border border-white/20"><X size={14}/></button>
                  </div>
                ) : (
                  <label className="relative border border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors group overflow-hidden">
                    {uploadingField === 'storePhoto' ? (
                      <Loader2 size={24} className="text-indigo-500 mb-2 animate-spin" />
                    ) : (
                      <>
                        <Camera size={24} className="text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-indigo-700 font-bold">Capture Storefront</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!uploadingField} onChange={(e) => handleFileUpload(e, setStorePhoto, 'storePhoto')} />
                  </label>
                )}
              </div>

              {/* GST or Bill (Camera Only) */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">GST Certificate / Official Bill</label>
                <p className="text-[11px] text-gray-500 mb-2">Capture an official document showing your business name.</p>
                {gstBill ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={gstBill} alt="GST/Bill" className="w-full h-40 object-cover" />
                    <button onClick={() => setGstBill('')} className="absolute top-2 right-2 bg-gray-900 text-white p-1.5 rounded-full hover:bg-gray-800 transition-colors shadow-sm border border-white/20"><X size={14}/></button>
                  </div>
                ) : (
                  <label className="relative border border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors group overflow-hidden">
                    {uploadingField === 'gstBill' ? (
                      <Loader2 size={24} className="text-indigo-500 mb-2 animate-spin" />
                    ) : (
                      <>
                        <Camera size={24} className="text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-indigo-700 font-bold">Scan Document</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!uploadingField} onChange={(e) => handleFileUpload(e, setGstBill, 'gstBill')} />
                  </label>
                )}
              </div>
              
              {/* Error message */}
              {errorMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  <span className="font-semibold flex-shrink-0">⚠</span>
                  <span>{errorMsg}</span>
                  <button type="button" onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading || !storeName || !selfie || !storePhoto || !gstBill}
                  className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center"
                >
                  {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                  {loading ? 'Submitting KYC...' : 'Submit KYC & Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
