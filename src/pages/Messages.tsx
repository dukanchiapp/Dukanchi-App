import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Search, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedStores, setSuggestedStores] = useState<any[]>([]);
  const { token, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/conversations', { credentials: 'include',   })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setConversations(data.map((conv: any) => ({
          ...conv,
          timestamp: new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (authLoading) return; // wait for auth to resolve before fetching
    const params = new URLSearchParams({ limit: '8' });
    if (user?.id) params.set('excludeOwnerId', user.id);
    fetch(`/api/stores?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(data => {
        const all: any[] = Array.isArray(data) ? data : (data.stores ?? []);
        setSuggestedStores(all.slice(0, 3));
      })
      .catch(() => {});
  }, [authLoading, user?.id]);

  const filtered = conversations.filter(conv =>
    conv.storeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showEmpty = !loading && conversations.length === 0 && !searchQuery;

  return (
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Header ── */}
        <div
          className="sticky top-0 z-20 px-4 pt-5 pb-3"
          style={{ background: 'var(--dk-bg)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
              Messages
            </h1>
            <button
              className="flex items-center justify-center"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'var(--dk-bg-soft)',
                border: '0.5px solid var(--dk-border)',
              }}
            >
              <MessageCircle size={18} style={{ color: 'var(--dk-accent)' }} />
            </button>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3"
            style={{
              background: 'var(--dk-surface)',
              borderRadius: 'var(--dk-radius-md)',
              height: 44,
            }}
          >
            <Search size={16} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--dk-text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={14} style={{ color: 'var(--dk-text-tertiary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="px-4 space-y-2 mt-2">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 animate-pulse bg-white rounded-xl"
                style={{ border: '0.5px solid var(--dk-border)' }}
              >
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Conversation list ── */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 space-y-2">
            {filtered.map(conv => (
              <Link
                key={conv.id}
                to={`/chat/${conv.userId}`}
                className="flex items-center gap-3 p-3 bg-white rounded-xl"
                style={{ border: '0.5px solid var(--dk-border)' }}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="overflow-hidden"
                    style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--dk-surface)' }}
                  >
                    {conv.logoUrl ? (
                      <img src={conv.logoUrl} className="w-full h-full object-cover" alt="logo" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center font-bold text-lg"
                        style={{ color: 'var(--dk-accent)' }}
                      >
                        {conv.storeName?.charAt(0)}
                      </div>
                    )}
                  </div>
                  {conv.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
                      {conv.unread}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3
                      className="font-semibold truncate"
                      style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}
                    >
                      {conv.storeName}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', flexShrink: 0, marginLeft: 8 }}>
                      {conv.timestamp}
                    </span>
                  </div>
                  <p
                    className="truncate mt-0.5"
                    style={{
                      fontSize: 12,
                      color: conv.unread > 0 ? 'var(--dk-text-primary)' : 'var(--dk-text-tertiary)',
                      fontWeight: conv.unread > 0 ? 600 : 400,
                    }}
                  >
                    {conv.lastMessage}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── No search results ── */}
        {!loading && searchQuery && filtered.length === 0 && (
          <div className="text-center py-16 px-4">
            <Search size={40} style={{ color: 'var(--dk-border-strong)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: 'var(--dk-text-secondary)' }}>
              No conversations matching "{searchQuery}"
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {showEmpty && (
          <div className="px-4">
            {/* Hero */}
            <div className="flex flex-col items-center pt-8 pb-6">
              <div
                className="flex items-center justify-center mb-4"
                style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--dk-bg-soft)' }}
              >
                <MessageCircle size={36} style={{ color: 'var(--dk-accent)' }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: 'var(--dk-text-primary)', marginBottom: 6 }}>
                Koi chat nahi hai abhi
              </h2>
              <p
                className="text-center"
                style={{ fontSize: 13, color: 'var(--dk-text-tertiary)', lineHeight: '1.55', maxWidth: 270 }}
              >
                Nearby stores dhoondo aur direct chat karke confirm karo "stock hai ya nahi"
              </p>
            </div>

            {/* Suggested for you */}
            {suggestedStores.length > 0 && (
              <div
                className="rounded-xl p-4 mb-3"
                style={{ background: 'var(--dk-bg-warm)', border: '0.5px solid var(--dk-border)' }}
              >
                <p
                  className="mb-3"
                  style={{ fontSize: 11, fontWeight: 700, color: 'var(--dk-accent)', letterSpacing: '0.07em' }}
                >
                  SUGGESTED FOR YOU
                </p>
                <div className="space-y-3">
                  {suggestedStores.map(store => (
                    <div key={store.id} className="flex items-center gap-3">
                      <div
                        className="flex-shrink-0 overflow-hidden"
                        style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--dk-surface)' }}
                      >
                        {store.logoUrl && (
                          <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="truncate"
                          style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-primary)' }}
                        >
                          {store.storeName}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}>
                          {store.category}
                        </p>
                      </div>
                      <Link
                        to={`/chat/${store.ownerId}`}
                        className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: 'var(--dk-accent)', color: 'white' }}
                      >
                        Chat
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ask Nearby Stores banner */}
            <button
              onClick={() => navigate('/map')}
              className="w-full flex items-center gap-3 p-4 rounded-xl"
              style={{ background: '#1A1A1A' }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--dk-accent)' }}
              >
                <MessageCircle size={20} color="white" />
              </div>
              <div className="flex-1 text-left">
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Ask Nearby Stores</p>
                <p style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                  Ek message, saari shops tak pahuche
                </p>
              </div>
              <ChevronRight size={18} color="#888" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
