import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Search, Trash2, Eye, Image, Heart, Calendar, Store, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Post {
  id: string;
  imageUrl: string;
  caption: string | null;
  price: number | null;
  isPinned: boolean;
  isPromoted: boolean;
  isOpeningPost: boolean;
  createdAt: string;
  storeId: string;
  store: {
    id: string;
    storeName: string;
    owner: { name: string; role: string };
  };
  _count: { likes: number };
}

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, showConfirm } = useToast();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      const res = await api.get(`/api/admin/posts?${params}`, { headers: getAdminHeaders() });
      setPosts(res.data.posts);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch posts', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = (id: string) => {
    showConfirm('Delete this post? This action cannot be undone.', {
      type: 'error',
      onConfirm: async () => {
        setDeleting(id);
        try {
          await api.delete(`/api/admin/posts/${id}`, { headers: getAdminHeaders() });
          showToast('Post deleted successfully', { type: 'success' });
          fetchPosts();
          if (selectedPost?.id === id) setSelectedPost(null);
        } catch {
          showToast('Failed to delete post', { type: 'error' });
        } finally {
          setDeleting(null);
        }
      }
    });
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      retailer: 'bg-blue-100 text-blue-700',
      supplier: 'bg-purple-100 text-purple-700',
      brand: 'bg-pink-100 text-pink-700',
      manufacturer: 'bg-orange-100 text-orange-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  return (
    <AdminLayout title="Post Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-sm text-gray-500">{total} total posts across all stores</p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by caption or store name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <Image className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No posts found</p>
            <p className="text-sm text-gray-400 mt-1">{search ? 'Try a different search term' : 'Posts will appear here when stores create them'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow group">
                {/* Image */}
                <div className="aspect-square relative overflow-hidden cursor-pointer" onClick={() => setSelectedPost(post)}>
                  <img
                    src={post.imageUrl?.startsWith('http') ? post.imageUrl : `${API_BASE}${post.imageUrl}`}
                    alt={post.caption || 'Post'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400?text=No+Image'; }}
                  />
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {post.isPinned && <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full">📌 Pinned</span>}
                    {post.isOpeningPost && <span className="bg-green-400 text-green-900 text-[10px] font-bold px-2 py-0.5 rounded-full">🎉 Opening</span>}
                    {post.isPromoted && <span className="bg-purple-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ Promoted</span>}
                  </div>
                  {/* Like count */}
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1">
                    <Heart size={12} /> {post._count.likes}
                  </div>
                </div>
                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Store size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-900 truncate">{post.store.storeName}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${getRoleBadge(post.store.owner.role)}`}>
                      {post.store.owner.role}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-1.5">{post.caption}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Calendar size={10} /> {formatDate(post.createdAt)}
                    </span>
                    {post.price && <span className="text-xs font-bold text-indigo-600">₹{post.price.toLocaleString()}</span>}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 mt-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="flex-1 text-xs font-medium text-gray-600 bg-gray-50 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={deleting === post.id}
                      className="flex-1 text-xs font-medium text-red-600 bg-red-50 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Trash2 size={12} /> {deleting === post.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 px-3 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <img
              src={selectedPost.imageUrl?.startsWith('http') ? selectedPost.imageUrl : `${API_BASE}${selectedPost.imageUrl}`}
              alt=""
              className="w-full aspect-video object-cover rounded-t-2xl"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x400?text=No+Image'; }}
            />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <Store size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedPost.store.storeName}</p>
                  <p className="text-xs text-gray-500">{selectedPost.store.owner.name} · {selectedPost.store.owner.role}</p>
                </div>
              </div>
              {selectedPost.caption && <p className="text-sm text-gray-700">{selectedPost.caption}</p>}
              <div className="flex gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Heart size={14} /> {selectedPost._count.likes} likes</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(selectedPost.createdAt)}</span>
                {selectedPost.price && <span className="font-bold text-indigo-600">₹{selectedPost.price.toLocaleString()}</span>}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setSelectedPost(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Close
                </button>
                <button
                  onClick={() => handleDelete(selectedPost.id)}
                  disabled={deleting === selectedPost.id}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 size={14} /> {deleting === selectedPost.id ? 'Deleting...' : 'Delete Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
