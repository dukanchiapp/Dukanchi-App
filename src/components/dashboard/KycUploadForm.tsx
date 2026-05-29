import React from 'react';
import { Camera, Check, Upload, Shield, Store, Loader2 } from 'lucide-react';

interface KycUploadFormProps {
  kycDocUrl: string;
  kycSelfieUrl: string;
  kycStoreName: string;
  kycStorePhoto: string;
  kycDocRef: React.RefObject<HTMLInputElement | null>;
  kycSelfieRef: React.RefObject<HTMLInputElement | null>;
  kycStorePhotoRef: React.RefObject<HTMLInputElement | null>;
  kycUploading: boolean;
  kycSubmitting: boolean;
  handleKycUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie' | 'store') => void;
  handleKycSubmit: () => void;
  setKycStoreName: (val: string) => void;
}

export function KycUploadForm({
  kycDocUrl, kycSelfieUrl, kycStoreName, kycStorePhoto,
  kycDocRef, kycSelfieRef, kycStorePhotoRef,
  kycUploading, kycSubmitting,
  handleKycUpload, handleKycSubmit, setKycStoreName,
}: KycUploadFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Intended Store Name</label>
        <input
          type="text"
          className="w-full p-3 rounded-xl transition-all outline-none text-sm font-medium"
          style={{ background: 'var(--f-bg-elev)', border: '1px solid var(--f-glass-border-2)', color: 'var(--f-text-1)' }}
          value={kycStoreName}
          onChange={(e) => setKycStoreName(e.target.value)}
          placeholder="e.g. My Awesome Shop"
        />
      </div>

      <div
        onClick={() => kycStorePhotoRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors"
        style={kycStorePhoto
          ? { borderColor: 'var(--f-success)', background: 'rgba(46,231,161,0.10)' }
          : { borderColor: 'var(--f-glass-border-2)', background: 'var(--f-glass-bg)' }}
      >
        {kycStorePhoto ? (
          <div>
            <img src={kycStorePhoto} alt="Storefront" className="w-full h-32 object-cover rounded-lg mb-2" />
            <p className="text-xs font-medium flex items-center justify-center gap-1" style={{ color: 'var(--f-success)' }}><Check size={14} /> Storefront photo uploaded</p>
          </div>
        ) : (
          <div>
            <Store size={24} className="mx-auto mb-2" color="var(--f-text-3)" />
            <p className="text-sm font-medium" style={{ color: 'var(--f-text-1)' }}>Upload Storefront Photo</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--f-text-3)' }}>Clear photo of your shop or office</p>
          </div>
        )}
        <input ref={kycStorePhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'store')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div onClick={() => kycDocRef.current?.click()} className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors" style={kycDocUrl ? { borderColor: 'var(--f-success)', background: 'rgba(46,231,161,0.10)' } : { borderColor: 'var(--f-glass-border-2)', background: 'var(--f-glass-bg)' }}>
          {kycDocUrl ? (
            <div>
              <img src={kycDocUrl} alt="ID Document" className="w-full h-20 object-cover rounded-lg mb-1" />
              <p className="text-[10px] font-bold flex items-center justify-center gap-1" style={{ color: 'var(--f-success)' }}><Check size={10} /> ID Uploaded</p>
            </div>
          ) : (
            <div><Upload size={20} className="mx-auto mb-1" color="var(--f-text-3)" /><p className="text-[10px] font-bold" style={{ color: 'var(--f-text-2)' }}>ID Document</p></div>
          )}
          <input ref={kycDocRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'doc')} />
        </div>

        <div onClick={() => kycSelfieRef.current?.click()} className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors" style={kycSelfieUrl ? { borderColor: 'var(--f-success)', background: 'rgba(46,231,161,0.10)' } : { borderColor: 'var(--f-glass-border-2)', background: 'var(--f-glass-bg)' }}>
          {kycSelfieUrl ? (
            <div>
              <img src={kycSelfieUrl} alt="Selfie" className="w-full h-20 object-cover rounded-lg mb-1" />
              <p className="text-[10px] font-bold flex items-center justify-center gap-1" style={{ color: 'var(--f-success)' }}><Check size={10} /> Selfie Taken</p>
            </div>
          ) : (
            <div><Camera size={20} className="mx-auto mb-1" color="var(--f-text-3)" /><p className="text-[10px] font-bold" style={{ color: 'var(--f-text-2)' }}>Your Selfie</p></div>
          )}
          <input ref={kycSelfieRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'selfie')} />
        </div>
      </div>

      {kycUploading && (
        <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: 'var(--f-magenta-light)' }}>
          <Loader2 size={14} className="animate-spin" /> Uploading...
        </p>
      )}

      <button
        onClick={handleKycSubmit}
        disabled={!kycDocUrl || !kycSelfieUrl || !kycStoreName || !kycStorePhoto || kycSubmitting || kycUploading}
        className="w-full py-3 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        style={{ background: 'var(--f-grad-primary)', boxShadow: '0 0 16px rgba(255,42,140,0.35)' }}
      >
        {kycSubmitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Shield size={16} /> Submit for Verification</>}
      </button>
    </div>
  );
}
