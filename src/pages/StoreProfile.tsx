import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Share2, Store, Phone, Navigation,
  Plus, Check, MessageCircle, Star, Heart, Settings,
} from 'lucide-react';
import StarRating from '../components/StarRating';
import ReviewModal from '../components/ReviewModal';
import NotificationBell from '../components/NotificationBell';
import { getStoreStatus } from '../lib/storeUtils';
import { getLiveStatus } from '../lib/liveStatus';
import { useClosingSoon } from '../hooks/useClosingSoon';
import { useUserLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { PageMeta } from '../components/PageMeta';
import { buildStoreLdJson } from '../lib/seo-html';
import { apiFetch } from '../lib/api';
import { Sentry } from '../lib/sentry-frontend';
import { haptic } from '../lib/haptics';

/* ── Futuristic v2 skin · Phase 6 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. All store/post/review
   fetching, follow + like + share handlers, and the post-detail modal wiring
   are preserved verbatim from the production page. */

const coverFab: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: 'rgba(0,0,0,0.20)',
  border: '1px solid rgba(255,255,255,0.30)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

// Session 128: peach-tinted rounded icon tile for the details card rows
// (matches the design mockup — address / phone / hours each sit behind a tile).
const iconTile: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--b-orange-bg)',
  border: '1px solid var(--b-tint)',
};

// Session 128: blue gradient for the Direction CTA (mockup-matched theme accent).
const blueGrad = 'linear-gradient(135deg, #2E9BFF 0%, #1D4ED8 100%)';

/** "21:00" → "9:00 PM". Leaves non-HH:MM strings untouched. */
function fmt12(t?: string | null): string {
  if (!t) return '';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m ?? '00'} ${ampm}`;
}

export default function StoreProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { location: userLocCtx } = useUserLocation();
  const userLoc = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;
  const [store, setStore] = useState<any>(null);
  const [, setProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  const [bioOverflow, setBioOverflow] = useState(false);

  // Live store status — computed at top level (hooks must run before the
  // loading/!store early returns). store is null pre-fetch → getStoreStatus
  // returns null → useClosingSoon(null) → no timer. Re-runs when store loads.
  const storeStatus = getStoreStatus(
    store?.openingTime, store?.closingTime, store?.is24Hours, store?.workingDays,
  );
  const closingSoon = useClosingSoon(storeStatus?.minutesUntilClose ?? null);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || '';
  const currentUserRole = currentUser?.role || 'customer';

  const [interactions, setInteractions] = useState<{ likedPostIds: string[]; savedPostIds: string[]; followedStoreIds: string[] }>({
    likedPostIds: [], savedPostIds: [], followedStoreIds: [],
  });

  useEffect(() => {
    if (currentUserId) {
      apiFetch(`/api/me/interactions`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setInteractions(data); })
        .catch((err) => {
          // Background hydration — optimistic UI carries on. Sentry-only.
          Sentry.captureException(err, { extra: { context: 'storeProfile.fetchInteractions' } });
        });
    }
  }, [currentUserId]);

  const toggleLike = async (postId: string) => {
    const wasLiked = interactions.likedPostIds.includes(postId);
    setInteractions(prev => ({ ...prev, likedPostIds: wasLiked ? prev.likedPostIds.filter(i => i !== postId) : [...prev.likedPostIds, postId] }));
    // Session 128.3: tactile feedback + surface failures via toast + rollback
    // the optimistic write (was a console-only silent catch — Rule B violation).
    haptic('light');
    try {
      const res = await apiFetch(`/api/posts/${postId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error(`Like failed: ${res.status}`);
    } catch (err) {
      showToast('Like nahi ho saka, dobara try karein', { type: 'error' });
      setInteractions(prev => ({ ...prev, likedPostIds: wasLiked ? [...prev.likedPostIds, postId] : prev.likedPostIds.filter(i => i !== postId) }));
      Sentry.captureException(err, { extra: { context: 'storeProfile.toggleLike' } });
    }
  };

  const handleShare = async (post: any) => {
    const url = `${window.location.origin}/store/${store?.id}`;
    try {
      if (navigator.share) await navigator.share({ title: store?.storeName, text: post.caption || '', url });
      else { await navigator.clipboard.writeText(url); showToast('Link copied to clipboard!', { type: 'success' }); }
    } catch (err) {
      console.error('handleShare failed:', err);
    }
  };

  const getLikeCount = (post: any) => {
    const total = post._count?.likes ?? post.likes?.length ?? 0;
    const initiallyLiked = (post.likes?.length ?? 0) > 0;
    const currentlyLiked = interactions.likedPostIds.includes(post.id);
    if (initiallyLiked && !currentlyLiked) return Math.max(0, total - 1);
    if (!initiallyLiked && currentlyLiked) return total + 1;
    return total;
  };

  useEffect(() => { fetchStoreData(); }, [id]);

  useEffect(() => {
    if (selectedPost) {
      setTimeout(() => {
        document.getElementById(`post-${selectedPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedPost]);

  // Session 128: line-based read-more — measure the clamped <p> and only show
  // the "Read more" toggle when the bio actually overflows 3 lines.
  useEffect(() => {
    if (bioExpanded) return;
    const el = bioRef.current;
    if (el) setBioOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [store?.description, bioExpanded]);

  const fetchStoreData = async () => {
    try {
      const storeRes = await apiFetch(`/api/stores/${id}?userId=${currentUserId}`);
      if (!storeRes.ok) { setStore(null); setLoading(false); return; }
      const storeData = await storeRes.json();
      setStore(storeData);
      setIsFollowing(storeData.followers?.length > 0);

      const productsRes = await apiFetch(`/api/products?storeId=${id}`);
      const productsData = await productsRes.json();
      setProducts(Array.isArray(productsData) ? productsData : (productsData.products ?? []));

      const postsRes = await apiFetch(`/api/stores/${id}/posts`);
      const postsData = await postsRes.json();
      setPosts(Array.isArray(postsData) ? postsData : (postsData.posts ?? []));

      const reviewsRes = await apiFetch(`/api/reviews/store/${id}`);
      const reviewsData = await reviewsRes.json();
      setReviews(Array.isArray(reviewsData) ? reviewsData : (reviewsData.reviews ?? []));

      setLoading(false);
    } catch (err) {
      console.error('fetchStoreData failed:', err);
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      const res = await apiFetch(`/api/stores/${id}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
      const data = await res.json();
      if (typeof data.following === 'boolean') {
        setIsFollowing(data.following);
      }
    } catch (err) {
      showToast(wasFollowing ? 'Unfollow nahi ho saka, dobara try karein' : 'Follow nahi ho saka, dobara try karein', { type: 'error' });
      setIsFollowing(wasFollowing);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--f-bg-deep)' }}>
        <div
          className="animate-spin"
          style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--f-glass-border-2)', borderTopColor: 'var(--f-magenta)' }}
        />
      </div>
    );
  }

  if (!store) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', textAlign: 'center', background: 'var(--f-bg-deep)', backgroundImage: 'var(--f-page-bg)',
        fontFamily: 'var(--f-font)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, background: 'var(--f-glass-bg)', border: '1px solid var(--f-glass-border)',
        }}>
          <Store size={32} color="var(--f-text-3)" />
        </div>
        <h2 className="f-display" style={{ fontSize: 22, color: 'var(--f-text-1)', margin: '0 0 8px' }}>Store not found</h2>
        <p style={{ fontSize: 13, color: 'var(--f-text-3)', margin: '0 0 24px', maxWidth: 280 }}>
          This store may have been removed or the link is invalid.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12, border: 'none',
            cursor: 'pointer', background: 'var(--f-grad-primary)', color: 'white', fontSize: 14, fontWeight: 700,
            fontFamily: 'inherit', boxShadow: 'var(--b-elev-card)',
          }}
        >
          <ChevronLeft size={16} color="white" /> Go Back
        </button>
      </div>
    );
  }

  const isOwner = store.ownerId === currentUserId;
  // v3 live status — 4-tier color (red ≤15 / orange ≤30 / yellow ≤60 / green)
  // via getLiveStatus, ticking through useClosingSoon (declared at top).
  const live = storeStatus ? getLiveStatus({ closingSoon, status: storeStatus.label }) : null;
  // Distance user → store. Session 128.19: founder rejected the city /
  // postalCode fallback from 128.17 ("the capsule showing delhi is wrong
  // it's showing city, actually should show the distance between user and
  // the store") — distance ONLY, or hide the pill entirely.
  const storeDistance: string | null = (() => {
    if (!userLoc || !store.latitude || !store.longitude) return null;
    const R = 6371;
    const dLat = (store.latitude - userLoc.lat) * Math.PI / 180;
    const dLon = (store.longitude - userLoc.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(store.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  })();
  const showReviews = !store.hideRatings;
  const sortedPosts = [...posts].sort((a, b) => (b.isPinned === a.isPinned ? 0 : b.isPinned ? 1 : -1));

  const tabs = [
    { key: 'posts', label: 'Posts', count: posts.length },
    ...(showReviews ? [{ key: 'reviews', label: 'Reviews', count: reviews.length }] : []),
  ];

  // Session 128.39 — per-store PageMeta + LD-JSON.
  // Title/description fall back to a generic store label while data loads, so
  // crawlers + social unfurlers that hit the page during the empty-state
  // window still see SOMETHING coherent. The structured-data payload is the
  // GTM unlock: each retailer's profile becomes individually discoverable
  // (LocalBusiness schema). We intentionally OMIT owner identity (no PII).
  const metaCanonical = id ? `https://dukanchi.com/store/${id}` : 'https://dukanchi.com/';
  const metaTitle = store
    ? `${store.storeName}${store.category ? ` — ${store.category}` : ''}${store.address ? ` in ${store.address}` : ''}`
    : 'Store';
  const metaDescription = store
    ? (store.description?.slice(0, 200) || `${store.category || 'Local'} store${store.address ? ` in ${store.address}` : ''}. Connect on Dukanchi.`)
    : 'Local store on Dukanchi — apki local market ab aapke phone par.';
  const metaImage = store?.coverUrl || store?.logoUrl || undefined;
  // LD-JSON LocalBusiness — only emit once store data is loaded.
  // Session 128.40: shared builder with the bot-render middleware
  // (src/lib/seo-html.ts) so the client-rendered LD-JSON and the
  // server-rendered LD-JSON can NEVER drift. PII discipline (no owner,
  // phoneVisible gate, reviewCount >= 5) is enforced inside buildStoreLdJson.
  const storeLd: Record<string, unknown> | undefined = store
    ? buildStoreLdJson({ ...store, image: metaImage })
    : undefined;

  return (
    <>
    <PageMeta
      title={metaTitle}
      description={metaDescription}
      canonical={metaCanonical}
      image={metaImage}
      type="profile"
      jsonLd={storeLd}
    />
    <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--f-bg-deep)', paddingBottom: 80, fontFamily: 'var(--f-font)' }}>
      {/* Aurora wash */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--f-page-bg)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto' }}>

        {/* ── Cover + Logo ── Session 128: outer wrapper is NOT clipped so the
            logo + distance pill can overhang the cover bottom (the previous
            overflow:hidden on this layer was clipping the logo — that was the
            "profile picture under the other element" bug). The cover IMAGE
            lives in its own absolutely-positioned clipped media layer. */}
        <div style={{ position: 'relative', height: 160 }}>
          {/* Clipped media layer — image + soft fade to the cream page */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            {store.coverUrl ? (
              <img src={store.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : store.logoUrl ? (
              <img
                src={store.logoUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(14px) brightness(0.9)', transform: 'scale(1.15)' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', background: 'var(--b-grad)' }} />
            )}
            {/* Session 128.19: bottom fade-to-cream gradient removed per
                founder ("profile banner ke bottom mein jo blur element
                design hai vo remove kar"). Cover image now meets the
                page surface with a hard edge. */}
          </div>

          {/* Floating top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 14px 0',
          }}>
            <button onClick={() => navigate(-1)} style={coverFab} aria-label="Back">
              <ChevronLeft size={18} color="white" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Session 119: Refresh button dropped (was window.location.reload);
                  added live NotificationBell (drawer + unread dot) in a dark
                  glass FAB tile — reachable from any store profile now. */}
              <div style={coverFab}>
                <NotificationBell color="#fff" />
              </div>
              {/* Session 126: mockup shows a gear top-right. Owner viewing their
                  own store → gear links to /settings. Visitors keep Share (more
                  useful when viewing someone else's store). */}
              {isOwner ? (
                <button onClick={() => navigate('/settings')} style={coverFab} aria-label="Settings">
                  <Settings size={16} color="white" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/store/${store.id}`;
                    if (navigator.share) navigator.share({ title: store.storeName, url });
                    else { navigator.clipboard.writeText(url); showToast('Link copied!', { type: 'success' }); }
                  }}
                  style={coverFab}
                  aria-label="Share"
                >
                  <Share2 size={16} color="white" />
                </button>
              )}
            </div>
          </div>

          {/* Logo overlapping cover bottom — Session 128: sits OUTSIDE the clip
              layer (zIndex 4) so the overhang is no longer cut off. Enlarged to
              96×96 with a white "cutout" border to match the Bright mockup. */}
          <div style={{
            position: 'absolute', bottom: -34, left: 18, zIndex: 4,
            width: 96, height: 96, borderRadius: 24, overflow: 'hidden',
            border: '4px solid #fff', background: 'var(--f-grad-primary)',
            boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
          }}>
            {store.logoUrl ? (
              <img src={store.logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 40, color: 'white' }}>
                {store.storeName?.charAt(0)}
              </div>
            )}
          </div>

          {/* Session 128.19: distance capsule moved OUT of the cover overlay
              and INTO the store-name row below — founder ask: "vo capsule
              store name ke saamne chahiye vertically adjust karna hai,
              horizontally position change nahi krni." The pill now sits at
              the right end of the name row, sharing the baseline with the
              <h1>{store.storeName}</h1>. */}
        </div>

        {/* ── Store info ── */}
        <div style={{ padding: '48px 18px 16px' }}>
          {/* Name + rating + distance capsule (Session 128.19: distance pill
              relocated from cover bottom-right → right end of name row, per
              founder. justify-content: space-between pushes the pill to the
              right while the name+rating cluster stays left. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
              <h1 className="f-display" style={{ fontSize: 24, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StarRating rating={store.averageRating ?? 0} size={15} />
                {store.averageRating != null && store.averageRating > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--f-text-2)' }}>{store.averageRating.toFixed(1)}</span>
                )}
              </div>
            </div>
            {storeDistance && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9999,
                background: '#fff', border: '1px solid var(--b-line)', boxShadow: 'var(--b-elev-card)',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>📍</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--f-text-1)' }}>{storeDistance}</span>
              </div>
            )}
          </div>

          {/* Role + category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: store.description ? 10 : 14 }}>
            {store.owner?.role && store.owner.role !== 'customer' && (
              // Session 128.18: RETAIL badge → orange per founder ("retail
              // store tag capsule should be of orange color").
              <span style={{
                padding: '3px 10px', borderRadius: 9999, fontSize: 9, fontWeight: 800, letterSpacing: 0.8,
                textTransform: 'uppercase', background: 'var(--b-orange)', color: '#fff',
                boxShadow: 'var(--b-elev-card)',
              }}>
                {store.owner.role === 'retailer' ? 'Retail' : store.owner.role}
              </span>
            )}
            {store.category && <span style={{ fontSize: 12, color: 'var(--f-text-2)' }}>{store.category}</span>}
            {live && (
              <>
                <span style={{ fontSize: 12, color: 'var(--f-text-4)' }}>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: live.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: live.color, boxShadow: `0 0 6px ${live.color}` }} />
                  {live.label}
                </span>
              </>
            )}
          </div>

          {store.description && (
            <div style={{ margin: '0 0 14px' }}>
              <p
                ref={bioRef}
                style={{
                  fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.55, margin: 0,
                  display: '-webkit-box', WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: bioExpanded ? 'unset' : 3, overflow: 'hidden',
                }}
              >
                {store.description}
              </p>
              {(bioOverflow || bioExpanded) && (
                <button
                  onClick={() => setBioExpanded(v => !v)}
                  style={{
                    marginTop: 4, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--b-magenta-ink)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  {bioExpanded ? 'Read less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {/* Details card — Session 126: icon-tile rows + bold address/hours
              (12-hour) + full-gradient Direction button (matches the mockup).
              Live status now lives inline in the meta row above. */}
          <div className="f-glass f-glass-edge" style={{ padding: 14, borderRadius: 16, background: 'var(--f-glass-bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Session 128.19: info-tile lucide SVGs replaced with relevant
                emojis (📍 ☎️ 🕐) per founder ("relevant emoji's se replace
                karo"). Emoji sized to fit the existing iconTile bounds. */}
            {store.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={iconTile}><span style={{ fontSize: 18, lineHeight: 1 }}>📍</span></div>
                <div style={{ minWidth: 0, paddingTop: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0, lineHeight: 1.3 }}>{store.address}</p>
                  {(store.postalCode || store.city || store.state) && (
                    <p style={{ fontSize: 11.5, color: 'var(--f-text-3)', margin: '2px 0 0' }}>
                      {[store.postalCode, [store.city, store.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            )}
            {store.phoneVisible !== false && store.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={iconTile}><span style={{ fontSize: 17, lineHeight: 1 }}>☎️</span></div>
                <a href={`tel:${store.phone}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-1)', textDecoration: 'none' }}>{store.phone}</a>
              </div>
            )}
            {(store.is24Hours || store.openingTime || store.closingTime) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={iconTile}><span style={{ fontSize: 17, lineHeight: 1 }}>🕐</span></div>
                <div style={{ minWidth: 0, paddingTop: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0, lineHeight: 1.3 }}>
                    {store.is24Hours ? 'Open 24 Hours' : `${fmt12(store.openingTime)} – ${fmt12(store.closingTime)}`}
                  </p>
                  {store.workingDays && (
                    <p style={{ fontSize: 11.5, color: 'var(--f-text-3)', margin: '2px 0 0' }}>{store.workingDays}</p>
                  )}
                </div>
              </div>
            )}
            {store.latitude && store.longitude && store.latitude !== 0 && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2,
                  padding: '13px 14px', borderRadius: 13, background: blueGrad,
                  color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  boxShadow: '0 6px 18px rgba(37,99,235,0.32)',
                }}
              >
                <Navigation size={15} color="white" />
                Direction to Store
              </a>
            )}
          </div>

          {/* Session 128.20: stats row (Posts / Followers / Reviews) — for
              parity with own Profile and to surface the follower count that
              the founder said was missing. Same 3-tile glass layout. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {[
              { label: 'Posts', value: posts.length },
              { label: 'Followers', value: store._count?.followers ?? 0 },
              { label: 'Reviews', value: reviews.length },
            ].map(stat => (
              <div key={stat.label} className="f-glass" style={{ flex: 1, padding: '13px 8px', borderRadius: 14, textAlign: 'center', background: 'var(--f-glass-bg)' }}>
                <div className="f-mono" style={{ fontSize: 21, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.02em' }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {isOwner ? (
              <>
                {/* Session 128.18: New Post button → Blinkit ADD-green per
                    founder ("new post button should be of green color"),
                    matching the Phase 2 green-CTA convention. */}
                <Link
                  to="/profile"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '11px 14px', borderRadius: 12, textDecoration: 'none', background: 'var(--c-action, var(--b-green))',
                    color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: 'var(--b-elev-card)',
                  }}
                >
                  <Plus size={14} color="white" /> New Post
                </Link>
                <Link
                  to="/retailer/dashboard"
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px',
                    borderRadius: 12, textDecoration: 'none', background: 'var(--f-glass-bg-2)',
                    border: '1px solid var(--f-glass-border)', color: 'var(--f-text-1)', fontSize: 13, fontWeight: 700,
                  }}
                >
                  Edit Profile
                </Link>
              </>
            ) : (
              <>
                {/* Session 128.19: Follow button → green per founder
                    ("follow button green color"). Matches the Phase 2
                    green-CTA convention used for New Post / signup CTA. */}
                <button
                  onClick={toggleFollow}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '11px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    border: isFollowing ? '1px solid var(--f-glass-border)' : 'none',
                    background: isFollowing ? 'var(--f-glass-bg-2)' : 'var(--c-action, var(--b-green))',
                    color: isFollowing ? 'var(--f-text-1)' : '#fff', fontSize: 13, fontWeight: 700,
                    boxShadow: isFollowing ? 'none' : 'var(--b-elev-card)',
                  }}
                >
                  {isFollowing
                    ? <><Check size={15} color="var(--f-text-1)" />Following</>
                    : <><Plus size={15} color="white" />Follow</>}
                </button>
                {store.chatEnabled !== false && (
                  <Link
                    to={`/chat/${store.ownerId}`}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '11px 14px', borderRadius: 12, textDecoration: 'none', background: 'var(--f-glass-bg-2)',
                      border: '1px solid var(--f-glass-border-2)', color: 'var(--f-text-1)', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <MessageCircle size={15} color="var(--f-magenta-light)" />Chat
                  </Link>
                )}
                {store.phone && store.phoneVisible !== false && (
                  <a
                    href={`tel:${store.phone}`}
                    style={{
                      width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 12, background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)', flexShrink: 0,
                    }}
                    aria-label="Call store"
                  >
                    <Phone size={17} color="var(--f-text-2)" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, display: 'flex',
          background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--f-glass-border)',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0',
                background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: activeTab === tab.key ? '2px solid var(--f-orange)' : '2px solid transparent',
                color: activeTab === tab.key ? 'var(--f-text-1)' : 'var(--f-text-3)',
                fontSize: 13.5, fontWeight: activeTab === tab.key ? 800 : 500,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9999,
                background: activeTab === tab.key ? 'var(--f-grad-primary)' : 'var(--f-glass-bg-2)',
                color: activeTab === tab.key ? 'white' : 'var(--f-text-3)',
                boxShadow: activeTab === tab.key ? 'var(--b-elev-card)' : 'none',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={{ minHeight: 280 }}>

          {/* Posts grid */}
          {activeTab === 'posts' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: 4 }}>
              {sortedPosts.map((post, idx) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  style={{ position: 'relative', aspectRatio: '1/1', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', background: 'var(--f-bg-elev)' }}
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption || 'Post'}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* STORE badge — top-left of first cell (README §Posts grid) */}
                  {idx === 0 && (
                    <span style={{
                      position: 'absolute', top: 6, left: 8, fontSize: 9, fontWeight: 800,
                      color: 'var(--f-text-1)', letterSpacing: 0.6, padding: '3px 7px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                    }}>
                      STORE
                    </span>
                  )}
                  {post.isPinned && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--f-grad-primary)', boxShadow: 'var(--b-elev-card)',
                    }}>
                      <Star size={11} color="white" fill="white" />
                    </div>
                  )}
                  {(post.product?.price || post.price) && (
                    <div style={{
                      position: 'absolute', bottom: 6, left: 6, padding: '2px 7px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', fontSize: 10, fontWeight: 700, color: 'white',
                    }}>
                      ₹{Number(post.product?.price || post.price).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
              {posts.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '56px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--f-text-3)' }}>No posts yet</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          {activeTab === 'reviews' && showReviews && (
            <div style={{ padding: '14px 16px' }}>
              {store.averageRating ? (
                <div className="f-glass" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, marginBottom: 14, background: 'var(--f-glass-bg)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p className="f-mono" style={{ fontSize: 38, fontWeight: 800, color: 'var(--f-text-1)', lineHeight: 1, margin: 0 }}>
                      {store.averageRating.toFixed(1)}
                    </p>
                    <div style={{ marginTop: 4 }}><StarRating rating={store.averageRating} size={13} /></div>
                    <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 3 }}>{store.reviewCount} reviews</p>
                  </div>
                </div>
              ) : null}

              {!isOwner && currentUserRole === 'customer' && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  style={{
                    width: '100%', marginBottom: 14, padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'var(--f-grad-primary)', color: 'white', fontSize: 13, fontWeight: 700,
                    fontFamily: 'inherit', boxShadow: 'var(--b-elev-card)',
                  }}
                >
                  Write a Review
                </button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviews.map(review => (
                  <div key={review.id} className="f-glass" style={{ padding: 14, borderRadius: 14, background: 'var(--f-glass-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>{review.user.name}</span>
                        <div style={{ marginTop: 3 }}><StarRating rating={review.rating} size={12} /></div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--f-text-3)' }}>{new Date(review.createdAt).toLocaleDateString()}</span>
                    </div>
                    {review.comment && (
                      <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>{review.comment}</p>
                    )}
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div style={{ padding: '44px 0', textAlign: 'center' }}>
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                      <Star size={34} color="var(--f-text-4)" />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--f-text-3)' }}>No reviews yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Post detail modal ── */}
      {selectedPost && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--f-bg-deep)' }}>
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
            background: 'var(--f-sticky-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--f-glass-border)',
          }}>
            <button onClick={() => setSelectedPost(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }} aria-label="Close">
              <ChevronLeft size={22} color="var(--f-text-1)" />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--f-text-1)' }}>{store.storeName}</span>
            <div style={{ width: 22 }} />
          </header>

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              {sortedPosts.map(post => {
                const isLiked = interactions.likedPostIds.includes(post.id);
                const likeCount = getLikeCount(post);
                return (
                  <div
                    key={post.id}
                    id={`post-${post.id}`}
                    style={{ marginBottom: 8, scrollMarginTop: 80, borderBottom: '1px solid var(--f-glass-border)' }}
                  >
                    {/* Post header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--f-magenta)', flexShrink: 0 }}>
                        {store.logoUrl ? (
                          <img src={store.logoUrl} alt="store" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--f-grad-primary)', color: 'white', fontWeight: 800 }}>
                            {store.storeName?.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>{store.storeName}</p>
                        <p style={{ fontSize: 10, color: 'var(--f-text-3)', margin: 0 }}>{new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Image */}
                    <div style={{ background: '#000' }}>
                      <img
                        src={post.imageUrl}
                        alt={post.caption || 'Post'}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: 'auto', maxHeight: 500, objectFit: 'contain', display: 'block' }}
                      />
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <button
                            onClick={() => toggleLike(post.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <Heart size={22} color={isLiked ? 'var(--f-danger)' : 'var(--f-text-1)'} fill={isLiked ? 'var(--f-danger)' : 'none'} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)' }}>{likeCount}</span>
                          </button>
                          {store.chatEnabled !== false && !isOwner && (
                            <Link to={`/chat/${store.ownerId}`} style={{ display: 'flex' }}>
                              <MessageCircle size={22} color="var(--f-text-1)" />
                            </Link>
                          )}
                          <button
                            onClick={() => handleShare(post)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                          >
                            <Share2 size={21} color="var(--f-text-1)" />
                          </button>
                        </div>
                        {(post.product?.price || post.price) && (
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--f-text-1)' }}>
                            ₹{Number(post.product?.price || post.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {post.caption && (
                        <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--f-text-1)', marginRight: 6 }}>{store.storeName}</span>
                          {post.caption}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {store && id && showReviews && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          targetId={id}
          targetType="store"
          targetName={store.storeName}
          onReviewSubmitted={fetchStoreData}
        />
      )}
    </div>
    </>
  );
}
