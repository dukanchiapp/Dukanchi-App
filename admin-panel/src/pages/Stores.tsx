import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Search, ChevronLeft, ChevronRight, Trash2, Star, Users, Package, MapPin, ShieldAlert, ShieldCheck, Image, KeyRound, X, Eye, EyeOff, Download } from 'lucide-react';
import api, { getAdminHeaders, API_URL } from '../lib/api';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface StoreData {
  id: string; storeName: string; category: string; address: string; averageRating: number | null; reviewCount: number; createdAt: string;
  logoUrl: string | null; ownerId: string;
  city?: string | null; state?: string | null; postalCode?: number | null;
  latitude?: number | null; longitude?: number | null;
  owner: { name: string; phone: string; role: string; isBlocked: boolean };
  _count: { followers: number; posts: number; products: number };
}

export default function Stores() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetStore, setResetStore] = useState<StoreData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { showToast } = useToast();

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/stores', { 
        headers: getAdminHeaders(), 
        params: { search, page, limit: 15 } 
      });
      setStores(res.data.stores);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { 
    fetchStores(); 
  }, [fetchStores]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchStores(); };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/admin/stores/${id}`, { headers: getAdminHeaders() });
      setDeleteConfirm(null);
      showToast('Store deleted successfully', { type: 'success' });
      fetchStores();
    } catch {
      showToast('Failed to delete store', { type: 'error' });
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('adminToken');
    fetch(`${API_URL}/api/admin/stores/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stores-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  };

  const handleToggleBlockOwner = async (store: StoreData) => {
    try {
      await api.put(`/api/admin/users/${store.ownerId}`, { isBlocked: !store.owner.isBlocked }, { headers: getAdminHeaders() });
      showToast(`${store.storeName} owner ${store.owner.isBlocked ? 'unblocked' : 'blocked'} successfully`, { type: 'success' });
      fetchStores();
    } catch {
      showToast('Failed to change block status', { type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetStore) return;
    setResetting(true);
    try {
      await api.post(`/api/admin/reset-password`, { userId: resetStore.ownerId, newPassword }, { headers: getAdminHeaders() });
      showToast(`Password reset for ${resetStore.owner.name}`, { type: 'success' });
      setResetStore(null);
      setNewPassword('');
    } catch {
      showToast('Failed to reset password', { type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const roleBadge = (role: string) => {
    const c: Record<string, string> = {
      retailer: 'bg-blue-50 text-blue-700 ring-blue-600/20',
      supplier: 'bg-purple-50 text-purple-700 ring-purple-600/20',
      brand: 'bg-amber-50 text-amber-700 ring-amber-600/20',
      manufacturer: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    };
    return c[role] || 'bg-gray-50 text-gray-700 ring-gray-600/20';
  };

  return (
    <AdminLayout title="Store Directory">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stores or categories..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300" />
        </form>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
          title="Download all stores as XLSX for Google Sheets"
        >
          <Download size={15} /> Export XLSX
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">{total} stores found</p>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Store</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rating</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stats</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stores.map(s => (
                  <tr key={s.id} className={`hover:bg-gray-50/50 transition-colors ${s.owner.isBlocked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      {s.logoUrl ? (
                        <img src={`${API_BASE}${s.logoUrl}`} alt={s.storeName} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Image size={16} className="text-gray-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-900">{s.storeName}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">
                        {[s.address, s.city, s.state].filter(Boolean).join(', ')}
                      </p>
                      {s.latitude && s.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 mt-0.5 font-medium"
                        >
                          <MapPin size={9} /> {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                        </a>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-700">{s.owner.name}</p>
                      <p className="text-xs text-gray-400">{s.owner.phone}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${roleBadge(s.owner?.role || 'retailer')}`}>{s.owner?.role || 'retailer'}</span>
                    </td>
                    <td className="px-5 py-3"><span className="px-2.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full">{s.category}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        <span className="text-sm font-medium text-gray-700">{s.averageRating?.toFixed(1) || '—'}</span>
                        <span className="text-xs text-gray-400">({s.reviewCount})</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Users size={12} />{s._count.followers}</span>
                        <span className="flex items-center gap-1"><Package size={12} />{s._count.products}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {s.owner.isBlocked ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-red-600"><ShieldAlert size={12} /> BLOCKED</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"><ShieldCheck size={12} /> Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => handleToggleBlockOwner(s)} className={`p-1.5 rounded-lg transition-colors ${s.owner.isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-orange-600 hover:bg-orange-50'}`} title={s.owner.isBlocked ? 'Unblock Business' : 'Block Business'}>
                          {s.owner.isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                        </button>
                        <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete store"><Trash2 size={15} /></button>
                        <button onClick={() => { setResetStore(s); setNewPassword(''); setShowPassword(false); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Reset Password"><KeyRound size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {stores.map(s => (
              <div key={s.id} className={`bg-white rounded-xl border p-4 ${s.owner.isBlocked ? 'border-red-200 bg-red-50/20' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.logoUrl ? (
                      <img src={`${API_BASE}${s.logoUrl}`} alt={s.storeName} className="w-11 h-11 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Image size={16} className="text-gray-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{s.storeName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.owner.name}</p>
                      <span className={`inline-flex mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1 ring-inset ${roleBadge(s.owner.role)}`}>{s.owner.role}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="px-2.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 rounded-full">{s.category}</span>
                    {s.owner.isBlocked && <span className="text-[10px] font-bold text-red-600 uppercase">Blocked</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <MapPin size={12} className="text-gray-400" />
                  <p className="text-xs text-gray-400 truncate">{s.address}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" />{s.averageRating?.toFixed(1) || '—'}</span>
                    <span className="flex items-center gap-1"><Users size={12} />{s._count.followers}</span>
                    <span className="flex items-center gap-1"><Package size={12} />{s._count.products}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => handleToggleBlockOwner(s)} className={`p-1.5 rounded-lg ${s.owner.isBlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`} title={s.owner.isBlocked ? 'Unblock Business' : 'Block Business'}>
                      {s.owner.isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                    </button>
                    <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete store"><Trash2 size={15} /></button>
                    <button onClick={() => { setResetStore(s); setNewPassword(''); setShowPassword(false); }} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600" title="Reset Password"><KeyRound size={15} /></button>
                  </div>
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

      {/* Reset Password Modal */}
      {resetStore && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setResetStore(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Reset Password</h3>
              <button onClick={() => setResetStore(null)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Set a new password for <strong className="text-gray-800">{resetStore.owner.name}</strong> ({resetStore.storeName})</p>
            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New password (min. 6 characters)"
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResetStore(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} disabled={newPassword.length < 6 || resetting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                {resetting ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-2">Delete Store?</h3>
            <p className="text-sm text-gray-500 mb-4">This will permanently remove the store and all associated data including posts and products.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
