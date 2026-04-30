import { Star } from 'lucide-react';

interface ReviewsTabProps {
  reviews: any[];
}

export function ReviewsTab({ reviews }: ReviewsTabProps) {
  if (reviews.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="py-16 text-center flex flex-col items-center">
          <Star size={40} style={{ color: 'var(--dk-border-strong)', marginBottom: 8 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-secondary)' }}>No reviews yet</p>
          <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Customer reviews will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <div className="space-y-3">
        {reviews.map((review: any) => (
          <div key={review.id} className="p-4 rounded-xl" style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={13}
                    style={{ color: star <= review.rating ? '#F59E0B' : 'var(--dk-border-strong)', fill: star <= review.rating ? '#F59E0B' : 'none' }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 10, color: 'var(--dk-text-tertiary)' }}>
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
            {review.comment && (
              <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', lineHeight: '1.5' }}>{review.comment}</p>
            )}
            {review.user && (
              <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 6 }}>— {review.user.name}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
