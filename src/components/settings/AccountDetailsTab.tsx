import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../lib/api';

interface AccountDetailsTabProps {
  isRetailer: boolean;
}

export const AccountDetailsTab = React.memo(function AccountDetailsTab({ isRetailer }: AccountDetailsTabProps) {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      <h2 className="text-sm font-bold text-gray-900 mb-4">{isRetailer ? 'Edit Sign-up Details' : 'Edit Personal Details'}</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
          <input type="text" id="details-name" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm" defaultValue={user?.name || ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
          <input type="text" id="details-phone" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm" defaultValue={(user as any)?.phone || ''} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
          <input type="email" id="details-email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" defaultValue={user?.email || ''} />
        </div>
        <button
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors mt-4"
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
            } catch {
              showToast('Error updating details.', { type: 'error' });
            }
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
});
