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
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Intended Store Name</label>
        <input
          type="text"
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 transition-all outline-none text-sm font-medium text-gray-900"
          value={kycStoreName}
          onChange={(e) => setKycStoreName(e.target.value)}
          placeholder="e.g. My Awesome Shop"
        />
      </div>

      <div
        onClick={() => kycStorePhotoRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${kycStorePhoto ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
      >
        {kycStorePhoto ? (
          <div>
            <img src={kycStorePhoto} alt="Storefront" className="w-full h-32 object-cover rounded-lg mb-2" />
            <p className="text-xs text-green-600 font-medium flex items-center justify-center gap-1"><Check size={14} /> Storefront photo uploaded</p>
          </div>
        ) : (
          <div>
            <Store size={24} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">Upload Storefront Photo</p>
            <p className="text-[11px] text-gray-400 mt-1">Clear photo of your shop or office</p>
          </div>
        )}
        <input ref={kycStorePhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'store')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div onClick={() => kycDocRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${kycDocUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
          {kycDocUrl ? (
            <div>
              <img src={kycDocUrl} alt="ID Document" className="w-full h-20 object-cover rounded-lg mb-1 shadow-sm" />
              <p className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1"><Check size={10} /> ID Uploaded</p>
            </div>
          ) : (
            <div><Upload size={20} className="mx-auto text-gray-400 mb-1" /><p className="text-[10px] font-bold text-gray-600">ID Document</p></div>
          )}
          <input ref={kycDocRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'doc')} />
        </div>

        <div onClick={() => kycSelfieRef.current?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${kycSelfieUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
          {kycSelfieUrl ? (
            <div>
              <img src={kycSelfieUrl} alt="Selfie" className="w-full h-20 object-cover rounded-lg mb-1 shadow-sm" />
              <p className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1"><Check size={10} /> Selfie Taken</p>
            </div>
          ) : (
            <div><Camera size={20} className="mx-auto text-gray-400 mb-1" /><p className="text-[10px] font-bold text-gray-600">Your Selfie</p></div>
          )}
          <input ref={kycSelfieRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'selfie')} />
        </div>
      </div>

      {kycUploading && (
        <p className="text-xs text-indigo-500 text-center flex items-center justify-center gap-1">
          <Loader2 size={14} className="animate-spin" /> Uploading...
        </p>
      )}

      <button
        onClick={handleKycSubmit}
        disabled={!kycDocUrl || !kycSelfieUrl || !kycStoreName || !kycStorePhoto || kycSubmitting || kycUploading}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
      >
        {kycSubmitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Shield size={16} /> Submit for Verification</>}
      </button>
    </div>
  );
}
