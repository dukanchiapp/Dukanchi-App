/**
 * FPostCard — futuristic (v2) feed post card.
 *
 * Deliberately shares the EXACT prop contract of the production PostCard
 * (`PostCardProps`), so feed screens swap <PostCard> -> <FPostCard> with
 * zero wiring changes. All behaviour preserved (image-ratio adaptation,
 * price tag, chat deep-link with referredPost state, optimistic
 * like/save/follow) — only the visual layer is re-skinned to deep glass.
 *
 * Adapted from the design-system handoff (futuristic/screens.jsx FPostCard).
 */
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getStoreStatus } from '../../lib/storeUtils';
import type { PostCardProps } from '../PostCard';
import { FIcon } from './FIcon';

function renderCaption(caption: string) {
  const m = caption.match(/^([^.!?]+[.!?])([\s\S]*)$/);
  if (!m) return <strong style={{ fontWeight: 700 }}>{caption}</strong>;
  return (
    <>
      <strong style={{ fontWeight: 700 }}>{m[1]}</strong>
      {m[2]}
    </>
  );
}

function getImageStyles(naturalRatio: number | undefined): {
  canvasStyle: React.CSSProperties;
  imgStyle: React.CSSProperties;
} {
  const base: React.CSSProperties = {
    background: '#000',
    overflow: 'hidden',
    position: 'relative',
  };
  if (!naturalRatio || naturalRatio < 0.9) {
    return {
      canvasStyle: { ...base, aspectRatio: '4/5' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    };
  }
  if (naturalRatio <= 1.1) {
    return {
      canvasStyle: { ...base, aspectRatio: '1/1' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    };
  }
  return {
    canvasStyle: { ...base, aspectRatio: String(naturalRatio) },
    imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  };
}

/** Gradient verified tick — green→cyan, matches the futuristic palette. */
function FVerifiedTick({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="f-vtick-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2EE7A1" />
          <stop offset="1" stopColor="#00E5FF" />
        </linearGradient>
      </defs>
      <circle cx="6.5" cy="6.5" r="6.5" fill="url(#f-vtick-grad)" />
      <path
        d="M3.5 6.5l2 2 4-4"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  padding: 0,
};

function FPostCardInner({
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

  return (
    <div className="f-glass f-glass-edge" style={{ borderRadius: 22, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '14px 14px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <Link to={storeLink} style={{ flexShrink: 0 }}>
          <img
            src={post.store?.logoUrl || '/uploads/default-logo.png'}
            alt={post.store?.storeName}
            loading="lazy"
            decoding="async"
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #FF2A8C',
              boxShadow: '0 0 14px rgba(255,42,140,0.40)',
            }}
          />
        </Link>
        <Link
          to={storeLink}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            textDecoration: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span
              style={{
                fontSize: 14.5,
                color: 'var(--f-text-1)',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {post.store?.storeName}
            </span>
            {post.store?.isVerified && <FVerifiedTick />}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--f-text-2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ color: '#2EE7A1', fontWeight: 600, flexShrink: 0 }}>
              {status ? `● ${status.label}` : '● Open'}
            </span>
            {distance && (
              <>
                <span style={{ color: 'var(--f-text-4)', flexShrink: 0 }}>·</span>
                <span style={{ flexShrink: 0 }}>{distance}</span>
              </>
            )}
            {post.store?.category && (
              <>
                <span style={{ color: 'var(--f-text-4)', flexShrink: 0 }}>·</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {post.store.category}
                </span>
              </>
            )}
          </div>
        </Link>
        {!isOwnPost && (
          <button
            onClick={() => onFollow(post.storeId)}
            style={{
              padding: '8px 16px',
              borderRadius: 9999,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: isFollowed
                ? 'var(--f-glass-bg-2)'
                : 'linear-gradient(135deg, #FF6B35, #FF2A8C)',
              color: isFollowed ? 'var(--f-text-1)' : 'white',
              border: isFollowed ? '1px solid var(--f-glass-border-2)' : 'none',
              boxShadow: isFollowed ? 'none' : '0 0 14px rgba(255,42,140,0.40)',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {isFollowed ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Image canvas — aspect ratio adapts to photo dimensions */}
      <div style={canvasStyle}>
        <img
          src={post.imageUrl || `https://picsum.photos/seed/${post.id}/800/800`}
          alt={post.product?.productName || 'Post'}
          style={imgStyle}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onLoad={handleImgLoad}
        />
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
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            ₹{Number(post.price).toLocaleString()}
          </div>
        )}
      </div>

      {/* Actions + caption */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <button onClick={() => onLike(post.id)} style={ghostBtn}>
            <FIcon
              name="heart"
              size={21}
              color={isLiked ? '#FF4D6A' : 'var(--f-text-1)'}
              fill={isLiked ? '#FF4D6A' : 'none'}
            />
            <span style={{ fontSize: 13, color: 'var(--f-text-2)', fontWeight: 600 }}>
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
              <FIcon name="msg" size={20} color="var(--f-text-1)" />
              <span style={{ fontSize: 13, color: 'var(--f-text-1)', fontWeight: 500 }}>
                Chat
              </span>
            </Link>
          )}

          <button onClick={() => onShare(post)} style={ghostBtn}>
            <FIcon name="share" size={19} color="var(--f-text-1)" />
            <span style={{ fontSize: 13, color: 'var(--f-text-1)', fontWeight: 500 }}>
              Share
            </span>
          </button>

          <span style={{ flex: 1 }} />

          <button
            onClick={() => onSave(post.id)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <FIcon
              name="bookmark"
              size={21}
              color="var(--f-text-1)"
              fill={isSaved ? 'var(--f-text-1)' : 'none'}
            />
          </button>
        </div>

        {post.product && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>
              {post.product.productName}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6BB4' }}>
              ₹{post.product.price?.toLocaleString()}
            </span>
          </div>
        )}

        {post.caption && (
          <p
            className="line-clamp-3"
            style={{
              fontSize: 13,
              color: 'var(--f-text-2)',
              lineHeight: 1.45,
              marginTop: 6,
            }}
          >
            {renderCaption(post.caption)}
          </p>
        )}
      </div>
    </div>
  );
}

export const FPostCard = React.memo(
  FPostCardInner,
  (prev, next) =>
    prev.post === next.post &&
    prev.isLiked === next.isLiked &&
    prev.isSaved === next.isSaved &&
    prev.isFollowed === next.isFollowed &&
    prev.likeCount === next.likeCount &&
    prev.distance === next.distance &&
    prev.imgRatio === next.imgRatio,
);
