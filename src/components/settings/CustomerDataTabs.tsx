import React from 'react';
import { Link } from 'react-router-dom';
import { Store, Bookmark, MapPin, History, Star } from 'lucide-react';
import StarRating from '../StarRating';

interface CustomerDataTabsProps {
  activeTab: string;
  followedStores: any[];
  savedItems: { saved: any[]; posts: any[] };
  savedLocations: any[];
  searchHistory: any[];
  userReviews: any[];
  loading: boolean;
  onUnfollow: (storeId: string) => void;
  onUnsave: (postId: string) => void;
  onClearHistory: () => void;
}

const SkeletonList = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 animate-pulse flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="h-2 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    ))}
  </div>
);

export const CustomerDataTabs = React.memo(function CustomerDataTabs({
  activeTab, followedStores, savedItems, savedLocations, searchHistory, userReviews, loading,
  onUnfollow, onUnsave, onClearHistory,
}: CustomerDataTabsProps) {
  return (
    <>
      {activeTab === 'following' && (
        loading ? <SkeletonList /> : followedStores.length > 0 ? (
          <div className="space-y-2">
            {followedStores.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3">
                <Link to={`/store/${s.id}`} className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex-shrink-0 flex items-center justify-center text-indigo-600 font-bold">{s.storeName?.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900">{s.storeName}</h3>
                    <p className="text-xs text-gray-500">{s.category}</p>
                  </div>
                </Link>
                <button
                  onClick={() => onUnfollow(s.id)}
                  style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid #FFE4D6', background: 'white', color: '#FF6B35', cursor: 'pointer', flexShrink: 0 }}
                >
                  Unfollow
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <Store className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">You aren't following any stores yet.</p>
            <Link to="/search" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Discover local businesses</Link>
          </div>
        )
      )}

      {activeTab === 'saved' && (
        loading ? <SkeletonList /> : savedItems.posts.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {savedItems.posts.map(p => (
              <div key={p.id} className="aspect-square relative rounded-lg overflow-hidden">
                <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium truncate max-w-[70%]">{p.store?.storeName}</div>
                <button
                  onClick={() => onUnsave(p.id || p.postId)}
                  style={{ position: 'absolute', top: 4, right: 4, padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, border: '1px solid #eee', background: 'white', color: '#666', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <Bookmark className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No saved posts yet.</p>
            <Link to="/" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Browse feed</Link>
          </div>
        )
      )}

      {activeTab === 'locations' && (
        loading ? <SkeletonList /> : savedLocations.length > 0 ? (
          <div className="space-y-2">
            {savedLocations.map(loc => (
              <div key={loc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3">
                <MapPin size={18} className="text-indigo-500 flex-shrink-0" />
                <div><h3 className="font-semibold text-sm text-gray-900">{loc.locationName}</h3><p className="text-xs text-gray-400">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</p></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <MapPin className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No saved locations.</p>
            <Link to="/map" className="text-indigo-600 font-medium text-sm mt-2 inline-block">Explore map</Link>
          </div>
        )
      )}

      {activeTab === 'history' && (
        loading ? <SkeletonList /> : searchHistory.length > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button onClick={onClearHistory} style={{ fontSize: 12, color: '#FF6B35', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Clear All
              </button>
            </div>
            {searchHistory.map(h => (
              <div key={h.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center space-x-3">
                <History size={16} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1"><span className="text-sm text-gray-900">{h.query}</span></div>
                <span className="text-[10px] text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <History className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">Search history is empty.</p>
          </div>
        )
      )}

      {activeTab === 'reviews' && (
        loading ? <SkeletonList /> : userReviews.length > 0 ? (
          <div className="space-y-3">
            {userReviews.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{r.store?.storeName || r.product?.productName || 'Unknown'}</span>
                    <div className="mt-1"><StarRating rating={r.rating} size={12} /></div>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-2">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
            <Star className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">You haven't left any reviews yet.</p>
          </div>
        )
      )}
    </>
  );
});
