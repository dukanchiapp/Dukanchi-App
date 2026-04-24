import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Search, Trash2, MessageSquare, Clock, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, User, Filter } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';

interface Complaint {
  id: string;
  issueType: string;
  description: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

const ISSUE_LABELS: Record<string, string> = {
  store_issue: 'Store / Retailer Issue',
  bug: 'Bug / Technical',
  spam: 'Spam / Abuse',
  account: 'Account Access',
  feedback: 'Feedback / Suggestion',
  fake_user: 'Fake User',
  other: 'Other',
};

export default function Complaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const { showToast, showConfirm } = useToast();

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/api/admin/complaints?${params}`, { headers: getAdminHeaders() });
      setComplaints(res.data.complaints);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setOpenCount(res.data.openCount ?? 0);
      setInProgressCount(res.data.inProgressCount ?? 0);
      setResolvedCount(res.data.resolvedCount ?? 0);
    } catch {
      showToast('Failed to fetch complaints', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await api.put(`/api/admin/complaints/${id}`, { status, adminNotes: adminNotes || undefined }, { headers: getAdminHeaders() });
      showToast(`Complaint marked as ${status}`, { type: 'success' });
      fetchComplaints();
      setSelectedComplaint(null);
      setAdminNotes('');
    } catch {
      showToast('Failed to update complaint', { type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const deleteComplaint = (id: string) => {
    showConfirm('Delete this complaint permanently?', {
      type: 'error',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/complaints/${id}`, { headers: getAdminHeaders() });
          showToast('Complaint deleted', { type: 'success' });
          fetchComplaints();
          if (selectedComplaint?.id === id) setSelectedComplaint(null);
        } catch {
          showToast('Failed to delete', { type: 'error' });
        }
      }
    });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const openComplaint = (c: Complaint) => {
    setSelectedComplaint(c);
    setAdminNotes(c.adminNotes || '');
  };

  return (
    <AdminLayout title="Complaints">
      <div className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'all', label: 'All', count: total },
            { key: 'open', label: 'Open', count: openCount },
            { key: 'in_progress', label: 'In Progress', count: inProgressCount },
            { key: 'resolved', label: 'Resolved', count: resolvedCount },
          ].map(({ key, label, count }) => {
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1); }}
                className={`p-4 rounded-2xl border transition-all text-left ${
                  isActive ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className={`text-xs font-medium mt-1 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>{label}</p>
              </button>
            );
          })}
        </div>

        {/* Complaints List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No complaints found</p>
            <p className="text-sm text-gray-400 mt-1">{statusFilter !== 'all' ? 'Try a different filter' : 'All clear! No user complaints.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map(c => {
              const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
              const StatusIcon = statusCfg.icon;
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openComplaint(c)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertTriangle size={18} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm text-gray-900">{ISSUE_LABELS[c.issueType] || c.issueType}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color} flex items-center gap-1`}>
                          <StatusIcon size={10} /> {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{c.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User size={10} /> {c.user.name} ({c.user.role})
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {formatDate(c.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteComplaint(c.id); }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 px-3 font-medium">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Complaint Detail Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedComplaint(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={22} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{ISSUE_LABELS[selectedComplaint.issueType] || selectedComplaint.issueType}</h3>
                  <p className="text-xs text-gray-500">by {selectedComplaint.user.name} · {selectedComplaint.user.phone}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-700 leading-relaxed">{selectedComplaint.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_CONFIG[selectedComplaint.status]?.color}`}>
                    {STATUS_CONFIG[selectedComplaint.status]?.label || selectedComplaint.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <p className="text-xs text-gray-400 mb-1">Submitted</p>
                  <p className="text-xs font-medium text-gray-700">{formatDate(selectedComplaint.createdAt)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this complaint..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateStatus(selectedComplaint.id, 'in_progress')}
                  disabled={updating}
                  className="py-2.5 rounded-xl bg-yellow-50 text-yellow-700 text-xs font-semibold hover:bg-yellow-100 transition-colors disabled:opacity-50"
                >
                  In Progress
                </button>
                <button
                  onClick={() => updateStatus(selectedComplaint.id, 'resolved')}
                  disabled={updating}
                  className="py-2.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  onClick={() => updateStatus(selectedComplaint.id, 'dismissed')}
                  disabled={updating}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>

              <button onClick={() => setSelectedComplaint(null)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
