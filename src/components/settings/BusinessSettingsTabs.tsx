import React from 'react';
import { CreditCard, Megaphone, AlertTriangle, HelpCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface BusinessSettingsTabsProps {
  activeTab: string;
  store: any;
  setStore: (s: any) => void;
  isBusinessOwner: boolean;
  token: string | null;
}

export const BusinessSettingsTabs = React.memo(function BusinessSettingsTabs({
  activeTab, store, setStore, isBusinessOwner, token,
}: BusinessSettingsTabsProps) {
  const { showToast } = useToast();

  const handleToggleSetting = async (key: string, value: boolean) => {
    if (!store) return;
    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) setStore({ ...store, [key]: value });
    } catch (e) { console.error(e); }
  };

  return (
    <>
      {activeTab === 'visibility' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div><h3 className="font-bold text-gray-900">Hide Ratings</h3><p className="text-xs text-gray-500 mt-1">When enabled, the Reviews tab is hidden from your public profile.</p></div>
            <button onClick={() => handleToggleSetting('hideRatings', !store?.hideRatings)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${store?.hideRatings ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${store?.hideRatings ? 'translate-x-6' : 'translate-x-0'}`}></span>
            </button>
          </div>
        </div>
      )}
      {activeTab === 'chat_settings' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div><h3 className="font-bold text-gray-900">Enable Direct Chat</h3><p className="text-xs text-gray-500 mt-1">Allow customers to message you directly.</p></div>
            <button onClick={() => handleToggleSetting('chatEnabled', !store?.chatEnabled)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${store?.chatEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${store?.chatEnabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
            </button>
          </div>
        </div>
      )}
      {activeTab === 'subscription' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="font-bold text-gray-900 mb-2">Subscription Plans</h3>
          <p className="text-sm text-gray-500 mb-6">Upgrade for promoted posts, analytics, and priority support.</p>
          <div className="space-y-3">
            <div className="border border-indigo-200 rounded-xl p-4 text-left bg-indigo-50"><div className="flex justify-between items-center"><div><h4 className="font-bold text-gray-900">Pre-Launch Pro</h4><p className="text-xs text-gray-500">All premium features</p></div><span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-full font-medium shadow-sm">Current</span></div></div>
          </div>
        </div>
      )}
      {activeTab === 'marketing' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <Megaphone className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="font-bold text-gray-900 mb-2">Store Marketing</h3>
          <p className="text-sm text-gray-500 mb-4">Boost visibility with promoted posts and targeted campaigns.</p>
          <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-full">Coming Soon</span>
        </div>
      )}
      {activeTab === 'report' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" /><h3 className="font-bold text-gray-900 mb-2 text-center">Report Fake User</h3>
          <p className="text-sm text-gray-500 mb-4 text-center">Report suspicious accounts or fraudulent activity.</p>
          <textarea id="report-text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400 mb-3" rows={4} placeholder="Describe the issue..." />
          <button
            className="w-full bg-red-600 text-white py-2.5 rounded-xl font-medium hover:bg-red-700 transition-colors"
            onClick={async () => {
              const description = (document.getElementById('report-text') as HTMLTextAreaElement)?.value?.trim();
              if (!description) { showToast('Please describe the issue.', { type: 'error' }); return; }
              try {
                const res = await fetch('/api/complaints', {
                  credentials: 'include',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ issueType: 'fake_user', description }),
                });
                if (res.ok) {
                  (document.getElementById('report-text') as HTMLTextAreaElement).value = '';
                  showToast('Report submitted. We will review it shortly.', { type: 'success' });
                } else {
                  showToast('Failed to submit report.', { type: 'error' });
                }
              } catch { showToast('Network error.', { type: 'error' }); }
            }}
          >
            Submit Report
          </button>
        </div>
      )}
      {activeTab === 'help' && isBusinessOwner && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" /><h3 className="font-bold text-gray-900 mb-2">Help & Feedback</h3>
          <p className="text-sm text-gray-500 mb-4">Have questions? We'd love to hear from you.</p>
          <textarea id="help-text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 mb-3" rows={4} placeholder="Tell us what's on your mind..." />
          <button
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            onClick={async () => {
              const description = (document.getElementById('help-text') as HTMLTextAreaElement)?.value?.trim();
              if (!description) { showToast('Please enter your message.', { type: 'error' }); return; }
              try {
                const res = await fetch('/api/complaints', {
                  credentials: 'include',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ issueType: 'feedback', description }),
                });
                if (res.ok) {
                  (document.getElementById('help-text') as HTMLTextAreaElement).value = '';
                  showToast('Feedback sent! Thank you.', { type: 'success' });
                } else {
                  showToast('Failed to send feedback.', { type: 'error' });
                }
              } catch { showToast('Network error.', { type: 'error' }); }
            }}
          >
            Send Feedback
          </button>
        </div>
      )}
    </>
  );
});
