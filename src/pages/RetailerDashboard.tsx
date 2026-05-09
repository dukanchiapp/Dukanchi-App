import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock, AlertTriangle, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AiBioModal } from '../components/dashboard/AiBioModal';
import { StoreFormFields } from '../components/dashboard/StoreFormFields';
import { KycUploadForm } from '../components/dashboard/KycUploadForm';
import { apiFetch } from '../lib/api';

export default function RetailerDashboard() {
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showToast, showConfirm } = useToast();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<string>('');
  const [store, setStore] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [mapLat, setMapLat] = useState<number>(0);
  const [mapLng, setMapLng] = useState<number>(0);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('General');
  const [is24Hours, setIs24Hours] = useState(false);
  const [postalCode, setPostalCode] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [kycStatus, setKycStatus] = useState<string>('none');
  const [kycNotes, setKycNotes] = useState<string>('');
  const [kycDocUrl, setKycDocUrl] = useState<string>('');
  const [kycSelfieUrl, setKycSelfieUrl] = useState<string>('');
  const [kycStoreName, setKycStoreName] = useState<string>('');
  const [kycStorePhoto, setKycStorePhoto] = useState<string>('');
  const [kycUploading, setKycUploading] = useState(false);
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const kycDocRef = useRef<HTMLInputElement>(null);
  const kycSelfieRef = useRef<HTMLInputElement>(null);
  const kycStorePhotoRef = useRef<HTMLInputElement>(null);
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id && user?.role !== 'customer' && user?.role !== 'admin') {
      apiFetch('/api/kyc/status')
        .then(res => res.json())
        .then(data => { setKycStatus(data.kycStatus || 'none'); setKycNotes(data.kycNotes || ''); })
        .catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      apiFetch(`/api/users/${user.id}/store`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setStoreId(data.id); setStore(data);
            setDescriptionValue(data.description || '');
            setMapLat(data.latitude || 0); setMapLng(data.longitude || 0);
            setSelectedCategory(data.category || 'General');
            setIs24Hours(data.is24Hours || false);
            setLogoUrl(data.logoUrl || ''); setCoverUrl(data.coverUrl || '');
            setPostalCode(data.postalCode ? String(data.postalCode) : '');
            setCity(data.city || ''); setState(data.state || '');
            if (data.workingDays) setSelectedDays(data.workingDays.split(', ').filter(Boolean));
            setLoading(false);
          } else {
            apiFetch('/api/kyc/status')
              .then(res => res.json())
              .then(kycData => {
                if (kycData.kycStoreName || kycData.kycStorePhoto) {
                  setStore({ storeName: kycData.kycStoreName || '' });
                  if (kycData.kycStorePhoto) setLogoUrl(kycData.kycStorePhoto);
                }
                setLoading(false);
              })
              .catch(() => setLoading(false));
          }
        })
        .catch(err => { console.error(err); setLoading(false); });
    }
  }, [user]);

  const toggleDay = (day: string) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const handleSaveStoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const form = e.target as HTMLFormElement;
    const storeName = (form.elements.namedItem('storeName') as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    const address = (form.elements.namedItem('address') as HTMLInputElement).value.trim();
    const openingTime = is24Hours ? '' : (form.elements.namedItem('openingTime') as HTMLInputElement)?.value || '';
    const closingTime = is24Hours ? '' : (form.elements.namedItem('closingTime') as HTMLInputElement)?.value || '';
    const phoneRaw = (form.elements.namedItem('phone') as HTMLInputElement).value.trim();
    const phone = phoneRaw.startsWith('+91') ? phoneRaw : `+91${phoneRaw}`;
    const gstNumber = (form.elements.namedItem('gstNumber') as HTMLInputElement).value.trim();
    const phoneVisible = (form.elements.namedItem('phoneVisible') as HTMLInputElement).checked;
    const workingDays = selectedDays.join(', ');

    if (!storeName) { showToast('Store name is required.', { type: 'error' }); setSaving(false); return; }
    if (!description) { showToast('Store bio / description is required.', { type: 'error' }); setSaving(false); return; }
    if (!address) { showToast('Address is required.', { type: 'error' }); setSaving(false); return; }
    if (mapLat === 0 && mapLng === 0) { showToast('Please save your map location.', { type: 'error' }); setSaving(false); return; }
    if (!phoneRaw) { showToast('Phone number is required.', { type: 'error' }); setSaving(false); return; }
    if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''))) { showToast('Phone number format is invalid.', { type: 'error' }); setSaving(false); return; }
    if (selectedDays.length === 0) { showToast('Please select your working days.', { type: 'error' }); setSaving(false); return; }
    if (!is24Hours) {
      if (!openingTime || !closingTime) { showToast('Please specify both opening and closing times.', { type: 'error' }); setSaving(false); return; }
      const [oH, oM] = openingTime.split(':').map(Number);
      const [cH, cM] = closingTime.split(':').map(Number);
      if (oH * 60 + oM >= cH * 60 + cM) { showToast('Opening time must be before closing time.', { type: 'error' }); setSaving(false); return; }
    }

    try {
      const url = storeId ? `/api/stores/${storeId}` : `/api/stores`;
      const method = storeId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: user?.id, storeName, description, address, workingDays,
          openingTime, closingTime, phone, phoneVisible, gstNumber,
          category: selectedCategory, is24Hours, latitude: mapLat, longitude: mapLng,
          logoUrl: logoUrl || null, coverUrl: coverUrl || null,
          postalCode: postalCode ? parseInt(postalCode) : null,
          city: city || null, state: state || null,
        }),
      });
      if (res.ok) {
        const updatedStore = await res.json();
        setStore(updatedStore);
        if (!storeId && updatedStore.id) {
          setStoreId(updatedStore.id);
          if (logoUrl) {
            try {
              await apiFetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId: updatedStore.id, caption: `Welcome to ${storeName}! We are now open.`, imageUrl: logoUrl, isOpeningPost: true }),
              });
            } catch { /* silent */ }
          }
        }
        navigate('/profile');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Failed to update profile.', { type: 'error' });
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleGPSUpdate = () => {
    if (!navigator.geolocation) { showToast('Geolocation is not supported by this browser.', { type: 'error' }); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      setMapLat(lat); setMapLng(lng);
      if (storeId) {
        try {
          await apiFetch(`/api/stores/${storeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
          showToast('📍 Location pinned successfully!', { type: 'success' });
        } catch { /* silent */ }
      } else {
        showToast('📍 Location captured! It will be saved when you submit the form.', { type: 'info' });
      }
    }, () => showToast('Unable to get location. Please allow location access.', { type: 'error' }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) { const data = await res.json(); setLogoUrl(data.url); }
    } catch { /* silent */ }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) { const data = await res.json(); setCoverUrl(data.url); }
    } catch { /* silent */ }
  };

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie' | 'store') => {
    const file = e.target.files?.[0]; if (!file) return;
    setKycUploading(true);
    const formData = new FormData(); formData.append('file', file);
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (type === 'doc') setKycDocUrl(data.url);
        else if (type === 'selfie') setKycSelfieUrl(data.url);
        else setKycStorePhoto(data.url);
      }
    } catch { /* silent */ }
    setKycUploading(false);
  };

  const handleKycSubmit = async () => {
    if (!kycDocUrl || !kycSelfieUrl || !kycStoreName || !kycStorePhoto) { showToast('Please fill in all KYC details.', { type: 'warning' }); return; }
    setKycSubmitting(true);
    try {
      const res = await apiFetch('/api/kyc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl: kycDocUrl, selfieUrl: kycSelfieUrl, storeName: kycStoreName, storePhoto: kycStorePhoto }),
      });
      if (res.ok) { setKycStatus('pending'); showToast('KYC submitted successfully!', { type: 'success' }); }
      else { showToast('Failed to submit KYC. Please try again.', { type: 'error' }); }
    } catch { /* silent */ }
    setKycSubmitting(false);
  };

  const needsKyc = user?.role !== 'customer' && user?.role !== 'admin';
  const kycApproved = kycStatus === 'approved';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'var(--dk-bg)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }} />
      </div>
    );
  }

  // ── KYC Gate ──────────────────────────────────────────────────────────────
  if (needsKyc && !kycApproved && !storeId) {
    return (
      <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="max-w-md mx-auto">
          <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{ background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}>
            <div className="flex items-center gap-3">
              <Link to="/profile"><ArrowLeft size={22} style={{ color: 'var(--dk-text-primary)' }} /></Link>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Identity Verification</h1>
            </div>
            <NotificationBell />
          </header>
          <main className="p-4">
            {kycStatus === 'pending' ? (
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4"><Clock size={28} className="text-amber-500" /></div>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Verification In Progress</h2>
                <p className="text-sm text-gray-500 leading-relaxed">Your documents are being reviewed by our team. This usually takes 24-48 hours.</p>
                <div className="mt-4 bg-amber-50 text-amber-700 text-xs font-medium px-4 py-2.5 rounded-xl">Status: Under Review</div>
              </div>
            ) : kycStatus === 'rejected' ? (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle size={24} className="text-red-500" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Verification Rejected</h2>
                    <p className="text-xs text-red-500 font-medium">Please resubmit your documents</p>
                  </div>
                </div>
                {kycNotes && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4"><strong>Reason:</strong> {kycNotes}</div>}
                <KycUploadForm
                  kycDocUrl={kycDocUrl} kycSelfieUrl={kycSelfieUrl}
                  kycStoreName={kycStoreName} kycStorePhoto={kycStorePhoto}
                  kycDocRef={kycDocRef} kycSelfieRef={kycSelfieRef} kycStorePhotoRef={kycStorePhotoRef}
                  kycUploading={kycUploading} kycSubmitting={kycSubmitting}
                  handleKycUpload={handleKycUpload} handleKycSubmit={handleKycSubmit}
                  setKycStoreName={setKycStoreName}
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center"><Shield size={24} className="text-indigo-600" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Verify Your Identity</h2>
                    <p className="text-xs text-gray-500">Required before setting up your store</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">Upload a valid ID document (Aadhaar, PAN, or Business License) and a clear selfie.</p>
                <KycUploadForm
                  kycDocUrl={kycDocUrl} kycSelfieUrl={kycSelfieUrl}
                  kycStoreName={kycStoreName} kycStorePhoto={kycStorePhoto}
                  kycDocRef={kycDocRef} kycSelfieRef={kycSelfieRef} kycStorePhotoRef={kycStorePhotoRef}
                  kycUploading={kycUploading} kycSubmitting={kycSubmitting}
                  handleKycUpload={handleKycUpload} handleKycSubmit={handleKycSubmit}
                  setKycStoreName={setKycStoreName}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{ background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}>
          <div className="flex items-center gap-3">
            <Link to="/profile"><ArrowLeft size={22} style={{ color: 'var(--dk-text-primary)' }} /></Link>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Edit Profile</h1>
          </div>
          <NotificationBell />
        </header>

        <main className="px-4 pt-4 pb-8">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}>
            <div className="p-5">
              <form className="space-y-4" onSubmit={handleSaveStoreInfo}>
                <StoreFormFields
                  store={store}
                  logoUrl={logoUrl} coverUrl={coverUrl}
                  fileInputRef={fileInputRef} coverFileInputRef={coverFileInputRef}
                  handleLogoUpload={handleLogoUpload} handleCoverUpload={handleCoverUpload}
                  selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                  descriptionRef={descriptionRef} descriptionValue={descriptionValue} setDescriptionValue={setDescriptionValue}
                  openAiModal={() => setAiModalOpen(true)}
                  mapLat={mapLat} mapLng={mapLng} handleGPSUpdate={handleGPSUpdate}
                  postalCode={postalCode} setPostalCode={setPostalCode}
                  city={city} setCity={setCity}
                  state={state} setState={setState}
                  cityOptions={cityOptions} stateOptions={stateOptions}
                  setPincodeLoading={setPincodeLoading} pincodeLoading={pincodeLoading}
                  setCityOptions={setCityOptions} setStateOptions={setStateOptions}
                  is24Hours={is24Hours} setIs24Hours={setIs24Hours}
                  selectedDays={selectedDays} toggleDay={toggleDay} allDays={allDays}
                  saving={saving}
                />
              </form>
            </div>
          </div>
        </main>
      </div>

      <AiBioModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        storeName={(document.querySelector<HTMLInputElement>('input[name="storeName"]'))?.value?.trim() || store?.storeName || ''}
        selectedCategory={selectedCategory}
        onBioApply={(bio) => {
          if (descriptionRef.current) descriptionRef.current.value = bio;
          setDescriptionValue(bio);
        }}
      />
    </div>
  );
}
