import React from 'react';
import { Camera, MapPin, Navigation, Clock, Check, Sparkles } from 'lucide-react';
import StarRating from '../StarRating';
import { CATEGORIES } from '../../constants/categories';
import { apiFetch } from '../../lib/api';
import { Sentry } from '../../lib/sentry-frontend';
import { UploadingOverlay } from '../ui/UploadingOverlay';

interface StoreFormFieldsProps {
  store: any;
  logoUrl: string;
  coverUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  coverFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // Session 128.10
  logoUploading?: boolean;
  coverUploading?: boolean;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  descriptionRef: React.RefObject<HTMLTextAreaElement | null>;
  descriptionValue: string;
  setDescriptionValue: (v: string) => void;
  openAiModal: () => void;
  mapLat: number;
  mapLng: number;
  handleGPSUpdate: () => void;
  postalCode: string;
  setPostalCode: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  cityOptions: string[];
  stateOptions: string[];
  setPincodeLoading: (v: boolean) => void;
  pincodeLoading: boolean;
  setCityOptions: (v: string[]) => void;
  setStateOptions: (v: string[]) => void;
  is24Hours: boolean;
  setIs24Hours: (v: boolean) => void;
  selectedDays: string[];
  toggleDay: (day: string) => void;
  allDays: string[];
  saving: boolean;
}

export function StoreFormFields({
  store, logoUrl, coverUrl, fileInputRef, coverFileInputRef,
  handleLogoUpload, handleCoverUpload, logoUploading = false, coverUploading = false,
  selectedCategory, setSelectedCategory,
  descriptionRef, descriptionValue, setDescriptionValue, openAiModal,
  mapLat, mapLng, handleGPSUpdate,
  postalCode, setPostalCode, city, setCity, state, setState,
  cityOptions, stateOptions, setPincodeLoading, pincodeLoading,
  setCityOptions, setStateOptions,
  is24Hours, setIs24Hours, selectedDays, toggleDay, allDays,
  saving,
}: StoreFormFieldsProps) {
  // Session 125: shared --f-* input surface (replaces the legacy dk-input class).
  const fInput: React.CSSProperties = {
    background: 'var(--f-bg-elev)',
    border: '1px solid var(--f-glass-border-2)',
    color: 'var(--f-text-1)',
  };
  return (
    <>
      {/* Logo upload */}
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="relative">
          <div className="overflow-hidden relative" style={{ width: 88, height: 88, borderRadius: 20, border: '3px solid var(--f-glass-border-2)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', background: 'var(--f-glass-bg-2)' }}>
            <img src={logoUrl || store?.logoUrl || '/uploads/default-logo.png'} alt="Store Logo" className="w-full h-full object-cover" />
            {logoUploading && <UploadingOverlay label="Uploading…" size={26} radius={17} />}
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={logoUploading} className="absolute bottom-0 right-0 p-2 rounded-full" style={{ background: 'var(--f-orange)', border: '2px solid var(--f-bg-deep)', opacity: logoUploading ? 0.6 : 1, cursor: logoUploading ? 'wait' : 'pointer' }}>
            <Camera size={15} color="white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
        </div>
        <p className="mt-2 cursor-pointer font-semibold text-xs" style={{ color: 'var(--f-orange)' }} onClick={() => fileInputRef.current?.click()}>Change Logo</p>
        {store && !store?.hideRatings && typeof store.averageRating === 'number' && (
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--f-glass-bg-2)', border: '0.5px solid var(--f-glass-border)' }}>
            <StarRating rating={store.averageRating || 0} size={13} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--f-text-2)' }}>{store.averageRating.toFixed(1)} ({store.reviewCount || 0})</span>
          </div>
        )}
      </div>

      {/* Cover photo */}
      <div className="mb-5 -mx-5 -mt-0">
        <div className="relative overflow-hidden" style={{ height: 120, background: 'var(--f-glass-bg-2)', borderBottom: '0.5px solid var(--f-glass-border)' }}>
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--f-bg-elev)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--f-text-3)' }}>No cover photo</p>
            </div>
          )}
          {coverUploading && <UploadingOverlay label="Uploading cover…" size={30} radius={0} />}
          <button type="button" onClick={() => coverFileInputRef.current?.click()} disabled={coverUploading} className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)', opacity: coverUploading ? 0.5 : 1, cursor: coverUploading ? 'wait' : 'pointer' }}>
            <Camera size={12} /> {coverUrl ? 'Change Cover' : 'Add Cover Photo'}
          </button>
          <input ref={coverFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
        </div>
      </div>

      {/* Store Name */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Store Name</label>
        <input name="storeName" type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} defaultValue={store?.storeName || ''} required />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Store Category</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput}>
          {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.fullLabel}</option>)}
        </select>
      </div>

      {/* Store Bio */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--f-text-3)' }}>Store Bio</label>
          <button type="button" onClick={openAiModal} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'var(--f-orange)', color: 'white' }}>
            <Sparkles size={11} /> ✨ AI se generate karo
          </button>
        </div>
        <textarea
          ref={descriptionRef}
          name="description"
          className="w-full p-3 rounded-xl outline-none text-sm leading-relaxed"
          style={fInput}
          rows={3}
          defaultValue={store?.description || ''}
          maxLength={350}
          placeholder="Tell customers about your business..."
          required
          onChange={(e) => setDescriptionValue(e.target.value)}
        />
        <span style={{ fontSize: 11, color: descriptionValue.length > 320 ? 'var(--f-danger)' : 'var(--f-text-3)', textAlign: 'right', display: 'block', marginTop: 2 }}>
          {descriptionValue.length}/350
        </span>
      </div>

      {/* Address */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Physical Address</label>
        <input name="address" type="text" className="w-full p-3 rounded-xl transition-all outline-none text-sm" style={fInput} defaultValue={store?.address || ''} required />
      </div>

      {/* Map Location */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Map Location</label>
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid var(--f-glass-border)', background: 'var(--f-glass-bg-2)' }}>
          {mapLat !== 0 && mapLng !== 0 ? (
            <div className="relative">
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${mapLat},${mapLng}&zoom=16&size=600x200&markers=color:red%7C${mapLat},${mapLng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                alt="Store location" className="w-full h-[140px] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="p-3" style={{ background: 'var(--f-glass-bg-2)', borderTop: '0.5px solid var(--f-glass-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--f-text-2)' }}>📍 Coordinates saved</p>
                    <p className="text-[10px]" style={{ color: 'var(--f-text-3)' }}>{mapLat.toFixed(6)}, {mapLng.toFixed(6)}</p>
                  </div>
                  <button type="button" onClick={handleGPSUpdate} className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center" style={{ background: 'var(--b-grad)', boxShadow: '0 0 12px rgba(199,126,0,0.30)' }}>
                    <Navigation size={12} className="mr-1" /> Update Location
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <MapPin size={28} className="mx-auto mb-3" color="var(--f-orange)" />
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--f-text-2)' }}>No location pinned yet</p>
              <p className="text-xs mb-4" style={{ color: 'var(--f-text-3)' }}>Stand at your store and tap the button below to pin your location.</p>
              <button type="button" onClick={handleGPSUpdate} className="text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center mx-auto" style={{ background: 'var(--f-orange)' }}>
                <Navigation size={16} className="mr-2" /> Save My Current Location
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Postal Code */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Postal Code</label>
        <input
          type="number" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput}
          value={postalCode}
          onChange={async (e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPostalCode(val);
            if (val.length === 6) {
              setPincodeLoading(true);
              try {
                const res = await apiFetch(`/api/pincode/${val}`);
                if (res.ok) {
                  const data = await res.json();
                  setCity(data.city || ''); setState(data.state || '');
                  setCityOptions(data.allCities || []); setStateOptions(data.allStates || []);
                }
              } catch (err) {
                // Pincode autofill is a convenience — silent fallback (user can
                // still type city/state manually). Sentry-only for diagnosis.
                Sentry.captureException(err, { extra: { context: 'storeFormFields.pincodeLookup', code: val } });
              }
              setPincodeLoading(false);
            }
          }}
          placeholder="e.g. 400001" maxLength={6}
        />
        {pincodeLoading && <p className="text-xs mt-1 animate-pulse" style={{ color: 'var(--f-orange)' }}>Looking up pincode...</p>}
      </div>

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>City / District</label>
          {cityOptions.length > 0 ? (
            <select className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Select City</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>State</label>
          {stateOptions.length > 0 ? (
            <select className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Select State</option>
              {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} value={state} onChange={(e) => setState(e.target.value)} placeholder="Enter state" />
          )}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Phone Number</label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-xl text-sm font-medium" style={{ background: 'var(--f-glass-bg-2)', border: '0.5px solid var(--f-glass-border)', borderRight: 'none', color: 'var(--f-text-2)' }}>+91</span>
          <input name="phone" type="tel" className="flex-1 p-3 rounded-r-xl outline-none text-sm font-medium" style={fInput} defaultValue={store?.phone?.replace(/^\+91/, '') || ''} placeholder="XXXXX XXXXX" required />
        </div>
        <div className="flex items-center mt-2.5">
          <input type="checkbox" name="phoneVisible" id="phoneVisible" defaultChecked={store?.phoneVisible ?? true} className="w-4 h-4 rounded" style={{ accentColor: 'var(--f-magenta)' }} />
          <label htmlFor="phoneVisible" className="ml-2 text-xs font-medium" style={{ color: 'var(--f-text-2)' }}>Show phone number on public profile</label>
        </div>
      </div>

      {/* GST */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>GST Number <span className="normal-case font-normal ml-1" style={{ color: 'var(--f-text-3)' }}>(Optional)</span></label>
        <input name="gstNumber" type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} defaultValue={store?.gstNumber || ''} placeholder="e.g. 22AAAAA0000A1Z5" />
      </div>

      {/* Store Timing */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--f-text-3)' }}>Store Timing</label>
        <button
          type="button" onClick={() => setIs24Hours(!is24Hours)}
          className="mb-3 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center w-full justify-center"
          style={{ background: is24Hours ? 'var(--f-orange)' : 'var(--f-glass-bg-2)', color: is24Hours ? 'white' : 'var(--f-text-2)', border: '0.5px solid var(--f-glass-border)' }}
        >
          <Clock size={14} className="mr-2" />
          {is24Hours ? '✓ Open 24 Hours' : 'Set as 24 Hours Open'}
        </button>
        {!is24Hours && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--f-text-3)' }}>Opening Time</label>
              <input name="openingTime" type="time" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} defaultValue={store?.openingTime || ''} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: 'var(--f-text-3)' }}>Closing Time</label>
              <input name="closingTime" type="time" className="w-full p-3 rounded-xl outline-none text-sm font-medium" style={fInput} defaultValue={store?.closingTime || ''} />
            </div>
          </div>
        )}
      </div>

      {/* Working Days */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--f-text-3)' }}>Working Days</label>
        <div className="flex flex-wrap gap-2">
          {allDays.map(day => (
            <button
              key={day} type="button" onClick={() => toggleDay(day)}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{ background: selectedDays.includes(day) ? 'var(--f-orange)' : 'var(--f-glass-bg-2)', color: selectedDays.includes(day) ? 'white' : 'var(--f-text-2)', border: '0.5px solid var(--f-glass-border)' }}
            >
              {selectedDays.includes(day) && <Check size={10} className="inline mr-1" />}
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl font-bold tracking-wide disabled:opacity-50" style={{ background: 'var(--b-grad)', color: 'white', boxShadow: '0 0 16px rgba(199,126,0,0.35)' }}>
          {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </div>
    </>
  );
}
