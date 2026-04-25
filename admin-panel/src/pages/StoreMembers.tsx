import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Users, Store, Search, ChevronRight, X, Trash2, Phone, Mail, Crown, UserCheck, Shield, Calendar, MapPin, Download } from 'lucide-react';
import api, { getAdminHeaders, imgUrl, API_URL } from '../lib/api';

interface StoreOwner {
  id: string;
  name: string;
  phone: string;
  role: string;
  email?: string;
  createdAt?: string;
}

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  createdAt: string;
}

interface StoreRow {
  id: string;
  storeName: string;
  category: string;
  logoUrl?: string | null;
  createdAt: string;
  address?: string;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  owner: StoreOwner;
  _count: { teamMembers: number };
}

interface StoreDetail {
  id: string;
  storeName: string;
  category: string;
  logoUrl?: string | null;
  address?: string;
  city?: string | null;
  state?: string | null;
  postalCode?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string;
  createdAt: string;
  owner: StoreOwner;
  teamMembers: TeamMember[];
}

const MEMBER_LIMIT = 3;

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    retailer: 'bg-blue-50 text-blue-700',
    supplier: 'bg-purple-50 text-purple-700',
    brand: 'bg-amber-50 text-amber-700',
    manufacturer: 'bg-emerald-50 text-emerald-700',
    customer: 'bg-gray-50 text-gray-700',
    admin: 'bg-red-50 text-red-700',
  };
  return map[role] || 'bg-gray-50 text-gray-700';
};

export default function StoreMembers() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/store-members', { headers: getAdminHeaders() });
      setStores(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const openStore = async (storeId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/admin/store-members/${storeId}`, { headers: getAdminHeaders() });
      setSelectedStore(res.data);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    setDeletingId(member.id);
    try {
      await api.delete(`/api/admin/team/${member.id}`, { headers: getAdminHeaders() });
      setSelectedStore(prev =>
        prev ? { ...prev, teamMembers: prev.teamMembers.filter(m => m.id !== member.id) } : prev
      );
      setStores(prev =>
        prev.map(s =>
          s.id === selectedStore?.id
            ? { ...s, _count: { teamMembers: s._count.teamMembers - 1 } }
            : s
        )
      );
    } catch {
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleExport = () => {
    const url = `${API_URL}/api/admin/stores/export`;
    const a = document.createElement('a');
    a.href = url;
    // Attach token via a temporary fetch → blob download (CORS-safe)
    fetch(url, { credentials: 'include',   })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `stores-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      });
  };

  const filtered = stores.filter(s =>
    !search ||
    s.storeName.toLowerCase().includes(search.toLowerCase()) ||
    s.owner.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Store Members">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-140px)]">

        {/* Store List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Store size={18} className="text-indigo-600" /> All Stores
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 font-medium">
                  {filtered.length}
                </span>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  title="Download all stores as CSV"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search stores or owners..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Store size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No stores found</p>
              </div>
            ) : (
              filtered.map(store => (
                <button
                  key={store.id}
                  onClick={() => openStore(store.id)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-3 group ${selectedStore?.id === store.id ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {store.logoUrl ? (
                      <img src={imgUrl(store.logoUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store size={18} className="text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{store.storeName}</p>
                    <p className="text-xs text-gray-500 truncate">{store.owner.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${roleBadge(store.owner.role)}`}>{store.owner.role}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Users size={10} />
                        {store._count.teamMembers}/{MEMBER_LIMIT} members
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 ${selectedStore?.id === store.id ? 'text-indigo-400' : ''}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Store Detail Panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : !selectedStore ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <Users size={32} className="opacity-20 text-indigo-600" />
              </div>
              <h3 className="text-gray-900 font-bold mb-1">Select a Store</h3>
              <p className="text-sm max-w-[220px]">Click on a store to view the store admin and all team members.</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="p-5 border-b border-gray-50 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedStore.logoUrl ? (
                      <img src={imgUrl(selectedStore.logoUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store size={24} className="text-indigo-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedStore.storeName}</h3>
                    <p className="text-xs text-gray-500">{selectedStore.category}</p>
                    {selectedStore.address && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[selectedStore.address, selectedStore.city, selectedStore.state, selectedStore.postalCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {selectedStore.latitude && selectedStore.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedStore.latitude},${selectedStore.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 mt-1 font-medium"
                      >
                        <MapPin size={10} /> View on Maps · {selectedStore.latitude.toFixed(5)}, {selectedStore.longitude.toFixed(5)}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-semibold border border-indigo-100">
                    {selectedStore.teamMembers.length}/{MEMBER_LIMIT} members
                  </span>
                  <button onClick={() => setSelectedStore(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Store Admin card */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Crown size={12} className="text-amber-500" /> Store Admin
                  </p>
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg flex-shrink-0">
                      {selectedStore.owner.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{selectedStore.owner.name}</span>
                        <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Shield size={9} /> Store Admin
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(selectedStore.owner.role)}`}>
                          {selectedStore.owner.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{selectedStore.owner.phone}</span>
                        {selectedStore.owner.email && (
                          <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={11} />{selectedStore.owner.email}</span>
                        )}
                        {selectedStore.owner.createdAt && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar size={11} />Joined {new Date(selectedStore.owner.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCheck size={12} className="text-indigo-500" />
                    Store Members
                    <span className="ml-1 bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                      {selectedStore.teamMembers.length}/{MEMBER_LIMIT} slots used
                    </span>
                  </p>

                  {selectedStore.teamMembers.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center text-gray-400">
                      <Users size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No team members added yet</p>
                      <p className="text-xs mt-1">The store owner can add up to {MEMBER_LIMIT} members</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedStore.teamMembers.map(member => (
                        <div key={member.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                            {member.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-900">{member.name}</span>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium capitalize flex items-center gap-1">
                                <UserCheck size={9} /> Store Member
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{member.phone}</span>
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={11} />Added {new Date(member.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setConfirmDelete(member)}
                            disabled={deletingId === member.id}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Remove Team Member?</h3>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-semibold text-gray-800">{confirmDelete.name}</span> ({confirmDelete.phone})
            </p>
            <p className="text-sm text-gray-500 mb-6">This member will immediately lose access to the store account.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMember(confirmDelete)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingId ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
