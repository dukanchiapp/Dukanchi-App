import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Camera, Navigation, Check, Clock, Shield, Upload, AlertTriangle, Loader2, Store, Sparkles, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarRating from '../components/StarRating';

const STORE_CATEGORIES = [
  'General', 'Electronics', 'Fashion', 'Grocery', 'Home & Garden', 'Sports', 'Beauty',
  'Vehicles', 'Jewellery', 'Entertainment', 'Health & Wellness', 'Education', 'Services',
  'Food & Restaurant', 'Furniture', 'Hardware', 'Pharmacy', 'Stationery', 'Toys',
  'Mobile & Accessories', 'Clothing', 'Footwear', 'Books', 'Pet Supplies', 'Optical',
  'Building Materials', 'Auto Parts', 'Agricultural', 'Other'
];

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

  // AI bio modal state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalStep, setAiModalStep] = useState<'input' | 'result'>('input');
  const [aiSells, setAiSells] = useState('');
  const [aiUniqueness, setAiUniqueness] = useState('');
  const [aiTone, setAiTone] = useState<'Professional' | 'Friendly' | 'Desi/Casual'>('Friendly');
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [aiDescResult, setAiDescResult] = useState<{ bio: string; tagline: string } | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

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
  
  // Working days selection
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // Fetch KYC status
  useEffect(() => {
    if (user?.id && user?.role !== 'customer' && user?.role !== 'admin') {
      fetch('/api/kyc/status', { credentials: 'include',   })
        .then(res => res.json())
        .then(data => {
          setKycStatus(data.kycStatus || 'none');
          setKycNotes(data.kycNotes || '');
        })
        .catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/users/${user.id}/store`)
        .then(res => res.json())
        .then(data => {
          if (data && data.id) {
            setStoreId(data.id);
            setStore(data);
            setMapLat(data.latitude || 0);
            setMapLng(data.longitude || 0);
            setSelectedCategory(data.category || 'General');
            setIs24Hours(data.is24Hours || false);
            setLogoUrl(data.logoUrl || '');
            setCoverUrl(data.coverUrl || '');
            setPostalCode(data.postalCode ? String(data.postalCode) : '');
            setCity(data.city || '');
            setState(data.state || '');
            if (data.workingDays) {
              setSelectedDays(data.workingDays.split(', ').filter(Boolean));
            }
            setLoading(false);
          } else {
            // New store: Fetch KYC status to pre-fill intended store details
            fetch('/api/kyc/status', { credentials: 'include',   })
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
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

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

    // Validation
    if (!storeName) { showToast('Store name is required.', { type: 'error' }); setSaving(false); return; }
    if (!description) { showToast('Store bio / description is required.', { type: 'error' }); setSaving(false); return; }
    if (!address) { showToast('Address is required.', { type: 'error' }); setSaving(false); return; }
    if (mapLat === 0 && mapLng === 0) { showToast('Please save your map location.', { type: 'error' }); setSaving(false); return; }
    if (!phoneRaw) { showToast('Phone number is required.', { type: 'error' }); setSaving(false); return; }
    if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ''))) { showToast('Phone number format is invalid.', { type: 'error' }); setSaving(false); return; }
    if (selectedDays.length === 0) { showToast('Please select your working days.', { type: 'error' }); setSaving(false); return; }
    
    if (!is24Hours) {
      if (!openingTime || !closingTime) {
        showToast('Please specify both opening and closing times.', { type: 'error' }); setSaving(false); return;
      }
      const [oH, oM] = openingTime.split(':').map(Number);
      const [cH, cM] = closingTime.split(':').map(Number);
      if (oH * 60 + oM >= cH * 60 + cM) {
        showToast('Opening time must be before closing time.', { type: 'error' }); setSaving(false); return;
      }
    }

    try {
      const url = storeId ? `/api/stores/${storeId}` : `/api/stores`;
      const method = storeId ? 'PUT' : 'POST';
      const bodyData: any = { 
         ownerId: user?.id,
         storeName, description, address, workingDays, 
         openingTime, closingTime, phone, phoneVisible, gstNumber,
         category: selectedCategory,
         is24Hours,
         latitude: mapLat,
         longitude: mapLng,
         logoUrl: logoUrl || null,
         coverUrl: coverUrl || null,
         postalCode: postalCode ? parseInt(postalCode) : null,
         city: city || null,
         state: state || null,
      };

      const res = await fetch(url, { credentials: 'include', 
         method,
         headers: {
            'Content-Type': 'application/json',
            
         },
         body: JSON.stringify(bodyData)
      });
      if (res.ok) {
        const updatedStore = await res.json();
        setStore(updatedStore);
        
        // If this is a newly created store, create an opening post using the storefront photo
        if (!storeId && updatedStore.id) {
          setStoreId(updatedStore.id);
          if (logoUrl) {
            try {
              await fetch('/api/posts', { credentials: 'include', 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  storeId: updatedStore.id, 
                  caption: `Welcome to ${storeName}! We are now open.`, 
                  imageUrl: logoUrl,
                  isOpeningPost: true
                })
              });
            } catch (err) {
              console.error('Failed to create opening post', err);
            }
          }
        }
        
        navigate('/profile');
      } else {
        const errorData = await res.json().catch(() => ({}));
        showToast(errorData.error || 'Failed to update profile.', { type: 'error' });
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleGPSUpdate = () => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMapLat(lat);
          setMapLng(lng);

          if (storeId) {
            try {
               await fetch(`/api/stores/${storeId}`, { credentials: 'include', 
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ latitude: lat, longitude: lng })
               });
               showToast('📍 Location pinned successfully!', { type: 'success' });
            } catch(e) {}
          } else {
            showToast('📍 Location captured! It will be saved when you submit the form.', { type: 'info' });
          }
       }, () => {
         showToast("Unable to get location. Please allow location access.", { type: 'error' });
       });
    } else {
       showToast("Geolocation is not supported by this browser.", { type: 'error' });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { credentials: 'include', 
        method: 'POST',
        
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { credentials: 'include', method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setCoverUrl(data.url);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openAiModal = () => {
    setAiModalStep('input');
    setAiDescResult(null);
    setAiSells('');
    setAiUniqueness('');
    setAiTone('Friendly');
    setAiModalOpen(true);
  };

  const handleAiGenerate = async () => {
    const nameEl = document.querySelector<HTMLInputElement>('input[name="storeName"]');
    const storeName = nameEl?.value?.trim() || store?.storeName || '';
    if (!storeName) { showToast('Pehle store name bharo', { type: 'warning' }); setAiModalOpen(false); return; }
    setAiDescLoading(true);
    try {
      const res = await fetch('/api/ai/generate-store-description', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName,
          category: selectedCategory,
          userContext: { sells: aiSells.trim(), uniqueness: aiUniqueness.trim(), tone: aiTone },
        }),
      });
      if (res.status === 429) { showToast('Thodi der baad try karo — AI abhi busy hai', { type: 'warning' }); return; }
      if (!res.ok) { showToast('AI abhi available nahi, manually bharo', { type: 'error' }); return; }
      const data = await res.json();
      setAiDescResult(data);
      setAiModalStep('result');
    } catch {
      showToast('AI abhi available nahi, manually bharo', { type: 'error' });
    } finally {
      setAiDescLoading(false);
    }
  };

  // KYC upload handler
  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie' | 'store') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKycUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { credentials: 'include', 
        method: 'POST',
        
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (type === 'doc') setKycDocUrl(data.url);
        else if (type === 'selfie') setKycSelfieUrl(data.url);
        else setKycStorePhoto(data.url);
      }
    } catch (err) { console.error(err); }
    setKycUploading(false);
  };

  const handleKycSubmit = async () => {
    if (!kycDocUrl || !kycSelfieUrl || !kycStoreName || !kycStorePhoto) { 
      showToast('Please fill in all KYC details including store name and photo.', { type: 'warning' }); 
      return; 
    }
    setKycSubmitting(true);
    try {
      const res = await fetch('/api/kyc/submit', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentUrl: kycDocUrl, 
          selfieUrl: kycSelfieUrl,
          storeName: kycStoreName,
          storePhoto: kycStorePhoto
        }),
      });
      if (res.ok) {
        setKycStatus('pending');
        showToast('KYC submitted successfully!', { type: 'success' });
      } else {
        showToast('Failed to submit KYC. Please try again.', { type: 'error' });
      }
    } catch (err) { console.error(err); }
    setKycSubmitting(false);
  };

  // Whether this user needs KYC (non-customer, non-admin)
  const needsKyc = user?.role !== 'customer' && user?.role !== 'admin';
  const kycApproved = kycStatus === 'approved';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen" style={{ background: 'var(--dk-bg)' }}>
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }} />
      </div>
    );
  }

  // KYC Gate — show upload/pending/rejected screen before allowing profile edit
  if (needsKyc && !kycApproved && !storeId) {
    return (
      <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="max-w-md mx-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3" style={{ background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}>
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <ArrowLeft size={22} style={{ color: 'var(--dk-text-primary)' }} />
            </Link>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Identity Verification</h1>
          </div>
          <NotificationBell />
        </header>

        <main className="p-4">
          {kycStatus === 'pending' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={28} className="text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Verification In Progress</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your documents are being reviewed by our team. This usually takes 24-48 hours.
                You'll be able to set up your store profile once verified.
              </p>
              <div className="mt-4 bg-amber-50 text-amber-700 text-xs font-medium px-4 py-2.5 rounded-xl">
                Status: Under Review
              </div>
            </div>
          ) : kycStatus === 'rejected' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Verification Rejected</h2>
                  <p className="text-xs text-red-500 font-medium">Please resubmit your documents</p>
                </div>
              </div>
              {kycNotes && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                  <strong>Reason:</strong> {kycNotes}
                </div>
              )}
              {/* Show upload form again for resubmission */}
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
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
                  <Shield size={24} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Verify Your Identity</h2>
                  <p className="text-xs text-gray-500">Required before setting up your store</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                To ensure platform safety, please upload a valid ID document
                (Aadhaar, PAN, or Business License) and a clear selfie.
              </p>
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
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link to="/profile">
            <ArrowLeft size={22} style={{ color: 'var(--dk-text-primary)' }} />
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Edit Profile</h1>
        </div>
        <NotificationBell />
      </header>

      <main className="px-4 pt-4 pb-8">
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}>
          <div className="p-5">
            {/* Store Image Upload */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative">
                <div
                  className="overflow-hidden"
                  style={{ width: 88, height: 88, borderRadius: 20, border: '3px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', background: 'var(--dk-surface)' }}
                >
                  <img
                    src={logoUrl || store?.logoUrl || '/uploads/default-logo.png'}
                    alt="Store Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-full"
                  style={{ background: 'var(--dk-accent)', border: '2px solid white' }}
                >
                  <Camera size={15} color="white" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <p
                className="mt-2 cursor-pointer font-semibold text-xs"
                style={{ color: 'var(--dk-accent)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                Change Logo
              </p>
              {store && !store?.hideRatings && typeof store.averageRating === 'number' && (
                <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)' }}>
                  <StarRating rating={store.averageRating || 0} size={13} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>{store.averageRating.toFixed(1)} ({store.reviewCount || 0})</span>
                </div>
              )}
            </div>

            {/* Cover Photo Upload */}
            <div className="mb-5 -mx-5 -mt-0">
              <div
                className="relative overflow-hidden"
                style={{ height: 120, background: 'var(--dk-surface)', borderBottom: '0.5px solid var(--dk-border)' }}
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: '#F3F4F6' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--dk-text-tertiary)' }}>No cover photo</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => coverFileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(4px)' }}
                >
                  <Camera size={12} /> {coverUrl ? 'Change Cover' : 'Add Cover Photo'}
                </button>
                <input ref={coverFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSaveStoreInfo}>
              {/* Store Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Name</label>
                <input 
                  name="storeName"
                  type="text"
                  className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                  defaultValue={store?.storeName || ''}
                  required
                />
              </div>

              {/* Store Category */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                >
                  {STORE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Store Bio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--dk-text-tertiary)' }}>Store Bio</label>
                  <button
                    type="button"
                    onClick={openAiModal}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                  >
                    <Sparkles size={11} />
                    ✨ AI se generate karo
                  </button>
                </div>
                <textarea
                  ref={descriptionRef}
                  name="description"
                  className="w-full p-3 rounded-xl outline-none text-sm leading-relaxed dk-input"
                  rows={3}
                  defaultValue={store?.description || ''}
                  placeholder="Tell customers about your business..."
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Physical Address</label>
                <input 
                  name="address"
                  type="text"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm text-gray-900"
                  defaultValue={store?.address || ''}
                  required
                />
              </div>

              {/* Google Map Location Picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Map Location</label>
                <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid var(--dk-border)', background: 'var(--dk-surface)' }}>
                  {mapLat !== 0 && mapLng !== 0 ? (
                    <div className="relative">
                        <img 
                          src={`https://maps.googleapis.com/maps/api/staticmap?center=${mapLat},${mapLng}&zoom=16&size=600x200&markers=color:red%7C${mapLat},${mapLng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                        alt="Store location"
                        className="w-full h-[140px] object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="p-3" style={{ background: 'var(--dk-surface)', borderTop: '0.5px solid var(--dk-border)' }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium">📍 Coordinates saved</p>
                            <p className="text-[10px] text-gray-400">{mapLat.toFixed(6)}, {mapLng.toFixed(6)}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              type="button" 
                              onClick={handleGPSUpdate} 
                              className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center dk-update-btn"
                            >
                              <Navigation size={12} className="mr-1" /> Update Location
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <MapPin size={28} className="mx-auto text-indigo-400 mb-3" />
                      <p className="text-sm text-gray-600 font-medium mb-1">No location pinned yet</p>
                      <p className="text-xs text-gray-400 mb-4">Stand at your store and tap the button below to pin your location on the map.</p>
                      <button 
                        type="button" 
                        onClick={handleGPSUpdate} 
                        className="text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center mx-auto" style={{ background: 'var(--dk-accent)' }}
                      >
                        <Navigation size={16} className="mr-2" /> Save My Current Location
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Postal Code + City/State */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Postal Code</label>
                <input 
                  type="number"
                  className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                  value={postalCode}
                  onChange={async (e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPostalCode(val);
                    if (val.length === 6) {
                      setPincodeLoading(true);
                      try {
                        const res = await fetch(`/api/pincode/${val}`);
                        if (res.ok) {
                          const data = await res.json();
                          setCity(data.city || '');
                          setState(data.state || '');
                          setCityOptions(data.allCities || []);
                          setStateOptions(data.allStates || []);
                        }
                      } catch (err) { console.error(err); }
                      setPincodeLoading(false);
                    }
                  }}
                  placeholder="e.g. 400001"
                  maxLength={6}
                />
                {pincodeLoading && <p className="text-xs mt-1 animate-pulse" style={{ color: 'var(--dk-accent)' }}>Looking up pincode...</p>}
              </div>

              {/* City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>City / District</label>
                  {cityOptions.length > 0 ? (
                    <select
                      className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">Select City</option>
                      {cityOptions.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Enter city"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>State</label>
                  {stateOptions.length > 0 ? (
                    <select
                      className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      <option value="">Select State</option>
                      {stateOptions.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Enter state"
                    />
                  )}
                </div>
              </div>

              {/* Phone Number + Visibility Toggle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl text-sm font-medium" style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', borderRight: 'none', color: 'var(--dk-text-secondary)' }}>+91</span>
                  <input 
                    name="phone"
                    type="tel"
                    className="flex-1 p-3 rounded-r-xl outline-none text-sm font-medium dk-input"
                    defaultValue={store?.phone?.replace(/^\+91/, '') || ''}
                    placeholder="XXXXX XXXXX"
                    required
                  />
                </div>
                <div className="flex items-center mt-2.5">
                   <input type="checkbox" name="phoneVisible" id="phoneVisible" defaultChecked={store?.phoneVisible ?? true} className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500" />
                   <label htmlFor="phoneVisible" className="ml-2 text-xs text-gray-600 font-medium">Show phone number on public profile</label>
                </div>
              </div>

              {/* GST Number */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>GST Number <span className="text-gray-400 normal-case font-normal ml-1">(Optional)</span></label>
                <input 
                  name="gstNumber"
                  type="text"
                  className="w-full p-3 rounded-xl outline-none text-sm font-medium dk-input"
                  defaultValue={store?.gstNumber || ''}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                />
              </div>

              {/* Store Timing */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>Store Timing</label>
                
                {/* 24 Hours Toggle */}
                <button
                  type="button"
                  onClick={() => setIs24Hours(!is24Hours)}
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
                        <input 
                           name="openingTime"
                           type="time"
                           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-sm text-gray-900 font-medium"
                           defaultValue={store?.openingTime || ''}
                        />
                     </div>
                     <div>
                        <label className="block text-[10px] text-gray-400 mb-1">Closing Time</label>
                        <input 
                           name="closingTime"
                           type="time"
                           className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none text-sm text-gray-900 font-medium"
                           defaultValue={store?.closingTime || ''}
                        />
                     </div>
                  </div>
                )}
              </div>

              {/* Working Days Selection */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
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
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl font-bold tracking-wide disabled:opacity-50"
                  style={{ background: '#1A1A1A', color: 'white' }}
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      </div>

      {/* ── AI Bio Modal ── */}
      {aiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setAiModalOpen(false); }}
        >
          <div className="w-full max-w-[380px] rounded-2xl p-6 shadow-xl" style={{ background: 'white' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--dk-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-accent)' }}>AI Store Description</h3>
              </div>
              <button type="button" onClick={() => setAiModalOpen(false)} className="p-1">
                <X size={18} style={{ color: 'var(--dk-text-tertiary)' }} />
              </button>
            </div>
            <p className="mb-4 text-xs" style={{ color: 'var(--dk-text-tertiary)', lineHeight: 1.5 }}>
              Thodi information do — AI aapki dukaan ke liye perfect bio likhega
            </p>

            {aiModalStep === 'input' ? (
              <div className="space-y-4">
                {/* Field A */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>
                    Aapki dukaan kya bechti hai?
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl outline-none text-sm dk-input"
                    rows={2}
                    placeholder="e.g. Mobile phones, accessories, repairs"
                    value={aiSells}
                    onChange={(e) => setAiSells(e.target.value)}
                  />
                </div>
                {/* Field B */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>
                    Koi khaas cheez? <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="w-full p-3 rounded-xl outline-none text-sm dk-input"
                    rows={2}
                    placeholder="e.g. 10 saal ka experience, best price guarantee, free delivery"
                    value={aiUniqueness}
                    onChange={(e) => setAiUniqueness(e.target.value)}
                  />
                </div>
                {/* Tone picker */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--dk-text-tertiary)' }}>
                    Tone kaisi chahiye?
                  </label>
                  <div className="flex gap-2">
                    {(['Professional', 'Friendly', 'Desi/Casual'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAiTone(t)}
                        className="flex-1 py-1.5 rounded-full text-xs font-semibold"
                        style={{
                          background: aiTone === t ? 'var(--dk-accent)' : 'var(--dk-surface)',
                          color: aiTone === t ? 'white' : 'var(--dk-text-secondary)',
                          border: '0.5px solid var(--dk-border)',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Generate button */}
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiDescLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'var(--dk-accent)', color: 'white' }}
                >
                  {aiDescLoading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      AI soch raha hai...
                    </>
                  ) : (
                    <><Sparkles size={14} /> ✨ Generate karo</>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Bio result card */}
                {aiDescResult?.bio && (
                  <div className="p-3 rounded-xl" style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dk-text-tertiary)' }}>Bio</p>
                    <p className="text-sm mb-3" style={{ color: 'var(--dk-text-primary)', lineHeight: 1.55 }}>{aiDescResult.bio}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (descriptionRef.current) descriptionRef.current.value = aiDescResult!.bio;
                        setAiModalOpen(false);
                      }}
                      className="w-full py-2 rounded-xl font-bold text-sm"
                      style={{ background: 'var(--dk-accent)', color: 'white' }}
                    >
                      Bio use karo
                    </button>
                  </div>
                )}
                {/* Tagline result card */}
                {aiDescResult?.tagline && (
                  <div className="p-3 rounded-xl" style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--dk-text-tertiary)' }}>Tagline</p>
                    <p className="text-sm mb-3 font-medium" style={{ color: 'var(--dk-text-primary)', fontStyle: 'italic' }}>"{aiDescResult.tagline}"</p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(aiDescResult!.tagline).catch(() => {});
                        showToast('Tagline copied!', { type: 'success' });
                      }}
                      className="w-full py-2 rounded-xl font-bold text-sm"
                      style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                    >
                      Tagline copy karo
                    </button>
                  </div>
                )}
                {/* Back link */}
                <button
                  type="button"
                  onClick={() => { setAiModalStep('input'); setAiDescResult(null); }}
                  className="w-full text-center text-xs font-semibold pt-1"
                  style={{ color: 'var(--dk-text-tertiary)' }}
                >
                  ← Wapas (dobara generate karo)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// KYC Upload Form sub-component
function KycUploadForm({ 
  kycDocUrl, kycSelfieUrl, kycStoreName, kycStorePhoto, 
  kycDocRef, kycSelfieRef, kycStorePhotoRef, 
  kycUploading, kycSubmitting, handleKycUpload, handleKycSubmit, setKycStoreName 
}: {
  kycDocUrl: string; kycSelfieUrl: string; kycStoreName: string; kycStorePhoto: string;
  kycDocRef: React.RefObject<HTMLInputElement | null>; 
  kycSelfieRef: React.RefObject<HTMLInputElement | null>;
  kycStorePhotoRef: React.RefObject<HTMLInputElement | null>;
  kycUploading: boolean; kycSubmitting: boolean;
  handleKycUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'selfie' | 'store') => void;
  handleKycSubmit: () => void;
  setKycStoreName: (val: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Store Name */}
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

      {/* Storefront Photo Upload */}
      <div
        onClick={() => kycStorePhotoRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          kycStorePhoto ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
        }`}
      >
        {kycStorePhoto ? (
          <div>
            <img src={kycStorePhoto} alt="Storefront" className="w-full h-32 object-cover rounded-lg mb-2" />
            <p className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
              <Check size={14} /> Storefront photo uploaded
            </p>
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
        {/* Document Upload */}
        <div
          onClick={() => kycDocRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            kycDocUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
          }`}
        >
          {kycDocUrl ? (
            <div>
              <img src={kycDocUrl} alt="ID Document" className="w-full h-20 object-cover rounded-lg mb-1 shadow-sm" />
              <p className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1">
                <Check size={10} /> ID Uploaded
              </p>
            </div>
          ) : (
            <div>
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[10px] font-bold text-gray-600">ID Document</p>
            </div>
          )}
          <input ref={kycDocRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleKycUpload(e, 'doc')} />
        </div>

        {/* Selfie Upload */}
        <div
          onClick={() => kycSelfieRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            kycSelfieUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
          }`}
        >
          {kycSelfieUrl ? (
            <div>
              <img src={kycSelfieUrl} alt="Selfie" className="w-full h-20 object-cover rounded-lg mb-1 shadow-sm" />
              <p className="text-[10px] text-green-600 font-bold flex items-center justify-center gap-1">
                <Check size={10} /> Selfie Taken
              </p>
            </div>
          ) : (
            <div>
              <Camera size={20} className="mx-auto text-gray-400 mb-1" />
              <p className="text-[10px] font-bold text-gray-600">Your Selfie</p>
            </div>
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
        {kycSubmitting ? (
          <><Loader2 size={16} className="animate-spin" /> Submitting...</>
        ) : (
          <><Shield size={16} /> Submit for Verification</>
        )}
      </button>
    </div>
  );
}
