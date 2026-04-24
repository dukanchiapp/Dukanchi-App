import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, X, Clock, Eye, Shield } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';



interface KycUser {
  id: string; name: string; phone: string; role: string;
  kycStatus: string; kycDocumentUrl: string | null; kycSelfieUrl: string | null;
  kycStorePhoto: string | null; kycStoreName: string | null;
  kycNotes: string | null; kycSubmittedAt: string | null; kycReviewedAt: string | null;
}

export default function KycReview() {
  const [users, setUsers] = useState<KycUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<KycUser | null>(null);
  const [rejectUser, setRejectUser] = useState<KycUser | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchKyc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/kyc', { 
        headers: getAdminHeaders(), 
        params: { status: statusFilter, page, limit: 15 } 
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { 
    fetchKyc(); 
  }, [fetchKyc]);

  const [now] = useState(Date.now());

  const handleApprove = async (userId: string) => {
    try {
      await api.put(`/api/admin/kyc/${userId}`, { status: 'approved' }, { headers: getAdminHeaders() });
      setSelectedUser(null);
      showToast('KYC Approved successfully', { type: 'success' });
      fetchKyc();
    } catch {
      showToast('Failed to approve KYC', { type: 'error' });
    }
  };

  const handleReject = async () => {
    if (!rejectUser) return;
    try {
      await api.put(`/api/admin/kyc/${rejectUser.id}`, { status: 'rejected', notes: rejectNotes }, { headers: getAdminHeaders() });
      setRejectUser(null);
      setRejectNotes('');
      showToast('KYC Rejected successfully', { type: 'success' });
      fetchKyc();
    } catch {
      showToast('Failed to reject KYC', { type: 'error' });
    }
  };

  const statusBadge = (status: string) => {
    const c: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
      approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
      rejected: 'bg-red-50 text-red-700 ring-red-600/20',
    };
    return c[status] || 'bg-gray-50 text-gray-700 ring-gray-600/20';
  };

  const roleBadge = (role: string) => {
    const c: Record<string, string> = {
      retailer: 'bg-blue-50 text-blue-700',
      supplier: 'bg-purple-50 text-purple-700',
      brand: 'bg-amber-50 text-amber-700',
      manufacturer: 'bg-emerald-50 text-emerald-700',
    };
    return c[role] || 'bg-gray-50 text-gray-700';
  };

  const timeAgo = (date: string | null) => {
    if (!date) return '—';
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <AdminLayout title="KYC Verification">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 capitalize">
          <option value="all">All Submissions</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <p className="text-xs text-gray-500 self-center">{total} submissions found</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Shield size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No KYC Submissions</p>
          <p className="text-sm text-gray-400 mt-1">No users have submitted verification documents yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-600">{u.name[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {u.kycStoreName ? (
                        <span className="text-sm font-medium text-indigo-700">{u.kycStoreName}</span>
                      ) : u.role !== 'customer' ? (
                        <span className="text-sm font-medium text-indigo-700">{u.name}</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${roleBadge(u.role)}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {u.kycDocumentUrl && (
                          <img src={u.kycDocumentUrl.startsWith('http') ? u.kycDocumentUrl : `${API_BASE}${u.kycDocumentUrl}`} alt="ID" className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200 hover:border-indigo-400 transition-colors"
                            onClick={() => setPreviewImg(u.kycDocumentUrl!.startsWith('http') ? u.kycDocumentUrl! : `${API_BASE}${u.kycDocumentUrl}`)} />
                        )}
                        {u.kycSelfieUrl && (
                          <img src={u.kycSelfieUrl.startsWith('http') ? u.kycSelfieUrl : `${API_BASE}${u.kycSelfieUrl}`} alt="Selfie" className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200 hover:border-indigo-400 transition-colors"
                            onClick={() => setPreviewImg(u.kycSelfieUrl!.startsWith('http') ? u.kycSelfieUrl! : `${API_BASE}${u.kycSelfieUrl}`)} />
                        )}
                        {u.kycStorePhoto && (
                          <img src={u.kycStorePhoto.startsWith('http') ? u.kycStorePhoto : `${API_BASE}${u.kycStorePhoto}`} alt="Store" className="w-10 h-10 rounded-lg object-cover cursor-pointer border border-gray-200 hover:border-indigo-400 transition-colors"
                            onClick={() => setPreviewImg(u.kycStorePhoto!.startsWith('http') ? u.kycStorePhoto! : `${API_BASE}${u.kycStorePhoto}`)} />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${statusBadge(u.kycStatus)}`}>
                        {u.kycStatus === 'pending' && <Clock size={12} />}
                        {u.kycStatus === 'approved' && <CheckCircle size={12} />}
                        {u.kycStatus === 'rejected' && <XCircle size={12} />}
                        {u.kycStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{timeAgo(u.kycSubmittedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setSelectedUser(u)} className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Review"><Eye size={15} /></button>
                        {u.kycStatus === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(u.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" title="Approve"><CheckCircle size={15} /></button>
                            <button onClick={() => { setRejectUser(u); setRejectNotes(''); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Reject"><XCircle size={15} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-indigo-600">{u.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.phone || '—'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${statusBadge(u.kycStatus)}`}>
                    {u.kycStatus}
                  </span>
                </div>
                <div className="flex gap-2 mb-3">
                  {u.kycDocumentUrl && (
                    <img src={u.kycDocumentUrl.startsWith('http') ? u.kycDocumentUrl : `${API_BASE}${u.kycDocumentUrl}`} alt="ID" className="w-16 h-16 rounded-lg object-cover border border-gray-200 cursor-pointer"
                      onClick={() => setPreviewImg(u.kycDocumentUrl!.startsWith('http') ? u.kycDocumentUrl! : `${API_BASE}${u.kycDocumentUrl}`)} />
                  )}
                  {u.kycSelfieUrl && (
                    <img src={u.kycSelfieUrl.startsWith('http') ? u.kycSelfieUrl : `${API_BASE}${u.kycSelfieUrl}`} alt="Selfie" className="w-16 h-16 rounded-lg object-cover border border-gray-200 cursor-pointer"
                      onClick={() => setPreviewImg(u.kycSelfieUrl!.startsWith('http') ? u.kycSelfieUrl! : `${API_BASE}${u.kycSelfieUrl}`)} />
                  )}
                  {u.kycStorePhoto && (
                    <img src={u.kycStorePhoto.startsWith('http') ? u.kycStorePhoto : `${API_BASE}${u.kycStorePhoto}`} alt="Store" className="w-16 h-16 rounded-lg object-cover border border-gray-200 cursor-pointer"
                      onClick={() => setPreviewImg(u.kycStorePhoto!.startsWith('http') ? u.kycStorePhoto! : `${API_BASE}${u.kycStorePhoto}`)} />
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(u.role)}`}>{u.role}</span>
                    <span className="text-xs text-gray-400">{timeAgo(u.kycSubmittedAt)}</span>
                  </div>
                  {u.kycStatus === 'pending' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleApprove(u.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle size={16} /></button>
                      <button onClick={() => { setRejectUser(u); setRejectNotes(''); }} className="p-1.5 rounded-lg bg-red-50 text-red-600"><XCircle size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1.5">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronLeft size={16} /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">KYC Review — {selectedUser.name}</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div><span className="text-gray-400 text-xs">Phone</span><p className="font-medium">{selectedUser.phone}</p></div>
              <div><span className="text-gray-400 text-xs">Role</span><p className="font-medium capitalize">{selectedUser.role}</p></div>
              <div><span className="text-gray-400 text-xs">Status</span><p className={`font-medium capitalize ${selectedUser.kycStatus === 'approved' ? 'text-emerald-600' : selectedUser.kycStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>{selectedUser.kycStatus}</p></div>
              <div><span className="text-gray-400 text-xs">Submitted</span><p className="font-medium">{selectedUser.kycSubmittedAt ? new Date(selectedUser.kycSubmittedAt).toLocaleDateString() : '—'}</p></div>
            </div>
            {selectedUser.kycStoreName && (
              <div className="bg-indigo-50 text-indigo-700 text-sm px-4 py-3 rounded-xl mb-4 border border-indigo-100">
                <strong>Intended Store Name:</strong> {selectedUser.kycStoreName}
              </div>
            )}
            {selectedUser.kycNotes && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                <strong>Rejection Notes:</strong> {selectedUser.kycNotes}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">ID Document</p>
                {selectedUser.kycDocumentUrl ? (
                  <img src={selectedUser.kycDocumentUrl.startsWith('http') ? selectedUser.kycDocumentUrl : `${API_BASE}${selectedUser.kycDocumentUrl}`} alt="Document" className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer" onClick={() => setPreviewImg(selectedUser.kycDocumentUrl!.startsWith('http') ? selectedUser.kycDocumentUrl! : `${API_BASE}${selectedUser.kycDocumentUrl}`)} />
                ) : <div className="w-full h-32 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300">No document</div>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Selfie</p>
                {selectedUser.kycSelfieUrl ? (
                  <img src={selectedUser.kycSelfieUrl.startsWith('http') ? selectedUser.kycSelfieUrl : `${API_BASE}${selectedUser.kycSelfieUrl}`} alt="Selfie" className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer" onClick={() => setPreviewImg(selectedUser.kycSelfieUrl!.startsWith('http') ? selectedUser.kycSelfieUrl! : `${API_BASE}${selectedUser.kycSelfieUrl}`)} />
                ) : <div className="w-full h-32 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300">No selfie</div>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Store photo</p>
                {selectedUser.kycStorePhoto ? (
                  <img src={selectedUser.kycStorePhoto.startsWith('http') ? selectedUser.kycStorePhoto : `${API_BASE}${selectedUser.kycStorePhoto}`} alt="Store" className="w-full h-32 object-cover rounded-xl border border-gray-200 cursor-pointer" onClick={() => setPreviewImg(selectedUser.kycStorePhoto!.startsWith('http') ? selectedUser.kycStorePhoto! : `${API_BASE}${selectedUser.kycStorePhoto}`)} />
                ) : <div className="w-full h-32 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300">No photo</div>}
              </div>
            </div>
            {selectedUser.kycStatus === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => handleApprove(selectedUser.id)} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Approve
                </button>
                <button onClick={() => { setRejectUser(selectedUser); setSelectedUser(null); setRejectNotes(''); }} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 flex items-center justify-center gap-2">
                  <XCircle size={16} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRejectUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Reject KYC for {rejectUser.name}</h3>
            <p className="text-sm text-gray-500 mb-3">Please provide a reason for rejection so the user can resubmit.</p>
            <textarea value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} placeholder="e.g., Document is blurry, please re-upload..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-500/40" />
            <div className="flex gap-2">
              <button onClick={() => setRejectUser(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleReject} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <button onClick={() => setPreviewImg(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30"><X size={20} /></button>
          <img src={previewImg} alt="Preview" className="max-w-full max-h-[85vh] rounded-xl object-contain" />
        </div>
      )}
    </AdminLayout>
  );
}
