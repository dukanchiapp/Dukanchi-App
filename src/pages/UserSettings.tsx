import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Bookmark, MapPin, History, Star, Store, Upload, Eye, CreditCard, Megaphone, AlertTriangle, HelpCircle, MessageSquare, LogOut, ChevronRight, Layers, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ManagePostsTab } from '../components/settings/ManagePostsTab';
import { ManageTeamTab } from '../components/settings/ManageTeamTab';
import { CustomerDataTabs } from '../components/settings/CustomerDataTabs';
import { AccountDetailsTab } from '../components/settings/AccountDetailsTab';
import { BulkUploadTab } from '../components/settings/BulkUploadTab';
import { BusinessSettingsTabs } from '../components/settings/BusinessSettingsTabs';
import { apiFetch } from '../lib/api';

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

  useEffect(() => {
    if (isRetailer && user?.id) {
      apiFetch(`/api/users/${user.id}/store`)
        .then(res => res.json())
        .then(data => { if (data) setStore(data); })
        .catch(console.error);
    }
  }, [user, isRetailer]);

  useEffect(() => {
    if (activeTab === 'manage_posts' && store?.id) fetchStorePosts();
  }, [activeTab, store]);

  useEffect(() => {
    if (activeTab === 'manage_team' && store?.id) fetchTeamMembers();
  }, [activeTab, store]);

  useEffect(() => {
    if (!user?.id || !token || isRetailer) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    if (activeTab === 'following') {
      setCustomerLoading(true);
      apiFetch(`/api/users/${user.id}/following`, { headers })
        .then(r => r.json()).then(setFollowedStores).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'saved') {
      setCustomerLoading(true);
      apiFetch(`/api/users/${user.id}/saved`, { headers })
        .then(r => r.json()).then(setSavedItems).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'history') {
      setCustomerLoading(true);
      apiFetch(`/api/users/${user.id}/search-history`, { headers })
        .then(r => r.json()).then(setSearchHistory).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'locations') {
      setCustomerLoading(true);
      apiFetch(`/api/users/${user.id}/locations`, { headers })
        .then(r => r.json()).then(setSavedLocations).catch(console.error).finally(() => setCustomerLoading(false));
    }
    if (activeTab === 'reviews') {
      setCustomerLoading(true);
      apiFetch(`/api/users/${user.id}/reviews`, { headers })
        .then(r => r.json()).then(setUserReviews).catch(console.error).finally(() => setCustomerLoading(false));
    }
  }, [activeTab, user, token, isRetailer]);

  const fetchStorePosts = async () => {
    if (!store) return;
    setLoadingPosts(true);
    try {
      const res = await apiFetch(`/api/stores/${store.id}/posts?limit=100`);
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
      const res = await apiFetch(`/api/team/${store.id}`);
      if (res.ok) {
        setTeamMembers(await res.json());
      } else {
        const data = await res.json();
        setTeamError(data.error || 'Failed to load team');
      }
    } catch (e) { console.error(e); }
    setTeamLoading(false);
  };

  const handleAddTeamMember = async () => {
    if (!store || !newMemberName.trim() || !newMemberPhone.trim() || !newMemberPassword.trim()) {
      setTeamError('All fields are required: name, phone, and password.');
      return;
    }
    setTeamError('');
    try {
      const res = await apiFetch('/api/team', {
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
          const res = await apiFetch(`/api/team/${memberId}`, { method: 'DELETE' });
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

  const handleTeamFieldChange = (field: string, value: string) => {
    if (field === 'newMemberPhone') setNewMemberPhone(value);
    else if (field === 'newMemberPassword') setNewMemberPassword(value);
    else if (field === 'newMemberName') setNewMemberName(value);
  };

  const handleToggleAddForm = () => {
    setShowAddMember(prev => !prev);
    setTeamError('');
  };

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
        const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
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
      const res = await apiFetch(`/api/stores/${store.id}/posts`, { method: 'DELETE' });
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
      const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
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

        {activeTab && (
          <div className="space-y-4">
            {activeTab === 'details' && <AccountDetailsTab isRetailer={isRetailer} />}

            {!isRetailer && (
              <CustomerDataTabs
                activeTab={activeTab}
                followedStores={followedStores}
                savedItems={savedItems}
                savedLocations={savedLocations}
                searchHistory={searchHistory}
                userReviews={userReviews}
                loading={customerLoading}
                onUnfollow={async (storeId) => {
                  await apiFetch(`/api/stores/${storeId}/follow`, { method: 'POST' });
                  setFollowedStores(prev => prev.filter(s => s.id !== storeId));
                }}
                onUnsave={async (postId) => {
                  await apiFetch(`/api/posts/${postId}/save`, { method: 'POST' });
                  setSavedItems(prev => ({
                    ...prev,
                    posts: prev.posts.filter(p => p.id !== postId),
                    saved: prev.saved.filter(s => s.postId !== postId),
                  }));
                }}
                onClearHistory={async () => {
                  await apiFetch('/api/me/search-history', { method: 'DELETE' });
                  setSearchHistory([]);
                }}
              />
            )}

            {isRetailer && (
              <>
                {activeTab === 'manage_posts' && (
                  <ManagePostsTab
                    posts={managePosts}
                    loading={loadingPosts}
                    selectedPostIds={selectedPostIds}
                    onToggleSelect={togglePostSelection}
                    onDeleteSelected={handleDeleteSelectedPosts}
                    onDeleteAll={handleDeleteAllPosts}
                    onDeleteSingle={handleDeleteSinglePost}
                  />
                )}

                {activeTab === 'manage_team' && isBusinessOwner && (
                  <ManageTeamTab
                    teamMembers={teamMembers}
                    loading={teamLoading}
                    showAddMember={showAddMember}
                    newMemberPhone={newMemberPhone}
                    newMemberPassword={newMemberPassword}
                    newMemberName={newMemberName}
                    teamError={teamError}
                    ownerName={user?.name || ''}
                    ownerEmail={user?.email || ''}
                    onAddMember={handleAddTeamMember}
                    onRemoveMember={handleRemoveTeamMember}
                    onFieldChange={handleTeamFieldChange}
                    onToggleAddForm={handleToggleAddForm}
                  />
                )}

                {activeTab === 'bulk_upload' && <BulkUploadTab store={store} token={token} />}

                <BusinessSettingsTabs
                  activeTab={activeTab}
                  store={store}
                  setStore={setStore}
                  isBusinessOwner={isBusinessOwner}
                  token={token}
                />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
