import { useState, useEffect } from 'react';
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
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
      {/* Aurora wash */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }} className="max-w-md mx-auto">
        <header
          className="px-4 py-3.5 sticky top-0 z-20 flex items-center justify-between"
          style={{ background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid var(--f-glass-border)' }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <button
              onClick={() => activeTab ? setActiveTab(null) : navigate(-1)}
              style={{ width: 42, height: 42, borderRadius: 12, border: '1px solid var(--f-glass-border-2)', background: 'var(--f-bg-elev)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              aria-label="Back"
            >
              <ArrowLeft size={20} color="var(--f-text-1)" />
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--f-text-1)', margin: 0 }}>
              {activeTab ? tabs.find(t => t.id === activeTab)?.label || 'Settings' : 'Settings'}
            </h1>
          </div>
          {/* Bell tile (NotificationBell already wired) */}
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <NotificationBell />
          </div>
        </header>

      <main className="p-4">
        {!activeTab && (
          <div className="space-y-3">
            {/* Profile card (Session 123) */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(255,107,53,0.10), rgba(255,42,140,0.10))',
                border: '1px solid var(--f-glass-border-2)',
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: 18, flexShrink: 0,
                background: 'var(--f-grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: 22, boxShadow: '0 4px 14px rgba(255,42,140,0.30)',
              }}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--f-text-2)', marginTop: 2, fontWeight: 500, textTransform: 'capitalize' }}>
                  {isTeamMember ? 'Team member' : (user?.role || 'customer')}
                </div>
              </div>
            </div>

            {isTeamMember && (
              <div style={{ borderRadius: 14, padding: '10px 14px', textAlign: 'center', background: 'rgba(107,51,255,0.12)', border: '1px solid rgba(107,51,255,0.30)' }}>
                <p style={{ fontSize: 12, color: 'var(--f-magenta-light)', fontWeight: 600, margin: 0 }}>You're logged in as a team member. Some settings are restricted.</p>
              </div>
            )}
            <div style={{ borderRadius: 18, overflow: 'hidden', background: 'var(--f-bg-elev)', border: '1px solid var(--f-glass-border-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
              {tabs.map((tab, i) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center justify-between text-left"
                    style={{ padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: i < tabs.length - 1 ? '1px solid var(--f-glass-border)' : 'none' }}
                  >
                    <div className="flex items-center" style={{ gap: 12 }}>
                      <span style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,42,140,0.10)', border: '1px solid rgba(255,42,140,0.20)' }}>
                        <Icon size={15} color="#FF2A8C" />
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-1)' }}>{tab.label}</span>
                    </div>
                    <ChevronRight size={16} color="var(--f-text-3)" />
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center"
              style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,77,106,0.10)', border: '1px solid rgba(255,77,106,0.30)', color: '#FF4D6A', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <LogOut size={18} style={{ marginRight: 8 }} /> Log Out
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
                  await apiFetch('/api/search/history', { method: 'DELETE' });
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
    </div>
  );
}
