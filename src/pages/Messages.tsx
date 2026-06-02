import { useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, MessageCircle, ChevronRight } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useUserLocation } from '../context/LocationContext';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../context/ToastContext';
import ConversationRow from '../components/ConversationRow';
import { Conversation } from '../types';
import { apiFetch, getSocketUrl, getSocketAuthOptions } from '../lib/api';
import { Sentry } from '../lib/sentry-frontend';
import { playNotificationSound } from '../utils/audio';

/* ── Futuristic v2 skin · Phase 7 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. Conversation fetch,
   Socket.IO ask-nearby listeners, suggestions fetch, and the retailer
   stock-request respond flow are all preserved verbatim. */

const shimmer: CSSProperties = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.05) 75%)',
  backgroundSize: '200% 100%',
  animation: 'f-shimmer 1.5s linear infinite',
};

export default function MessagesPage() {
  usePageMeta({ title: 'Messages' });
  const [activeTab, setActiveTab] = useState<'chats'|'queries'>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedStores, setSuggestedStores] = useState<any[]>([]);
  const [askNearbyCards, setAskNearbyCards] = useState<any[]>([]);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const reopenCountRef = useRef(0);
  const { token, user, isLoading: authLoading } = useAuth();
  const { location: userLocCtx } = useUserLocation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Session 126: distance user → store for rich conversation rows. Returns
  // "1.2 km" / "300 m", or null when location/coords are missing.
  const convDistance = (lat?: number | null, lng?: number | null): string | null => {
    if (!userLocCtx || lat == null || lng == null) return null;
    const R = 6371;
    const dLat = (lat - userLocCtx.lat) * Math.PI / 180;
    const dLon = (lng - userLocCtx.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocCtx.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  };

  const formatConversations = (data: Conversation[]): Conversation[] =>
    data.map(conv => ({
      ...conv,
      timestamp: new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

  const refreshConversations = useCallback(() => {
    apiFetch('/api/messages/conversations')
      .then(r => r.ok ? r.json() : [])
      .then(data => setConversations(formatConversations(data as Conversation[])))
      .catch((err) => {
        // Background reconcile after socket reconnect — no toast (we already
        // show whatever's in state). Sentry-only for diagnosability.
        Sentry.captureException(err, { extra: { context: 'messages.refreshConversations' } });
      });
  }, []);

  const fetchPendingAskNearby = useCallback(() => {
    if (user?.role !== 'retailer') return;
    apiFetch('/api/ask-nearby/pending')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const formatted = data.map((item: any) => ({
          responseId: item.id,
          requestId: item.requestId,
          query: item.request.query,
          customerName: item.request.customer?.name || 'Customer',
          customerId: item.request.customerId,
          latitude: item.request.latitude,
          longitude: item.request.longitude,
          areaLabel: item.request.areaLabel,
          radiusKm: item.request.radiusKm,
          accepted: false,
        }));
        setAskNearbyCards(formatted);
      })
      .catch(err => Sentry.captureException(err, { extra: { context: 'messages.fetchPendingAskNearby' } }));
  }, [user?.role]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiFetch('/api/messages/conversations')
      .then(res => res.ok ? res.json() : [])
      .then(data => setConversations(formatConversations(data as Conversation[])))
      .catch((err) => {
        showToast('Messages load nahi ho payi. Please refresh.', { type: 'error' });
        Sentry.captureException(err, { extra: { context: 'messages.initialFetch' } });
      })
      .finally(() => setLoading(false));

    fetchPendingAskNearby();
  }, [token, fetchPendingAskNearby]);

  const handleOpenChat = useCallback((userId: string, name: string) => {
    navigate(`/chat/${userId}`, { state: { userName: name } });
  }, [navigate]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    console.log('[Messages] fetching suggestions, excludeOwnerId:', user.id);
    apiFetch(`/api/stores?limit=8&excludeOwnerId=${user.id}`)
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(data => {
        const all: any[] = Array.isArray(data) ? data : (data.stores ?? []);
        console.log('[Messages] suggestions received:', all.map((s: any) => ({ id: s.id, ownerId: s.ownerId, name: s.storeName })));
        setSuggestedStores(all.slice(0, 3));
      })
      .catch((err) => {
        // Suggested-stores rail is a discovery extra — no toast.
        Sentry.captureException(err, { extra: { context: 'messages.suggestedStores' } });
      });
  }, [authLoading, user?.id]);

  // Socket: listen for ask_nearby_request (retailer) + ask_nearby_confirmed (customer)
  useEffect(() => {
    if (!user) return;
    const socket = io(getSocketUrl(), getSocketAuthOptions());
    socketRef.current = socket;
    reopenCountRef.current = 0;

    const isDev = import.meta.env.DEV;
    socket.on('connect', () => {
      if (isDev) console.log('[SOCKET][Messages] connected', socket.id);
    });
    socket.on('connect_error', (err) => {
      console.warn('[SOCKET][Messages] connect_error:', err.message);
    });
    socket.on('disconnect', (reason) => {
      if (isDev) console.warn('[SOCKET][Messages] disconnect', reason);
    });

    // Reconnection-aware refetch: recover conversations missed while tab was backgrounded
    const handleReopen = () => {
      reopenCountRef.current += 1;
      if (reopenCountRef.current > 1) {
        refreshConversations();
        fetchPendingAskNearby();
      }
    };
    socket.io.on('reconnect', handleReopen);
    socket.io.engine?.on('open', handleReopen);

    // Mobile foreground wakeup
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    socket.on('ask_nearby_request', (data: any) => {
      setAskNearbyCards(prev => {
        if (prev.find(c => c.responseId === data.responseId)) return prev;
        return [{ ...data, accepted: false }, ...prev];
      });
      playNotificationSound();
    });

    socket.on('ask_nearby_confirmed', (data: { storeName: string }) => {
      showToast(`🎉 '${data.storeName}' ke paas stock hai! Chat mein jaao`);
      refreshConversations();
      playNotificationSound();
    });

    return () => {
      socket.io.off('reconnect', handleReopen);
      socket.io.engine?.off('open', handleReopen);
      document.removeEventListener('visibilitychange', onVisibility);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, refreshConversations]);

  const handleAskNearbyRespond = async (responseId: string, answer: 'yes' | 'no') => {
    if (respondingIds.has(responseId)) return;
    setRespondingIds(prev => new Set([...prev, responseId]));
    try {
      const res = await apiFetch('/api/ask-nearby/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId, answer }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Kuch problem aayi'); return; }
      
      if (answer === 'yes') {
        setAskNearbyCards(prev => prev.map(c => c.responseId === responseId ? { ...c, accepted: true } : c));
        showToast('Chat shuru ho gayi! Customer ab aapko message kar sakta hai.');
        refreshConversations();
      } else {
        setAskNearbyCards(prev => prev.filter(c => c.responseId !== responseId));
      }
    } catch (err) {
      showToast('Network error');
      Sentry.captureException(err, { extra: { context: 'messages.askNearbyRespond', responseId, answer } });
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
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
      {/* Aurora wash */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

        {/* Session 128.14 — Bright Skin Messages header per
            dukanchi-bright-skin/screens/MessagesScreen.jsx lines 9-11:
            yellow gradient + b-head sheen + 24px Sora wordmark. The search
            input + chats counter are kept on a tinted strip below the
            gradient header (a Dukanchi-only addition, not in the spec
            since the spec shows only the title — but our app has search
            and a chats counter that matter operationally). */}
        <div
          className="b-head"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 0',
            background: 'var(--b-grad)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                fontFamily: 'var(--b-display)',
                color: 'var(--b-on-grad)',
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              Messages
            </h1>
            <span style={{ fontSize: 12, color: 'var(--b-on-grad-soft)', fontWeight: 600 }}>
              {conversations.length} chats
            </span>
          </div>

          {/* Search input — white pill embedded in the gradient block */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              borderRadius: 12,
              background: '#fff',
            }}
          >
            <Search size={17} color="var(--b-gray-2)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--b-ink)', fontSize: 14, fontFamily: 'inherit', fontWeight: 500, minWidth: 0 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }} aria-label="Clear search">
                <X size={14} color="var(--b-gray-2)" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', marginTop: 12 }}>
            <button 
              onClick={() => setActiveTab('chats')}
              style={{ flex: 1, padding: '12px 0', border: 'none', background: 'transparent', color: activeTab === 'chats' ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 15, position: 'relative', cursor: 'pointer' }}>
              Chats
              {activeTab === 'chats' && <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, background: 'white', borderRadius: '3px 3px 0 0' }} />}
            </button>
            <button 
              onClick={() => setActiveTab('queries')}
              style={{ flex: 1, padding: '12px 0', border: 'none', background: 'transparent', color: activeTab === 'queries' ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 15, position: 'relative', cursor: 'pointer' }}>
              Queries {askNearbyCards.filter(c => !c.accepted).length > 0 && <span style={{ marginLeft: 6, background: 'var(--f-orange)', color: 'white', fontSize: 11, padding: '2px 6px', borderRadius: 10 }}>{askNearbyCards.filter(c => !c.accepted).length}</span>}
              {activeTab === 'queries' && <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 3, background: 'white', borderRadius: '3px 3px 0 0' }} />}
            </button>
          </div>
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '13px 14px', borderRadius: 18,
                background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
              }}>
                <div style={{ ...shimmer, width: 48, height: 48, borderRadius: 14, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...shimmer, width: '45%', height: 12, borderRadius: 6 }} />
                  <div style={{ ...shimmer, width: '72%', height: 10, borderRadius: 6, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ask Nearby request cards (retailer side) ── */}
        {activeTab === 'queries' && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {askNearbyCards.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <p style={{ fontSize: 14, color: 'var(--f-text-3)' }}>Koi naya request nahi aaya abhi.</p>
              </div>
            )}
            {askNearbyCards.map(card => (
              <div
                key={card.responseId}
                className="f-glass"
                style={{ borderRadius: 16, background: 'var(--f-glass-bg)', borderLeft: '3px solid var(--f-orange)', overflow: 'hidden' }}
              >
                <div style={{ padding: 16 }}>
                  <span style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 800,
                    letterSpacing: 0.4, background: 'var(--f-orange)', color: 'white', marginBottom: 8,
                  }}>
                    STOCK REQUEST 📦
                  </span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--f-text-1)', margin: '0 0 2px' }}>{card.query}</p>
                  <p style={{ fontSize: 12, color: 'var(--f-text-3)', margin: '0 0 2px' }}>
                    📍 {convDistance(card.latitude, card.longitude) || `${card.radiusKm}km`} {card.areaLabel ? `near ${card.areaLabel}` : ''}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--f-text-3)', margin: '0 0 12px' }}>
                    Customer: {card.customerName} {card.accepted ? '' : '• Reply karo — wait kar raha hai'}
                  </p>
                  
                  {card.accepted ? (
                    <button
                      onClick={() => handleOpenChat(card.customerId, card.customerName)}
                      style={{
                        width: '100%', padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        background: 'var(--f-magenta)', color: '#fff', fontSize: 14, fontWeight: 800,
                        boxShadow: '0 3px 10px rgba(220,13,115,0.30)',
                      }}
                    >
                      💬 Move to chat
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleAskNearbyRespond(card.responseId, 'yes')}
                        disabled={respondingIds.has(card.responseId)}
                        style={{
                          flex: 1, padding: 10, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          background: 'var(--f-success)', color: '#fff', fontSize: 13, fontWeight: 800,
                          opacity: respondingIds.has(card.responseId) ? 0.6 : 1, boxShadow: '0 3px 10px rgba(12,131,31,0.30)',
                        }}
                      >
                        ✅ Haan, hai stock!
                      </button>
                      <button
                        onClick={() => handleAskNearbyRespond(card.responseId, 'no')}
                        disabled={respondingIds.has(card.responseId)}
                        style={{
                          flex: 1, padding: 10, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                          background: '#FF3B30', color: 'white', border: 'none',
                          fontSize: 13, fontWeight: 700, opacity: respondingIds.has(card.responseId) ? 0.6 : 1,
                          boxShadow: '0 3px 10px rgba(255,59,48,0.30)',
                        }}
                      >
                        ❌ Nahi hai
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Conversation list ── */}
        {activeTab === 'chats' && !loading && filtered.length > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(conv => (
              <ConversationRow
                key={conv.userId}
                conversation={conv}
                onClick={handleOpenChat}
                distance={convDistance(conv.store?.latitude, conv.store?.longitude)}
              />
            ))}
          </div>
        )}

        {/* ── No search results ── */}
        {activeTab === 'chats' && !loading && searchQuery && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 16px' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <Search size={38} color="var(--f-text-4)" />
            </div>
            <p style={{ fontSize: 14, color: 'var(--f-text-3)' }}>No conversations matching "{searchQuery}"</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {activeTab === 'chats' && showEmpty && (
          <div style={{ padding: '0 16px' }}>
            {/* Hero */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, paddingBottom: 24 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
                boxShadow: 'var(--b-elev-card)',
              }}>
                <MessageCircle size={34} color="var(--f-magenta-light)" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--f-text-1)', margin: '0 0 6px' }}>Koi chat nahi hai abhi</h2>
              <p style={{ fontSize: 13, color: 'var(--f-text-3)', lineHeight: 1.55, maxWidth: 270, textAlign: 'center', margin: 0 }}>
                Nearby stores dhoondo aur direct chat karke confirm karo "stock hai ya nahi"
              </p>
            </div>

            {/* Suggested for you */}
            {suggestedStores.length > 0 && (
              <div className="f-glass" style={{ borderRadius: 16, padding: 16, marginBottom: 12, background: 'var(--f-glass-bg)' }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--f-orange-light)', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                  SUGGESTED FOR YOU
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {suggestedStores.map(store => (
                    <div key={store.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                        background: 'var(--b-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {store.logoUrl
                          ? <img src={store.logoUrl} alt={store.storeName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>{store.storeName?.charAt(0)}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                          {store.storeName}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--f-text-3)', margin: '1px 0 0' }}>{store.category}</p>
                      </div>
                      <Link
                        to={`/chat/${store.ownerId}`}
                        style={{
                          flexShrink: 0, padding: '6px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700,
                          textDecoration: 'none', background: 'var(--b-grad)', color: 'white',
                          boxShadow: 'var(--b-elev-card)',
                        }}
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
              className="f-glass"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16,
                cursor: 'pointer', background: 'var(--f-glass-bg-2)', fontFamily: 'inherit',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: 'var(--b-grad)', boxShadow: 'var(--b-elev-card)',
              }}>
                <MessageCircle size={20} color="white" />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>Ask Nearby Stores</p>
                <p style={{ fontSize: 11, color: 'var(--f-text-3)', margin: '1px 0 0' }}>Ek message, saari shops tak pahuche</p>
              </div>
              <ChevronRight size={18} color="var(--f-text-3)" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
