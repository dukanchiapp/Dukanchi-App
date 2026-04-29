import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RefreshButton from '../components/RefreshButton';
import { MessageCircle, Search, X, ChevronRight } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConversationSkeleton } from '../components/Skeleton';

export default function MessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedStores, setSuggestedStores] = useState<any[]>([]);
  const [askNearbyCards, setAskNearbyCards] = useState<any[]>([]);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const { token, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
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
    if (authLoading || !user?.id) return;
    console.log('[Messages] fetching suggestions, excludeOwnerId:', user.id);
    fetch(`/api/stores?limit=8&excludeOwnerId=${user.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(data => {
        const all: any[] = Array.isArray(data) ? data : (data.stores ?? []);
        console.log('[Messages] suggestions received:', all.map((s: any) => ({ id: s.id, ownerId: s.ownerId, name: s.storeName })));
        setSuggestedStores(all.slice(0, 3));
      })
      .catch(() => {});
  }, [authLoading, user?.id]);

  // Socket: listen for ask_nearby_request (retailer) + ask_nearby_confirmed (customer)
  useEffect(() => {
    if (!user) return;
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(socketUrl, { withCredentials: true, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('ask_nearby_request', (data: any) => {
      setAskNearbyCards(prev => {
        if (prev.find(c => c.responseId === data.responseId)) return prev;
        return [data, ...prev];
      });
    });

    socket.on('ask_nearby_confirmed', (data: any) => {
      showToast(`🎉 '${data.storeName}' ke paas stock hai! Chat mein jaao`);
      // Refresh conversations so new chat appears
      fetch('/api/conversations', { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(list => setConversations(list.map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }))))
        .catch(() => {});
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [user]);

  const handleAskNearbyRespond = async (responseId: string, answer: 'yes' | 'no') => {
    if (respondingIds.has(responseId)) return;
    setRespondingIds(prev => new Set([...prev, responseId]));
    try {
      const res = await fetch('/api/ask-nearby/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ responseId, answer }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Kuch problem aayi'); return; }
      // Remove card
      setAskNearbyCards(prev => prev.filter(c => c.responseId !== responseId));
      if (answer === 'yes') {
        showToast('Chat shuru ho gayi! Customer ab aapko message kar sakta hai.');
        // Refresh conversations
        fetch('/api/conversations', { credentials: 'include' })
          .then(r => r.ok ? r.json() : [])
          .then(list => setConversations(list.map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }))))
          .catch(() => {});
      }
    } catch {
      showToast('Network error');
    } finally {
      setRespondingIds(prev => { const s = new Set(prev); s.delete(responseId); return s; });
    }
  };

  const filtered = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
            <RefreshButton />
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
          <div>
            {[1, 2, 3, 4, 5].map(i => <ConversationSkeleton key={i} />)}
          </div>
        )}

        {/* ── Ask Nearby request cards (retailer side) ── */}
        {askNearbyCards.length > 0 && (
          <div className="px-4 space-y-3 mb-3">
            {askNearbyCards.map(card => (
              <div
                key={card.responseId}
                className="rounded-xl overflow-hidden"
                style={{ background: 'white', borderLeft: '3px solid #f97316', border: '0.5px solid var(--dk-border)', borderLeftWidth: 3, borderLeftColor: '#f97316' }}
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: '#fff3e0', color: '#f97316' }}
                    >
                      STOCK REQUEST 📦
                    </span>
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--dk-text-primary)', marginBottom: 2 }}>
                    {card.query}
                  </p>
                  {(card.areaLabel || card.radiusKm) && (
                    <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)', marginBottom: 2 }}>
                      📍 {card.radiusKm}km{card.areaLabel ? ` near ${card.areaLabel}` : ''}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginBottom: 12 }}>
                    Customer: {card.customerName} • Reply karo — wait kar raha hai
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAskNearbyRespond(card.responseId, 'yes')}
                      disabled={respondingIds.has(card.responseId)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: '#16a34a', color: 'white', opacity: respondingIds.has(card.responseId) ? 0.6 : 1 }}
                    >
                      ✅ Haan, hai stock!
                    </button>
                    <button
                      onClick={() => handleAskNearbyRespond(card.responseId, 'no')}
                      disabled={respondingIds.has(card.responseId)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)', border: '0.5px solid var(--dk-border)', opacity: respondingIds.has(card.responseId) ? 0.6 : 1 }}
                    >
                      ❌ Nahi hai
                    </button>
                  </div>
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
                state={{ userName: conv.name }}
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
                        {conv.name?.charAt(0)}
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
                      {conv.name}
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
