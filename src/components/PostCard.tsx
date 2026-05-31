import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Bookmark, Share2, MessageSquare } from 'lucide-react';
import { getStoreStatus } from '../lib/storeUtils';
import { getLiveStatus, LIVE_STATUS_COLORS } from '../lib/liveStatus';
import { useClosingSoon } from '../hooks/useClosingSoon';
import { haptic } from '../lib/haptics';
import StatusPill, { type BrightStatus } from './bright/StatusPill';
import { Post } from '../types';

/* ── Session 128.13 — Bright Skin PostCard ──────────────────────────────────
   Re-skinned per dukanchi-bright-skin/IMPLEMENT.md + react-stubs/PostCard.jsx.
   ALL behaviour from Sessions 128.3 → 128.10 preserved:
     • Props interface, memoization
     • Double-tap-to-like + heart-burst (dk-heart-burst keyframe)
     • Haptics on tap (--c-action / etc kept at the lib layer)
     • formatCount + renderCaption + getImageStyles helpers
     • Adaptive image canvas (portrait/square/landscape)
     • Rating chip + verified tick + area · pincode · followers row
     • Distance + category in meta row
     • Live-status 4-tier mapping (getLiveStatus UNCHANGED — only the
       visual presentation moves to <StatusPill>)

   Visual surface swapped to bright skin per IMPLEMENT.md:
     • Card: white #fff, 22px radius, 1px solid #F1ECE4, --b-elev-card shadow
     • Avatar: 46×46 circle (spec), gradient fallback uses --b-grad
     • Verified tick: 14px GREEN (#0C831F) per ICONS.md custom badge spec
     • Name: Inter 15px/700 var(--b-ink), max 170px ellipsis nowrap
     • Distance: var(--b-gray-2) 700, category: var(--b-magenta-ink) 700
     • Action row: Like=red, Chat=blue, Share=green, Save=ink (function colors)
     • Caption: 14px var(--b-gray-1) line-height 1.5
     • Price: Inter 800
   ─────────────────────────────────────────────────────────────────────────── */

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
  // Adaptive aspect-ratio logic preserved — portrait/unknown → 4:5 (contain,
  // no crop), square → 1:1, landscape → natural ratio. Letterbox bg matches
  // the bright surface so portrait photos sit on cream, not a dark frame.
  const CANVAS_BG = 'var(--b-surface)';
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

/** Verified tick — solid GREEN (#0C831F) per dukanchi-bright-skin/ICONS.md
    custom badge spec. The Bright Skin uses green for the trust badge AND for
    the open-status pill — they're the same shade by design (the green of
    "this is good"). Was blue in Session 128.8; reverted per the spec. */
function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="6.5" fill="#0C831F" />
      <path d="M3.5 6.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const iconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  gap: 5,
};

/** Map the existing 4-tier liveStatus output to a <StatusPill> status keyword.
    Logic untouched — only the visual presentation moves. */
function tierFromColor(color: string): BrightStatus {
  if (color === LIVE_STATUS_COLORS.red) return 'closed';
  if (color === LIVE_STATUS_COLORS.orange) return 'orange';
  if (color === LIVE_STATUS_COLORS.yellow) return 'soon';
  return 'open';
}

function PostCardInner({
  post,
  isLiked,
  isSaved,
  isFollowed,
  likeCount,
  distance,
  imgRatio,
  onLike,
  onSave,
  onFollow,
  onShare,
  onImgLoad,
}: PostCardProps) {
  const isOwnPost = post.isOwnPost === true;
  const storeLink = isOwnPost ? '/profile' : `/store/${post.storeId}`;

  const status = getStoreStatus(
    post.store?.openingTime ?? undefined,
    post.store?.closingTime ?? undefined,
    post.store?.is24Hours ?? undefined,
    post.store?.workingDays ?? undefined,
  );
  const closingSoon = useClosingSoon(status?.minutesUntilClose ?? null);
  const live = getLiveStatus({ closingSoon, status: status?.label ?? null });
  const liveTier = tierFromColor(live.color);

  // Row 3 area · pincode — Store has city + postalCode (no dedicated `area`).
  const areaText = [post.store?.city, post.store?.postalCode]
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join(' · ');

  // Row 1 (inline next to name): "⭐ 4.6 (124)" — only when the store has at
  // least one review. Hidden for brand-new stores (a "(0)" reads like a fail).
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
    [post.id, onImgLoad],
  );

  // ── Double-tap to like (Session 128.3) — preserved verbatim ─────────────
  const lastTapRef = useRef<number>(0);
  const [burstKey, setBurstKey] = useState(0);
  const handleImgTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      setBurstKey((k) => k + 1);
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
        background: '#fff',
        border: '1px solid #F1ECE4',
        borderRadius: 22,
        boxShadow: 'var(--b-elev-card)',
      }}
    >
      {/* Card header */}
      <div style={{ padding: '12px 13px 11px', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {/* Avatar 46×46 — per spec */}
        <Link to={storeLink} style={{ flexShrink: 0, display: 'block' }}>
          {post.store?.logoUrl ? (
            <img
              src={post.store.logoUrl}
              alt={post.store?.storeName}
              loading="lazy"
              decoding="async"
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                background: 'var(--b-grad)',
              }}
            />
          ) : (
            <div
              aria-label={post.store?.storeName}
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--b-grad)',
                color: 'var(--b-on-grad)',
                fontWeight: 800,
                fontSize: 18,
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            >
              {post.store?.storeName?.charAt(0) ?? '?'}
            </div>
          )}
        </Link>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* Row 1: name + verified + rating + spacer + Follow (green per spec) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <Link to={storeLink} style={{ minWidth: 0, textDecoration: 'none' }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--b-ink)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  maxWidth: 170,
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
            {ratingText && (
              <span
                aria-label={`Rating ${ratingText.value} of 5 from ${ratingText.count} reviews`}
                style={{
                  background: 'var(--b-green)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 5,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                {ratingText.value} <span aria-hidden="true">★</span>
                <span style={{ opacity: 0.75, fontWeight: 600, marginLeft: 2 }}>({ratingText.count})</span>
              </span>
            )}
            <span style={{ flex: 1 }} />
            {!isOwnPost && (
              <button
                onClick={() => { haptic('light'); onFollow(post.storeId); }}
                className="b-tap"
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  lineHeight: 1,
                  background: isFollowed ? 'var(--b-green-bg)' : 'var(--b-green)',
                  color: isFollowed ? 'var(--b-green)' : '#fff',
                  border: isFollowed ? '1.5px solid var(--b-green)' : 'none',
                  transition: 'transform 0.16s var(--b-ease)',
                }}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Row 2: status pill + distance + category */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 11,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <StatusPill status={liveTier} label={live.label} />
            {distance && (
              <span style={{ color: 'var(--b-gray-2)', fontWeight: 700, flexShrink: 0 }}>{distance}</span>
            )}
            {post.store?.category && (
              <>
                <span style={{ color: 'var(--b-gray-3)', flexShrink: 0 }}>·</span>
                <span
                  style={{
                    color: 'var(--b-magenta-ink)',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {post.store.category}
                </span>
              </>
            )}
          </div>

          {/* Row 3: area · pincode · followers */}
          {metaLine && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10.5,
                color: 'var(--b-gray-2)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{metaLine}</span>
            </div>
          )}
        </div>
      </div>

      {/* Image canvas — double-tap → like + heart burst preserved */}
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
            color="var(--b-red)"
            fill="var(--b-red)"
            strokeWidth={1.5}
          />
        )}
        {post.price && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              background: 'rgba(28,20,12,0.78)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 800,
              backdropFilter: 'blur(4px)',
            }}
          >
            ₹{Number(post.price).toLocaleString('en-IN')}
          </div>
        )}
      </div>

      {/* Action bar + caption — Session 128.18: founder asked for a uniform
          GREY treatment on Like/Chat/Share. Liked state still fills the
          heart (now in --b-gray-1 ink) so the active vs. inactive contrast
          is preserved without the rainbow-icon palette. */}
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* Like — grey (filled ink when active) */}
          <button onClick={() => onLike(post.id)} style={iconBtn} aria-label={isLiked ? 'Unlike' : 'Like'}>
            <Heart
              size={22}
              fill={isLiked ? 'var(--b-gray-1)' : 'none'}
              color="var(--b-gray-1)"
              strokeWidth={2}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--b-gray-1)' }}>{likeCount}</span>
          </button>

          {/* Chat — grey */}
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
              style={{ ...iconBtn, textDecoration: 'none' }}
              aria-label="Open chat"
            >
              <MessageSquare size={21} fill="none" color="var(--b-gray-1)" strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--b-gray-1)' }}>Chat</span>
            </Link>
          )}

          {/* Share — grey */}
          <button onClick={() => onShare(post)} style={iconBtn} aria-label="Share post">
            <Share2 size={20} fill="none" color="var(--b-gray-1)" strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--b-gray-1)' }}>Share</span>
          </button>

          <span style={{ flex: 1 }} />

          {/* Save — ink (filled when active) */}
          <button
            onClick={() => onSave(post.id)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            aria-label={isSaved ? 'Unsave' : 'Save'}
          >
            <Bookmark
              size={20}
              fill={isSaved ? 'var(--b-ink)' : 'none'}
              color="var(--b-ink)"
              strokeWidth={2}
            />
          </button>
        </div>

        {post.product && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--b-ink)' }}>
              {post.product.productName}
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--b-ink)' }}>
              ₹{post.product.price?.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        {post.caption && (
          <p
            className="line-clamp-3"
            style={{ fontSize: 14, color: 'var(--b-gray-1)', lineHeight: 1.5, marginTop: 6 }}
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
