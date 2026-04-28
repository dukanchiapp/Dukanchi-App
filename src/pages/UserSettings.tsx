import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Bookmark, MapPin, History, Star, Store, Upload, Eye, CreditCard, Megaphone, AlertTriangle, HelpCircle, MessageSquare, LogOut, ChevronRight, Layers, Trash2, Check, X, Users, Phone, Lock, Plus, UserMinus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user, token, isTeamMember, logout } = useAuth();
  const { showToast, showConfirm } = useToast();
  
  const isBusinessOwner = ['retailer', 'supplier', 'brand', 'manufacturer'].includes(user?.role || '') && !isTeamMember;
  const isRetailer = ['retailer', 'supplier', 'brand', 'manufacturer'].includes(user?.role || '');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  const [store, setStore] = useState<any>(null);

  // Manage Posts state
  const [managePosts, setManagePosts] = useState<any[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [teamError, setTeamError] = useState('');

  // Customer data
  const [followedStores, setFollowedStores] = useState<any[]>([]);
  const [savedItems, setSavedItems] = useState<{saved: any[], posts: any[]}>({ saved: [], posts: [] });
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);

  // Logout and Delete confirmation
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'single' | 'selected' | 'all', postId?: string } | null>(null);

  useEffect(() => {
     if (isRetailer && user?.id) {
        fetch(`/api/users/${user.id}/store`, { credentials: 'include' })
           .then(res => res.json())
           .then(data => { if (data) setStore(data); })
           .catch(console.error);
     }
  }, [user, isRetailer]);

  // Fetch posts when Manage Posts tab is active
  useEffect(() => {
    if (activeTab === 'manage_posts' && store?.id) fetchStorePosts();
  }, [activeTab, store]);

  // Fetch team when Manage Team tab is active
  useEffect(() => {
    if (activeTab === 'manage_team' && store?.id) fetchTeamMembers();
  }, [activeTab, store]);

  // Fetch customer data on tab activation
  useEffect(() => {
    if (!user?.id || !token || isRetailer) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    if (activeTab === 'following') {
      setCustomerLoading(true);
      fetch(`/api/users/${user.id}/following`, { credentials: 'include',  headers })
        .then(r => r.json()).then(setFollowedStores).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'saved') {
      setCustomerLoading(true);
      fetch(`/api/users/${user.id}/saved`, { credentials: 'include',  headers })
        .then(r => r.json()).then(setSavedItems).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'history') {
      setCustomerLoading(true);
      fetch(`/api/users/${user.id}/search-history`, { credentials: 'include',  headers })
        .then(r => r.json()).then(setSearchHistory).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'locations') {
      setCustomerLoading(true);
      fetch(`/api/users/${user.id}/locations`, { credentials: 'include',  headers })
        .then(r => r.json()).then(setSavedLocations).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'reviews') {
      setCustomerLoading(true);
      fetch(`/api/users/${user.id}/reviews`, { credentials: 'include',  headers })
        .then(r => r.json()).then(setUserReviews).catch(console.error).finally(() => setCustomerLoading(false));
    }
  }, [activeTab, user, token, isRetailer]);

  const fetchStorePosts = async () => {
    if (!store) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(`/api/stores/${store.id}/posts?limit=100`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setManagePosts(Array.isArray(data) ? data : (data.posts ?? []));
      }
    } catch (e) { console.error(e); }
    setLoadingPosts(false);
  };

  const fetchTeamMembers = async () => {
    if (!store) return;
    setTeamLoading(true);
    setTeamError('');
    try {
      const res = await fetch(`/api/team/${store.id}`, { credentials: 'include', 
        
      });
      if (res.ok) {
        setTeamMembers(await res.json());
      } else {
        const data = await res.json();
        setTeamError(data.error || 'Failed to load team');
      }
    } catch (e) { console.error(e); }
    setTeamLoading(false);
  };

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !newMemberName.trim() || !newMemberPhone.trim() || !newMemberPassword.trim()) {
      setTeamError('All fields are required: name, phone, and password.');
      return;
    }
    setTeamError('');
    try {
      const res = await fetch('/api/team', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ phone: newMemberPhone, password: newMemberPassword, storeId: store.id, name: newMemberName || 'Team Member' })
      });
      const data = await res.json();
      if (res.ok) {
        setTeamMembers(prev => [...prev, data]);
        setNewMemberPhone(''); setNewMemberPassword(''); setNewMemberName('');
        setShowAddMember(false);
      } else {
        setTeamError(data.error || 'Failed to add member');
      }
    } catch (e) { setTeamError('Network error'); }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    showConfirm('Remove this team member? They will immediately lose access.', {
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/team/${memberId}`, { credentials: 'include', 
            method: 'DELETE',
            
          });
          if (res.ok) {
            setTeamMembers(prev => prev.filter(m => m.id !== memberId));
            showToast('Team member removed successfully.', { type: 'success' });
          } else {
            const d = await res.json();
            showToast(d.error || 'Failed to remove', { type: 'error' });
          }
        } catch (e) {
          console.error(e);
          showToast('Network error', { type: 'error' });
        }
      }
    });
  };

  // Build tabs based on role
  const retailerTabs = [
     { id: 'details', label: 'Sign-up Details', icon: User },
     { id: 'manage_posts', label: 'Manage Posts', icon: Layers },
     ...(isBusinessOwner ? [{ id: 'manage_team', label: 'Manage Team', icon: Users }] : []),
     { id: 'bulk_upload', label: 'Upload Bulk Products', icon: Upload },
     ...(isBusinessOwner ? [
       { id: 'visibility', label: 'Hide/Show Ratings', icon: Eye },
       { id: 'chat_settings', label: 'Enable/Disable Chat', icon: MessageSquare },
       { id: 'subscription', label: 'Subscription', icon: CreditCard },
       { id: 'marketing', label: 'Store Marketing', icon: Megaphone },
       { id: 'report', label: 'Report Fake User', icon: AlertTriangle },
       { id: 'help', label: 'Help & Feedback', icon: HelpCircle },
     ] : []),
  ];

  const customerTabs = [
     { id: 'details', label: 'Personal Details', icon: User },
     { id: 'following', label: 'Following', icon: Store },
     { id: 'saved', label: 'Saved', icon: Bookmark },
     { id: 'locations', label: 'Locations', icon: MapPin },
     { id: 'history', label: 'History', icon: History },
     { id: 'reviews', label: 'My Reviews', icon: Star },
  ];

  const tabs = isRetailer ? retailerTabs : customerTabs;

  const handleToggleStoreSetting = async (key: string, value: boolean) => {
      if (!store) return;
      try {
         const res = await fetch(`/api/stores/${store.id}`, { credentials: 'include', 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ [key]: value })
         });
         if (res.ok) setStore({ ...store, [key]: value });
      } catch (e) { console.error(e); }
  };

  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; mappingUsed: Record<string, string> } | null>(null);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store?.id) return;
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/stores/${store.id}/bulk-import`, {
        credentials: 'include',
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ imported: data.imported, skipped: data.skipped, mappingUsed: data.mappingUsed });
        showToast(`✓ ${data.imported} products imported${data.skipped ? `, ${data.skipped} skipped` : ''}`, { type: 'success' });
      } else {
        showToast(data.error || 'Import failed', { type: 'error' });
      }
    } catch (err) {
      showToast('Upload failed. Check your connection.', { type: 'error' });
    } finally {
      setImportLoading(false);
    }
  };

  const togglePostSelection = (postId: string) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const handleDeleteSelectedPosts = () => {
    if (selectedPostIds.size === 0) return;
    showConfirm(`Delete these ${selectedPostIds.size} posts? This action cannot be undone.`, {
      type: 'error',
      onConfirm: confirmDeleteSelectedPosts
    });
  };
  const confirmDeleteSelectedPosts = async () => {
    try {
      for (const postId of selectedPostIds) {
        const res = await fetch(`/api/posts/${postId}`, { credentials: 'include',  method: 'DELETE',  });
        if (!res.ok) throw new Error(`Failed to delete post ${postId}`);
      }
      setManagePosts(prev => prev.filter(p => !selectedPostIds.has(p.id)));
      setSelectedPostIds(new Set());
      showToast('Selected posts deleted.', { type: 'success' });
    } catch (e) {
      console.error(e);
      showToast("Failed to delete selected posts.", { type: 'error' });
    }
  };

  const handleDeleteAllPosts = () => {
    if (!store) return;
    showConfirm('Delete all your posts? This action cannot be undone.', {
      type: 'error',
      onConfirm: confirmDeleteAllPosts
    });
  };
  const confirmDeleteAllPosts = async () => {
    try {
      const res = await fetch(`/api/stores/${store.id}/posts`, { credentials: 'include',  method: 'DELETE',  });
      if (!res.ok) throw new Error('Failed to delete all posts');
      setManagePosts([]);
      setSelectedPostIds(new Set());
      showToast('All posts deleted.', { type: 'success' });
    } catch (e) {
      console.error(e);
      showToast("Failed to delete all posts.", { type: 'error' });
    }
  };

  const handleDeleteSinglePost = (postId: string) => {
    showConfirm('Delete this post? This action cannot be undone.', {
      type: 'error',
      onConfirm: () => confirmDeleteSinglePost(postId)
    });
  };
  const confirmDeleteSinglePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, { credentials: 'include',  method: 'DELETE',  });
      if (!res.ok) throw new Error('Failed to delete post');
      setManagePosts(prev => prev.filter(p => p.id !== postId));
      setSelectedPostIds(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      showToast('Post deleted.', { type: 'success' });
    } catch (e) {
      console.error(e);
      showToast("Failed to delete post.", { type: 'error' });
    }
  };

  const handleLogout = () => { 
    showConfirm('Are you sure you want to log out?', {
      onConfirm: () => {
        logout(); 
        navigate('/login'); 
      }
    });
  };

  const SkeletonList = () => (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 animate-pulse flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
          <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/2"></div><div className="h-2 bg-gray-200 rounded w-1/3"></div></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen pb-20">
      <header className="bg-white px-4 py-4 sticky top-0 z-20 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => activeTab ? setActiveTab(null) : navigate(-1)} className="mr-3 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {activeTab ? tabs.find(t => t.id === activeTab)?.label || 'Settings' : 'Settings'}
          </h1>
        </div>
        <NotificationBell />
      </header>

      <main className="p-4">
        {/* Main List — always show when no active tab */}
        {!activeTab && (
          <div className="space-y-3">
            {isTeamMember && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
                <p className="text-xs text-indigo-600 font-medium">You're logged in as a team member. Some settings are restricted.</p>
              </div>
            )}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-center text-gray-700"><Icon size={20} className="mr-3 text-indigo-500" /><span className="text-sm font-medium">{tab.label}</span></div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={handleLogout} className="w-full bg-white border border-red-200 text-red-600 font-semibold py-3 rounded-xl flex items-center justify-center hover:bg-red-50 transition-colors">
              <LogOut size={18} className="mr-2" /> Log Out
            </button>
          </div>
        )}

        {/* Active Tab Content */}
        {activeTab && (
          <div className="space-y-4">
            {/* === SHARED TABS === */}
            {activeTab === 'details' && (
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
                        const res = await fetch(`/api/users/${user?.id}`, { credentials: 'include', 
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ name, phone, email })
                        });
                        if (res.ok) {
                          showToast('Details updated successfully!', { type: 'success' });
                        } else {
                          showToast('Failed to update details.', { type: 'error' });
                        }
                      } catch (e) {
                         showToast('Error updating details.', { type: 'error' });
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* === CUSTOMER TABS === */}
            {!isRetailer && (
              <>
                {activeTab === 'following' && (
                  customerLoading ? <SkeletonList /> : followedStores.length > 0 ? (
                    <div className="space-y-2">
                      {followedStores.map(s => (
                        <Link key={s.id} to={`/store/${s.id}`} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors block">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">{s.storeName?.charAt(0)}</div>
                          <div className="flex-1"><h3 className="font-semibold text-sm text-gray-900">{s.storeName}</h3><p className="text-xs text-gray-500">{s.category}</p></div>
                          <ChevronRight size={16} className="text-gray-400" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                      <Store className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">You aren't following any stores yet.</p>
                      <Link to="/search" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Discover local businesses</Link>
                    </div>
                  )
                )}
                {activeTab === 'saved' && (
                  customerLoading ? <SkeletonList /> : savedItems.posts.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1">
                      {savedItems.posts.map(p => (
                        <div key={p.id} className="aspect-square relative rounded-lg overflow-hidden">
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                          <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[90%]">{p.store?.storeName}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                      <Bookmark className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No saved posts yet.</p>
                      <Link to="/" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Browse feed</Link>
                    </div>
                  )
                )}
                {activeTab === 'locations' && (
                  customerLoading ? <SkeletonList /> : savedLocations.length > 0 ? (
                    <div className="space-y-2">
                      {savedLocations.map(loc => (
                        <div key={loc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3">
                          <MapPin size={18} className="text-indigo-500 flex-shrink-0" />
                          <div><h3 className="font-semibold text-sm text-gray-900">{loc.locationName}</h3><p className="text-xs text-gray-400">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                      <MapPin className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No saved locations.</p>
                      <Link to="/map" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Explore map</Link>
                    </div>
                  )
                )}
                {activeTab === 'history' && (
                  customerLoading ? <SkeletonList /> : searchHistory.length > 0 ? (
                    <div className="space-y-2">
                      {searchHistory.map(h => (
                        <div key={h.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3">
                          <History size={16} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1"><span className="text-sm text-gray-900">{h.query}</span></div>
                          <span className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                      <History className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">Search history is empty.</p>
                    </div>
                  )
                )}
                {activeTab === 'reviews' && (
                  customerLoading ? <SkeletonList /> : userReviews.length > 0 ? (
                    <div className="space-y-3">
                      {userReviews.map(r => (
                        <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <span className="text-sm font-semibold text-gray-900">{r.store?.storeName || r.product?.productName || 'Unknown'}</span>
                              <div className="mt-1"><StarRating rating={r.rating} size={12} /></div>
                            </div>
                            <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                          {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                      <Star className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">You haven't left any reviews yet.</p>
                    </div>
                  )
                )}
              </>
            )}

            {/* === BUSINESS TABS === */}
            {isRetailer && (
              <>
                {/* ======= MANAGE POSTS ======= */}
                {activeTab === 'manage_posts' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">{managePosts.length} post{managePosts.length !== 1 ? 's' : ''}</span>
                      <div className="flex space-x-2">
                        {selectedPostIds.size > 0 && (
                          <button onClick={handleDeleteSelectedPosts} className="text-red-600 text-xs font-semibold px-3 py-1.5 bg-red-50 rounded-lg flex items-center hover:bg-red-100 transition-colors"><Trash2 size={12} className="mr-1" /> Delete ({selectedPostIds.size})</button>
                        )}
                        {managePosts.length > 0 && (
                          <button onClick={handleDeleteAllPosts} className="text-red-600 text-xs font-semibold px-3 py-1.5 bg-red-50 rounded-lg flex items-center hover:bg-red-100 transition-colors"><Trash2 size={12} className="mr-1" /> Delete All</button>
                        )}
                      </div>
                    </div>
                    {loadingPosts ? <SkeletonList /> : managePosts.length === 0 ? (
                      <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
                        <Layers className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No posts to manage.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {managePosts.map(post => (
                          <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex items-center">
                            <button onClick={() => togglePostSelection(post.id)} className={`flex-shrink-0 w-10 h-full flex items-center justify-center border-r border-gray-100 ${selectedPostIds.has(post.id) ? 'bg-indigo-50' : 'bg-white'}`}>
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedPostIds.has(post.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                {selectedPostIds.has(post.id) && <Check size={12} className="text-white" />}
                              </div>
                            </button>
                            <div className="w-16 h-16 flex-shrink-0 bg-gray-100"><img src={post.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" /></div>
                            <div className="flex-1 px-3 py-2 min-w-0">
                              <p className="text-sm text-gray-900 font-medium truncate">{post.caption || 'No caption'}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
                              {post.isPinned && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">Pinned</span>}
                            </div>
                            <button onClick={() => handleDeleteSinglePost(post.id)} className="flex-shrink-0 p-3 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ======= MANAGE TEAM ======= */}
                {activeTab === 'manage_team' && isBusinessOwner && (
                  <div className="space-y-4">
                    {/* Owner info */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{user?.name?.charAt(0) || 'O'}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-gray-900">{user?.name}</h3>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Owner</span>
                    </div>

                    {/* Team members list */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Team Members ({teamMembers.length}/{3})
                        </h3>
                        {teamMembers.length < 3 ? (
                          <button onClick={() => setShowAddMember(true)} className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center hover:bg-indigo-100 transition-colors">
                            <Plus size={14} className="mr-1" /> Add Member
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">Limit reached (3/3)</span>
                        )}
                      </div>

                      {teamError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3 flex items-start">
                          <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />{teamError}
                        </div>
                      )}

                      {teamLoading ? <SkeletonList /> : teamMembers.length === 0 ? (
                        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100 text-gray-500">
                          <Users className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                          <p className="text-sm">No team members yet.</p>
                          <p className="text-xs text-gray-400 mt-1">Add members so they can manage your business account.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {teamMembers.map(member => (
                            <div key={member.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">
                                {member.name?.charAt(0) || 'T'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm text-gray-900 truncate">{member.name}</h4>
                                <div className="flex items-center text-xs text-gray-500 mt-0.5">
                                  <Phone size={10} className="mr-1" />{member.phone}
                                </div>
                              </div>
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">{member.role}</span>
                              <button onClick={() => handleRemoveTeamMember(member.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                <UserMinus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add Member Modal */}
                    {showAddMember && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={() => setShowAddMember(false)}>
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                          <h3 className="text-lg font-bold text-gray-900 mb-4">Add Team Member</h3>
                          <form onSubmit={handleAddTeamMember} className="space-y-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Name *</label>
                              <input type="text" required value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" placeholder="e.g. Rahul" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                              <div className="relative">
                                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="tel" required value={newMemberPhone} onChange={e => setNewMemberPhone(e.target.value)} className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" placeholder="+91 XXXXX XXXXX" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Password *</label>
                              <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="password" required minLength={4} value={newMemberPassword} onChange={e => setNewMemberPassword(e.target.value)} className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" placeholder="Minimum 4 characters" />
                              </div>
                            </div>
                            {teamError && <p className="text-xs text-red-500">{teamError}</p>}
                            <div className="flex space-x-3 pt-2">
                              <button type="button" onClick={() => { setShowAddMember(false); setTeamError(''); }} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                              <button type="submit" className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Add Member</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ======= BULK UPLOAD ======= */}
                {activeTab === 'bulk_upload' && (
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Upload size={20} className="text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">Import from Excel / CSV</h3>
                          <p className="text-xs text-gray-500">AI auto-detects your columns — any format works</p>
                        </div>
                      </div>

                      <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors ${importLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {importLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            AI is reading your file…
                          </>
                        ) : (
                          <>
                            <Upload size={15} /> Import from Excel / CSV
                          </>
                        )}
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          disabled={importLoading}
                          onChange={handleBulkUpload}
                        />
                      </label>

                      <p className="text-xs text-gray-400 text-center mt-2">
                        Supports any .xlsx, .xls or .csv format · Max 1,000 rows · 5 MB
                      </p>

                      {importResult && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
                          <p className="font-semibold text-green-800">
                            ✓ {importResult.imported} products imported{importResult.skipped > 0 ? `, ${importResult.skipped} skipped` : ''}
                          </p>
                          <p className="text-green-700 text-xs mt-1">
                            Columns detected: {Object.entries(importResult.mappingUsed).map(([k, v]) => `${v} → ${k}`).join(', ')}
                          </p>
                          <Link to="/profile" className="text-indigo-600 text-xs font-medium mt-1 inline-block hover:underline">
                            View imported products →
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                      <h3 className="font-bold text-gray-900 mb-2">Add Products Manually</h3>
                      <p className="text-sm text-gray-500 mb-4">Type or paste your product details below. This text will be searchable by customers.</p>
                      <textarea 
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed" 
                        rows={8} 
                        maxLength={6000}
                        placeholder="Example:&#10;Samsung Galaxy S24 - ₹79,999&#10;iPhone 15 Pro Max - ₹1,59,900&#10;OnePlus 12 - ₹64,999&#10;&#10;List your products, prices, brands, categories..."
                        defaultValue={store?.manualProductText || ''}
                        id="manualProductText"
                      />
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-xs text-gray-400">Max 6,000 characters</span>
                        <button 
                          onClick={async () => {
                            const text = (document.getElementById('manualProductText') as HTMLTextAreaElement)?.value || '';
                            if (!store?.id) { showToast('Store not found', { type: 'error' }); return; }
                            try {
                              const res = await fetch(`/api/stores/${store.id}`, { credentials: 'include', 
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ manualProductText: text })
                              });
                              if (res.ok) {
                                setStore({ ...store, manualProductText: text });
                                showToast('✅ Products saved successfully!', { type: 'success' });
                              } else {
                                showToast('Failed to save. Please try again.', { type: 'error' });
                              }
                            } catch (e) { console.error(e); showToast('Error saving products.', { type: 'error' }); }
                          }}
                          className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors flex items-center"
                        >
                          <Plus size={14} className="mr-1.5" /> Save Products
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'visibility' && isBusinessOwner && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div><h3 className="font-bold text-gray-900">Hide Ratings</h3><p className="text-xs text-gray-500 mt-1">When enabled, the Reviews tab is hidden from your public profile.</p></div>
                      <button onClick={() => handleToggleStoreSetting('hideRatings', !store?.hideRatings)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${store?.hideRatings ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${store?.hideRatings ? 'translate-x-6' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === 'chat_settings' && isBusinessOwner && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div><h3 className="font-bold text-gray-900">Enable Direct Chat</h3><p className="text-xs text-gray-500 mt-1">Allow customers to message you directly.</p></div>
                      <button onClick={() => handleToggleStoreSetting('chatEnabled', !store?.chatEnabled)} className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ml-4 ${store?.chatEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
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
                          const res = await fetch('/api/complaints', { credentials: 'include', 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ issueType: 'fake_user', description })
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
                          const res = await fetch('/api/complaints', { credentials: 'include', 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ issueType: 'feedback', description })
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
            )}
          </div>
        )}
      </main>
    </div>
  );
}
