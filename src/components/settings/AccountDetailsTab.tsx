import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';
import { Sentry } from '../../lib/sentry-frontend';
import { Upload } from 'lucide-react';

interface AccountDetailsTabProps {
  isRetailer: boolean;
}

export const AccountDetailsTab = React.memo(function AccountDetailsTab({ isRetailer }: AccountDetailsTabProps) {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState((user as any)?.avatarUrl || null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setAvatarPreview(data.url);
        await apiFetch(`/api/users/${user?.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ avatarUrl: data.url }),
        });
        showToast('Avatar updated!', { type: 'success' });
      } else {
        showToast(data.error || 'Upload failed', { type: 'error' });
      }
    } catch (err) {
      showToast('Network error during upload', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'accountDetails.avatarUpload' } });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <h2 className="text-sm font-bold text-gray-900 mb-4">{isRetailer ? 'Edit Sign-up Details' : 'Edit Personal Details'}</h2>
      
      <div className="flex items-center space-x-4 mb-4">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          {uploadingAvatar && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
        </div>
        <div>
          <label className="bg-[#FFF6DD] text-[#C77E00] px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer hover:bg-[#FFE6B3] transition-colors inline-flex items-center">
            <Upload size={14} className="mr-1.5" /> Change Photo
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
          </label>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
          <input type="text" id="details-name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#C77E00] focus:ring-2 focus:ring-[#FFE6B3] transition-all outline-none text-sm" defaultValue={user?.name || ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
          <input type="text" id="details-phone" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#C77E00] focus:ring-2 focus:ring-[#FFE6B3] transition-all outline-none text-sm" defaultValue={(user as any)?.phone || ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
          <input type="email" id="details-email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" defaultValue={user?.email || ''} />
        </div>
        <button
          className="w-full bg-[#C77E00] text-white py-3 rounded-xl font-medium hover:bg-[#A86A00] transition-colors mt-4"
          onClick={async () => {
            const name = (document.getElementById('details-name') as HTMLInputElement).value;
            const phone = (document.getElementById('details-phone') as HTMLInputElement).value;
            const email = (document.getElementById('details-email') as HTMLInputElement).value;
            try {
              const res = await apiFetch(`/api/users/${user?.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, phone, email }),
              });
              if (res.ok) {
                showToast('Details updated successfully!', { type: 'success' });
              } else {
                showToast('Failed to update details.', { type: 'error' });
              }
            } catch (err) {
              showToast('Error updating details.', { type: 'error' });
              Sentry.captureException(err, { extra: { context: 'accountDetails.update' } });
            }
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
});
