import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Bookmark, Share2, MessageCircle, MapPin } from 'lucide-react';
import { getStoreStatus } from '../lib/storeUtils';
import { getLiveStatus } from '../lib/liveStatus';
import { useClosingSoon } from '../hooks/useClosingSoon';
import { haptic } from '../lib/haptics';
import { Post } from '../types';

export interface PostCardProps {
  post: Post;
  isLiked: boolean;
  isSaved: boolean;
  isFollowed: boolean;
  likeCount: number;
  distance: string | null;
  imgRatio: number | undefined;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onFollow: (storeId: string) => void;
  onShare: (post: Post) => void;
  onImgLoad: (postId: string, ratio: number) => void;
}

// Session 128.8: compact follower-count formatter — 2347 → "2.3k", 12_000 → "12k",
// 1_500_000 → "1.5M". Used in the PostCard header's location row.
function formatCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

function renderCaption(caption: string) {
  const m = caption.match(/^([^.!?]+[.!?])([\s\S]*)$/);
  if (!m) return <strong style={{ fontWeight: 600 }}>{caption}</strong>;
  return (
    <>
      <strong style={{ fontWeight: 600 }}>{m[1]}</strong>
      {m[2]}
    </>
  );
}

function getImageStyles(naturalRatio: number | undefined): {
  canvasStyle: React.CSSProperties;
  imgStyle: React.CSSProperties;
} {
  // Bright skin: warm cream letterbox behind contained portrait photos.
  // Adaptive aspect-ratio logic preserved — portrait/unknown → 4:5 (contain,
  // no crop), square → 1:1, landscape → natural ratio.
  const CANVAS_BG = 'var(--f-bg-elev-2)';
  if (!naturalRatio || naturalRatio < 0.9) {
    return {
      canvasStyle: { aspectRatio: '4/5', background: CANVAS_BG, overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    };
  }
  if (naturalRatio <= 1.1) {
    return {
      canvasStyle: { aspectRatio: '1/1', background: CANVAS_BG, overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    };
  }
  return {
    canvasStyle: { aspectRatio: String(naturalRatio), background: CANVAS_BG, overflow: 'hidden', position: 'relative' },
    imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  };
}

/** Verified tick — solid blue. Session 128.8: switched from green (#0C831F)
    to blue (--c-info / #2563EB) so the badge reads as TRUST/identity, not
    "Open" status. Green stays exclusively for the open-status pill. */
function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="6.5" fill="#2563EB" />
      <path d="M3.5 6.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  padding: 0,
};

function PostCardInner({ post, isLiked, isSaved, isFollowed, likeCount, distance, imgRatio, onLike, onSave, onFollow, onShare, onImgLoad }: PostCardProps) {
  const isOwnPost = post.isOwnPost === true;
  const storeLink = isOwnPost ? '/profile' : `/store/${post.storeId}`;
  const status = getStoreStatus(
    post.store?.openingTime ?? undefined,
    post.store?.closingTime ?? undefined,
    post.store?.is24Hours ?? undefined,
    post.store?.workingDays ?? undefined
  );
  // Live status capsule (Session 116): bridge getStoreStatus →
  // useClosingSoon (ticks the countdown) → getLiveStatus (4-tier color).
  const closingSoon = useClosingSoon(status?.minutesUntilClose ?? null);
  const live = getLiveStatus({ closingSoon, status: status?.label ?? null });
  // Row 3 area · pincode — Store has city + postalCode (no dedicated `area`).
  const areaText = [post.store?.city, post.store?.postalCode]
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join(' · ');

  // Session 128.8 — trust signals on the PostCard header
  //
  // Row 1 (inline next to name): "⭐ 4.6 (124)" — only when the store has at
  // least one review. Hidden for brand-new stores (a "(0)" reads like a fail).
  //
  // Row 3 (appended to area · pincode): "· 2.3k followers" — only when the
  // store has any followers. formatCount compresses 2347 → "2.3k", 12000 → "12k".
  const ratingText = (() => {
    const r = post.store?.averageRating;
    const c = post.store?.reviewCount ?? 0;
    if (!r || c < 1 || post.store?.hideRatings) return null;
    return { value: r.toFixed(1), count: c };
  })();
  const followersCount = post.store?._count?.followers ?? 0;
  const metaLine = [
    areaText || null,
    followersCount > 0 ? `${formatCount(followersCount)} ${followersCount === 1 ? 'follower' : 'followers'}` : null,
  ].filter(Boolean).join(' · ');
  const { canvasStyle, imgStyle } = getImageStyles(imgRatio);

  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        onImgLoad(post.id, naturalWidth / naturalHeight);
      }
    },
    [post.id, onImgLoad]
  );

  // ── Double-tap to like (Session 128.3) ───────────────────────────────────
  // Instagram-style: two taps within 300ms on the image → like + heart burst.
  // We only TRIGGER like if not already liked (a second double-tap shouldn't
  // unlike — that's the heart icon's job). Burst animates regardless so the
  // tap always feels acknowledged.
  const lastTapRef = useRef<number>(0);
  const [burstKey, setBurstKey] = useState(0);
  const handleImgTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      setBurstKey(k => k + 1);
      haptic('medium');
      if (!isLiked) onLike(post.id);
    } else {
      lastTapRef.current = now;
    }
  }, [isLiked, onLike, post.id]);

  return (
    <div
      style={{
        overflow: 'hidden',
        background: 'var(--f-bg-elev)',
        border: '1px solid var(--f-glass-border)',
        borderRadius: 22,
        boxShadow: '0 2px 12px rgba(24,16,8,0.06)',
      }}
    >
      {/* Card header — 3 sub-rows (name+verified+follow / status+distance+category / area) */}
      <div style={{ padding: '14px 14px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Avatar — clean circular gradient with first-letter fallback when the
            store has no logoUrl (matches the Bright mockup — see the "N" on the
            Nikhil Bhai header). Soft single-color outer ring, no heavy shadow. */}
        <Link to={storeLink} style={{ flexShrink: 0, display: 'block' }}>
          {post.store?.logoUrl ? (
            <img
              src={post.store.logoUrl}
              alt={post.store?.storeName}
              loading="lazy"
              decoding="async"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)',
                boxShadow: '0 2px 8px rgba(255,42,140,0.20)',
              }}
            />
          ) : (
            <div
              aria-label={post.store?.storeName}
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 22,
                lineHeight: 1,
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(255,42,140,0.20)',
              }}
            >
              {post.store?.storeName?.charAt(0) ?? '?'}
            </div>
          )}
        </Link>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Row 1: name + verified + spacer + Follow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Link to={storeLink} style={{ minWidth: 0, textDecoration: 'none' }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--f-text-1)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {post.store?.storeName}
              </span>
            </Link>
            {post.store?.isVerified && <VerifiedTick size={14} />}
            {/* Session 128.8: ⭐ rating + review-count chip inline with the name.
                Hidden when the store has no reviews — "(0)" reads like a fail. */}
            {ratingText && (
              <span
                aria-label={`Rating ${ratingText.value} of 5 from ${ratingText.count} reviews`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--f-text-2)',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--c-rating)', fontSize: 13 }}>★</span>
                {ratingText.value}
                <span style={{ color: 'var(--f-text-3)', fontWeight: 500 }}>({ratingText.count})</span>
              </span>
            )}
            <span style={{ flex: 1 }} />
            {!isOwnPost && (
              <button
                onClick={() => onFollow(post.storeId)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  lineHeight: 1,
                  background: isFollowed ? 'var(--f-bg-elev)' : 'linear-gradient(135deg, #FF6B35, #FF2A8C)',
                  color: isFollowed ? 'var(--f-text-2)' : 'white',
                  border: isFollowed ? '1px solid var(--f-glass-border-2)' : 'none',
                  boxShadow: isFollowed ? 'none' : '0 2px 8px rgba(255,42,140,0.32)',
                }}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Row 2: status capsule + distance + category */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 11,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                color: live.color,
                fontWeight: 700,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 9999,
                background: live.color + '1A',
                border: `1px solid ${live.color}40`,
                fontSize: 10.5,
                lineHeight: 1.2,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: live.color, display: 'inline-block' }} />
              {live.label}
            </span>
            {distance && (
              <span style={{ color: 'var(--f-text-3)', fontWeight: 600, flexShrink: 0 }}>{distance}</span>
            )}
            {post.store?.category && (
              <>
                <span style={{ color: 'var(--f-text-4)', flexShrink: 0 }}>·</span>
                <span style={{ color: '#D11F75', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {post.store.category}
                </span>
              </>
            )}
          </div>

          {/* Row 3: area · pincode · followers (Session 128.8) — renders if
              EITHER an area string OR follower count is present. */}
          {metaLine && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                color: 'var(--f-text-3)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <MapPin size={11} color="var(--b-magenta-ink)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaLine}</span>
            </div>
          )}
        </div>
      </div>

      {/* Image canvas — aspect ratio adapts to photo dimensions. Session 128.3:
          double-tap → like + heart burst. */}
      <div style={canvasStyle} onClick={handleImgTap}>
        <img
          src={post.imageUrl || `https://picsum.photos/seed/${post.id}/800/800`}
          alt={post.product?.productName || 'Post'}
          style={imgStyle}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onLoad={handleImgLoad}
        />
        {burstKey > 0 && (
          <Heart
            key={burstKey}
            className="dk-heart-burst"
            size={96}
            color="#FF2A8C"
            fill="#FF2A8C"
            strokeWidth={1.5}
          />
        )}
        {post.price && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              backdropFilter: 'blur(4px)',
            }}
          >
            ₹{Number(post.price).toLocaleString()}
          </div>
        )}
      </div>

      {/* Action bar + caption */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button onClick={() => onLike(post.id)} style={ghostBtn}>
            <Heart
              size={22}
              fill={isLiked ? '#FF4D6A' : 'none'}
              color={isLiked ? '#FF4D6A' : 'var(--f-text-1)'}
              strokeWidth={2}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>
              {likeCount}
            </span>
          </button>

          {!isOwnPost && post.store?.chatEnabled !== false && (
            <Link
              to={`/chat/${post.store?.ownerId}`}
              state={{
                referredPost: {
                  id: post.id,
                  imageUrl: post.imageUrl,
                  caption: post.caption,
                  price: post.price,
                },
              }}
              style={{ ...ghostBtn, textDecoration: 'none' }}
            >
              <MessageCircle size={21} fill="none" color="var(--f-text-1)" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>Chat</span>
            </Link>
          )}

          <button onClick={() => onShare(post)} style={ghostBtn}>
            <Share2 size={20} fill="none" color="var(--f-text-1)" strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>Share</span>
          </button>

          <span style={{ flex: 1 }} />

          <button onClick={() => onSave(post.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
            <Bookmark
              size={22}
              fill={isSaved ? 'var(--f-text-1)' : 'none'}
              color="var(--f-text-1)"
              strokeWidth={2}
            />
          </button>
        </div>

        {post.product && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>
              {post.product.productName}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D11F75' }}>
              ₹{post.product.price?.toLocaleString()}
            </span>
          </div>
        )}

        {post.caption && (
          <p
            className="line-clamp-3"
            style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: '1.45', marginTop: 6 }}
          >
            {renderCaption(post.caption)}
          </p>
        )}
      </div>
    </div>
  );
}

export const PostCard = React.memo(PostCardInner, (prev, next) =>
  prev.post === next.post &&
  prev.isLiked === next.isLiked &&
  prev.isSaved === next.isSaved &&
  prev.isFollowed === next.isFollowed &&
  prev.likeCount === next.likeCount &&
  prev.distance === next.distance &&
  prev.imgRatio === next.imgRatio
);
