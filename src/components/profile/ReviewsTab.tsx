import { FIcon } from '../futuristic';

/* Futuristic v2 skin · Phase 8 / feat/futuristic-redesign. */

interface ReviewsTabProps {
  reviews: any[];
}

export function ReviewsTab({ reviews }: ReviewsTabProps) {
  if (reviews.length === 0) {
    return (
      <div style={{ padding: '12px 16px' }}>
        <div style={{ padding: '56px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FIcon name="star" size={40} color="var(--f-text-4)" />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-2)', marginTop: 8 }}>No reviews yet</p>
          <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 4 }}>Customer reviews will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reviews.map((review: any) => (
        <div key={review.id} className="f-glass" style={{ padding: 14, borderRadius: 14, background: 'var(--f-glass-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <FIcon
                  key={star}
                  name="star"
                  size={13}
                  color={star <= review.rating ? '#FFD96B' : 'var(--f-text-4)'}
                  fill={star <= review.rating ? '#FFD96B' : 'none'}
                />
              ))}
            </div>
            <span style={{ fontSize: 10, color: 'var(--f-text-3)' }}>
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          {review.comment && (
            <p style={{ fontSize: 13, color: 'var(--f-text-2)', lineHeight: 1.5, margin: 0 }}>{review.comment}</p>
          )}
          {review.user && (
            <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 6, marginBottom: 0 }}>— {review.user.name}</p>
          )}
        </div>
      ))}
    </div>
  );
}
