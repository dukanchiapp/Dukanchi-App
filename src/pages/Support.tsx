import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { Sentry } from '../lib/sentry-frontend';

export default function SupportPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !token) return;
    setSubmitting(true);
    try {
      // Submits as 'other' issue type since we simplified the form
      const res = await apiFetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ issueType: 'other', description: description.trim() })
      });
      if (res.ok) {
        if (!mountedRef.current) return;
        setSubmitted(true);
        setDescription('');
        setTimeout(() => {
          if (!mountedRef.current) return;
          setSubmitted(false);
        }, 3000);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to submit request', { type: 'error' });
      }
    } catch (err) {
      showToast('Network error. Please try again.', { type: 'error' });
      Sentry.captureException(err, { extra: { context: 'support.submit' } });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <header className="bg-white px-4 py-4 sticky top-0 z-20 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Support & Feedback</h1>
        </div>
        <NotificationBell />
      </header>
      
      <main className="p-4">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mt-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Request Submitted!</h2>
            <p className="text-sm text-gray-500">Thank you for your feedback. Our team will review it and get back to you shortly.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mt-4 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">How can we help?</h2>
              <p className="text-sm text-gray-500 mt-1">Describe your issue, feature request, or general feedback below.</p>
            </div>

            <form className="space-y-4 mt-4" onSubmit={handleSupportSubmit}>
              <div>
                <textarea
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-[#C77E00] outline-none text-sm"
                  rows={6}
                  placeholder="Tell us what's on your mind..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submitting || !description.trim()}
                className="w-full bg-[#C77E00] text-white py-3 flex justify-center items-center rounded-xl font-medium hover:bg-[#A86A00] transition-colors disabled:opacity-50"
              >
                <Send size={18} className="mr-2" />
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
