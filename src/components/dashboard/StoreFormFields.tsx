import React from 'react';
import { Camera, MapPin, Navigation, Clock, Check, Sparkles } from 'lucide-react';
import StarRating from '../StarRating';
import { CATEGORIES } from '../../constants/categories';
import { apiFetch } from '../../lib/api';

interface StoreFormFieldsProps {
  store: any;
  logoUrl: string;
  coverUrl: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  coverFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  handleLogoUpload, handleCoverUpload,
  selectedCategory, setSelectedCategory,
  descriptionRef, descriptionValue, setDescriptionValue, openAiModal,
  mapLat, mapLng, handleGPSUpdate,
  postalCode, setPostalCode, city, setCity, state, setState,
  cityOptions, stateOptions, setPincodeLoading, pincodeLoading,
  setCityOptions, setStateOptions,
  is24Hours, setIs24Hours, selectedDays, toggleDay, allDays,
  saving,
}: StoreFormFieldsProps) {
  return (
    <>
      {/* Logo upload */}
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="relative">
          <div className="overflow-hidden" style={{ width: 88, height: 88, borderRadius: 20, border: '3px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', background: 'var(--dk-surface)' }}>
            <img src={logoUrl || store?.logoUrl || '/uploads/default-logo.png'} alt="Store Logo" className="w-full h-full object-cover" />
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 rounded-full" style={{ background: 'var(--dk-accent)', border: '2px solid white' }}>
            <Camera size={15} color="white" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        <p className="mt-2 cursor-pointer font-semibold text-xs" style={{ color: 'var(--dk-accent)' }} onClick={() => fileInputRef.current?.click()}>Change Logo</p>
        {store && !store?.hideRatings && typeof store.averageRating === 'number' && (
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)' }}>
            <StarRating rating={store.averageRating || 0} size={13} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{store.averageRating.toFixed(1)} ({store.reviewCount || 0})</span>
          </div>
        )}
      </div>

      {/* Cover photo */}
      <div className="mb-5 -mx-5 -mt-0">
        <div className="relative overflow-hidden" style={{ height: 120, background: 'var(--dk-surface)', borderBottom: '0.5px solid var(--dk-border)' }}>
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--dk-text-tertiary)' }}>No cover photo</p>
            </div>
          )}
          <button type="button" onClick={() => coverFileInputRef.current?.click()} className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}>
            <Camera size={12} /> {coverUrl ? 'Change Cover' : 'Add Cover Photo'}
          </button>
          <input ref={coverFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        </div>
      </div>

      {/* Store Name */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Name</label>
        <input name="storeName" type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" defaultValue={store?.storeName || ''} required />
      </div>

      {/* Category */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Category</label>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input">
          {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.fullLabel}</option>)}
        </select>
      </div>

      {/* Store Bio */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dk-text-tertiary)' }}>Store Bio</label>
          <button type="button" onClick={openAiModal} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'var(--dk-accent)', color: 'white' }}>
            <Sparkles size={11} /> ✨ AI se generate karo
          </button>
        </div>
        <textarea
          ref={descriptionRef}
          name="description"
          className="w-full p-3 rounded-xl outline-none text-sm leading-relaxed dk-input"
          rows={3}
          defaultValue={store?.description || ''}
          maxLength={350}
          placeholder="Tell customers about your business..."
          required
          onChange={(e) => setDescriptionValue(e.target.value)}
        />
        <span style={{ fontSize: 11, color: descriptionValue.length > 320 ? '#EF4444' : '#888', textAlign: 'right', display: 'block', marginTop: 2 }}>
          {descriptionValue.length}/350
        </span>
      </div>

      {/* Address */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Physical Address</label>
        <input name="address" type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm text-gray-900" defaultValue={store?.address || ''} required />
      </div>

      {/* Map Location */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Map Location</label>
        <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid var(--dk-border)', background: 'var(--dk-surface)' }}>
          {mapLat !== 0 && mapLng !== 0 ? (
            <div className="relative">
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${mapLat},${mapLng}&zoom=16&size=600x200&markers=color:red%7C${mapLat},${mapLng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                alt="Store location" className="w-full h-[140px] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="p-3" style={{ background: 'var(--dk-surface)', borderTop: '0.5px solid var(--dk-border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600 font-medium">📍 Coordinates saved</p>
                    <p className="text-[10px] text-gray-400">{mapLat.toFixed(6)}, {mapLng.toFixed(6)}</p>
                  </div>
                  <button type="button" onClick={handleGPSUpdate} className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center dk-update-btn">
                    <Navigation size={12} className="mr-1" /> Update Location
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <MapPin size={28} className="mx-auto text-indigo-400 mb-3" />
              <p className="text-sm text-gray-600 font-medium mb-1">No location pinned yet</p>
              <p className="text-xs text-gray-400 mb-4">Stand at your store and tap the button below to pin your location.</p>
              <button type="button" onClick={handleGPSUpdate} className="text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center mx-auto" style={{ background: 'var(--dk-accent)' }}>
                <Navigation size={16} className="mr-2" /> Save My Current Location
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Postal Code */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Postal Code</label>
        <input
          type="number" className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
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
              } catch { /* silent */ }
              setPincodeLoading(false);
            }
          }}
          placeholder="e.g. 400001" maxLength={6}
        />
        {pincodeLoading && <p className="text-xs mt-1 animate-pulse" style={{ color: 'var(--dk-accent)' }}>Looking up pincode...</p>}
      </div>

      {/* City + State */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>City / District</label>
          {cityOptions.length > 0 ? (
            <select className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Select City</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter city" />
          )}
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>State</label>
          {stateOptions.length > 0 ? (
            <select className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Select State</option>
              {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" value={state} onChange={(e) => setState(e.target.value)} placeholder="Enter state" />
          )}
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Phone Number</label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-xl text-sm font-medium" style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', borderRight: 'none', color: 'var(--dk-text-secondary)' }}>+91</span>
          <input name="phone" type="tel" className="flex-1 p-3 rounded-r-xl outline-none text-sm font-medium dk-input" defaultValue={store?.phone?.replace(/^\+91/, '') || ''} placeholder="XXXXX XXXXX" required />
        </div>
        <div className="flex items-center mt-2.5">
          <input type="checkbox" name="phoneVisible" id="phoneVisible" defaultChecked={store?.phoneVisible ?? true} className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded" />
          <label htmlFor="phoneVisible" className="ml-2 text-xs text-gray-600 font-medium">Show phone number on public profile</label>
        </div>
      </div>

      {/* GST */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>GST Number <span className="text-gray-400 normal-case font-normal ml-1">(Optional)</span></label>
        <input name="gstNumber" type="text" className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input" defaultValue={store?.gstNumber || ''} placeholder="e.g. 22AAAAA0000A1Z5" />
      </div>

      {/* Store Timing */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Timing</label>
        <button
          type="button" onClick={() => setIs24Hours(!is24Hours)}
          className="mb-3 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center w-full justify-center"
          style={{ background: is24Hours ? 'var(--dk-accent)' : 'var(--dk-surface)', color: is24Hours ? 'white' : 'var(--dk-text-secondary)', border: '0.5px solid var(--dk-border)' }}
        >
          <Clock size={14} className="mr-2" />
          {is24Hours ? '✓ Open 24 Hours' : 'Set as 24 Hours Open'}
        </button>
        {!is24Hours && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Opening Time</label>
              <input name="openingTime" type="time" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-sm text-gray-900 font-medium" defaultValue={store?.openingTime || ''} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Closing Time</label>
              <input name="closingTime" type="time" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-sm text-gray-900 font-medium" defaultValue={store?.closingTime || ''} />
            </div>
          </div>
        )}
      </div>

      {/* Working Days */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Working Days</label>
        <div className="flex flex-wrap gap-2">
          {allDays.map(day => (
            <button
              key={day} type="button" onClick={() => toggleDay(day)}
              className="px-3.5 py-2 rounded-lg text-xs font-bold"
              style={{ background: selectedDays.includes(day) ? 'var(--dk-accent)' : 'var(--dk-surface)', color: selectedDays.includes(day) ? 'white' : 'var(--dk-text-secondary)', border: '0.5px solid var(--dk-border)' }}
            >
              {selectedDays.includes(day) && <Check size={10} className="inline mr-1" />}
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl font-bold tracking-wide disabled:opacity-50" style={{ background: '#1A1A1A', color: 'white' }}>
          {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </div>
    </>
  );
}
