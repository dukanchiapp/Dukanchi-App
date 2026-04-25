import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, HelpCircle, Mail, AlertTriangle, Send, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const MIN_DESC_LENGTH = 20;

export default function SupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'help');
  const [issueType, setIssueType] = useState('store_issue');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !token) return;
    if (description.trim().length < MIN_DESC_LENGTH) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/complaints', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ issueType, description: description.trim() })
      });
      if (res.ok) {
        if (!mountedRef.current) return;
        setSubmitted(true);
        setDescription('');
        setTimeout(() => {
          if (!mountedRef.current) return;
          setSubmitted(false);
          setActiveTab('help');
        }, 3000);
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to submit complaint', { type: 'error' });
      }
    } catch {
      showToast('Network error. Please try again.', { type: 'error' });
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
      
      <div className="flex bg-white border-b border-gray-100 sticky top-[61px] z-10">
        <button 
          onClick={() => setActiveTab('help')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors flex justify-center items-center ${
            activeTab === 'help' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <HelpCircle size={18} className="mr-2" />
          Help Center
        </button>
        <button 
          onClick={() => setActiveTab('complaints')}
          className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors flex justify-center items-center ${
            activeTab === 'complaints' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle size={18} className="mr-2" />
          Complaint Box
        </button>
      </div>

      <main className="p-4">
        {activeTab === 'help' && (
          <div className="space-y-6">
            <div className="bg-indigo-50 p-6 rounded-2xl flex flex-col items-center text-center">
              <Mail className="h-10 w-10 text-indigo-600 mb-3" />
              <h2 className="text-lg font-bold text-gray-900">Need direct help?</h2>
              <p className="text-sm text-gray-600 mt-2 mb-4">Our support team is available 24/7 to assist you.</p>
              <a
                href="mailto:support@gai-app.com"
                className="bg-indigo-600 text-white font-medium py-2 px-6 rounded-full w-full text-center block"
              >
                Email Support
              </a>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3 px-1">Frequently Asked Questions</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                <details className="group p-4">
                  <summary className="font-medium text-sm text-gray-900 cursor-pointer list-none flex justify-between items-center">
                    How do I contact a seller?
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-3">Navigate to the store's profile or product page and tap the "Message" button to start a direct chat with the retailer.</p>
                </details>
                <details className="group p-4">
                  <summary className="font-medium text-sm text-gray-900 cursor-pointer list-none flex justify-between items-center">
                    Can I purchase items directly in the app?
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-3">Currently, the platform focuses on discovery. You can chat with retailers to arrange payment and pickup or delivery.</p>
                </details>
                <details className="group p-4">
                  <summary className="font-medium text-sm text-gray-900 cursor-pointer list-none flex justify-between items-center">
                    How do I change my location?
                    <span className="transition group-open:rotate-180">
                      <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                    </span>
                  </summary>
                  <p className="text-sm text-gray-600 mt-3">Tap on the Map tab and use the search bar to explore different areas, or update your saved locations in your Settings.</p>
                </details>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'complaints' && (
          submitted ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Complaint Submitted!</h2>
              <p className="text-sm text-gray-500">Thank you for your feedback. Our team will review it and take appropriate action.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">File a Complaint</h2>
                  <p className="text-xs text-gray-500">Report inappropriate behavior, scam, or broken app features.</p>
                </div>
              </div>

              <form className="space-y-4 mt-4" onSubmit={handleComplaintSubmit}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Select Issue Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-red-500 outline-none text-sm"
                  >
                    <option value="store_issue">Store / Retailer Issue</option>
                    <option value="bug">Bug or Technical Issue</option>
                    <option value="spam">Spam or Abuse</option>
                    <option value="account">Account Access</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-red-500 outline-none text-sm"
                    rows={5}
                    placeholder="Please provide details about the issue..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    minLength={MIN_DESC_LENGTH}
                  ></textarea>
                  <p className={`text-xs mt-1 ${description.trim().length < MIN_DESC_LENGTH ? 'text-amber-500' : 'text-green-600'}`}>
                    {description.trim().length < MIN_DESC_LENGTH
                      ? `${MIN_DESC_LENGTH - description.trim().length} more characters needed`
                      : 'Looks good'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || description.trim().length < MIN_DESC_LENGTH}
                  className="w-full bg-red-600 text-white py-3 flex justify-center items-center rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <Send size={18} className="mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </form>
            </div>
          )
        )}
      </main>
    </div>
  );
}
