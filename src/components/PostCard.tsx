import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Bookmark, Share2, MessageCircle } from 'lucide-react';
import { getStoreStatus, statusColor } from '../lib/storeUtils';

export interface PostCardProps {
  post: any;
  isLiked: boolean;
  isSaved: boolean;
  isFollowed: boolean;
  likeCount: number;
  distance: string | null;
  imgRatio: number | undefined;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onFollow: (storeId: string) => void;
  onShare: (post: any) => void;
  onImgLoad: (postId: string, ratio: number) => void;
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
  if (!naturalRatio || naturalRatio < 0.9) {
    return {
      canvasStyle: { aspectRatio: '4/5', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'contain', display: 'block' },
    };
  }
  if (naturalRatio <= 1.1) {
    return {
      canvasStyle: { aspectRatio: '1/1', background: 'black', overflow: 'hidden', position: 'relative' },
      imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    };
  }
  return {
    canvasStyle: { aspectRatio: String(naturalRatio), background: 'black', overflow: 'hidden', position: 'relative' },
    imgStyle: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  };
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
    post.store?.openingTime,
    post.store?.closingTime,
    post.store?.is24Hours,
    post.store?.workingDays
  );
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

  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: '0.5px solid var(--dk-border)',
        borderRadius: 'var(--dk-radius-xl)',
      }}
    >
      {/* Card header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to={storeLink} className="flex-shrink-0">
            <img
              src={post.store?.logoUrl || '/uploads/default-logo.png'}
              alt={post.store?.storeName}
              loading="lazy"
              decoding="async"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '2px solid var(--dk-accent)',
                objectFit: 'cover',
              }}
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Link to={storeLink}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--dk-text-primary)',
                    lineHeight: '1.3',
                  }}
                >
                  {post.store?.storeName}
                </span>
              </Link>
              {post.store?.isVerified && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="6.5" fill="var(--dk-success)" />
                  <path
                    d="M3.5 6.5l2 2 4-4"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div
              className="flex items-center gap-1 flex-wrap"
              style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 1 }}
            >
              <span style={{ color: status ? statusColor(status.color) : 'var(--dk-success)', fontWeight: 500 }}>
                {status ? `● ${status.label}` : '● Open'}
              </span>
              {distance && (
                <>
                  <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                  <span>{distance}</span>
                </>
              )}
              {post.store?.category && (
                <>
                  <span style={{ color: 'var(--dk-border-strong)' }}>·</span>
                  <span>{post.store.category}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!isOwnPost && (
          <button
            onClick={() => onFollow(post.storeId)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex-shrink-0 ml-2"
            style={
              isFollowed
                ? { background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)' }
                : { background: 'var(--dk-accent)', color: 'white' }
            }
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
            }}
          >
            ₹{Number(post.price).toLocaleString()}
          </div>
        )}
      </div>

      {/* Action bar + caption */}
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center" style={{ gap: 16 }}>
          <button onClick={() => onLike(post.id)} className="flex items-center gap-1">
            <Heart
              size={21}
              fill={isLiked ? '#FF4444' : 'none'}
              color={isLiked ? '#FF4444' : 'var(--dk-text-primary)'}
              strokeWidth={2}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>
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
              className="flex items-center gap-1"
            >
              <MessageCircle size={21} fill="none" color="var(--dk-text-primary)" strokeWidth={2} />
              <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>Chat</span>
            </Link>
          )}

          <button onClick={() => onShare(post)} className="flex items-center gap-1">
            <Share2 size={19} fill="none" color="var(--dk-text-primary)" strokeWidth={2} />
            <span style={{ fontSize: 13, color: 'var(--dk-text-primary)' }}>Share</span>
          </button>

          <div style={{ flex: 1 }} />

          <button onClick={() => onSave(post.id)}>
            <Bookmark
              size={21}
              fill={isSaved ? 'var(--dk-text-primary)' : 'none'}
              color="var(--dk-text-primary)"
              strokeWidth={2}
            />
          </button>
        </div>

        {post.product && (
          <div className="flex items-center justify-between mt-2">
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
              {post.product.productName}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-accent)' }}>
              ₹{post.product.price?.toLocaleString()}
            </span>
          </div>
        )}

        {post.caption && (
          <p
            className="line-clamp-3"
            style={{ fontSize: 13, color: 'var(--dk-text-primary)', lineHeight: '1.45', marginTop: 6 }}
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
