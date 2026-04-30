import React from 'react';
import { Layers, Trash2, Check } from 'lucide-react';

interface ManagePostsTabProps {
  posts: any[];
  loading: boolean;
  selectedPostIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onDeleteSingle: (id: string) => void;
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

export const ManagePostsTab = React.memo(function ManagePostsTab({
  posts, loading, selectedPostIds, onToggleSelect, onDeleteSelected, onDeleteAll, onDeleteSingle,
}: ManagePostsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
        <div className="flex space-x-2">
          {selectedPostIds.size > 0 && (
            <button onClick={onDeleteSelected} className="text-red-600 text-xs font-semibold px-3 py-1.5 bg-red-50 rounded-lg flex items-center hover:bg-red-100 transition-colors">
              <Trash2 size={12} className="mr-1" /> Delete ({selectedPostIds.size})
            </button>
          )}
          {posts.length > 0 && (
            <button onClick={onDeleteAll} className="text-red-600 text-xs font-semibold px-3 py-1.5 bg-red-50 rounded-lg flex items-center hover:bg-red-100 transition-colors">
              <Trash2 size={12} className="mr-1" /> Delete All
            </button>
          )}
        </div>
      </div>
      {loading ? <SkeletonList /> : posts.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 text-gray-500">
          <Layers className="mx-auto h-10 w-10 text-gray-300 mb-2" /><p className="text-sm">No posts to manage.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex items-center">
              <button
                onClick={() => onToggleSelect(post.id)}
                className={`flex-shrink-0 w-10 h-full flex items-center justify-center border-r border-gray-100 ${selectedPostIds.has(post.id) ? 'bg-indigo-50' : 'bg-white'}`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selectedPostIds.has(post.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                  {selectedPostIds.has(post.id) && <Check size={12} className="text-white" />}
                </div>
              </button>
              <div className="w-16 h-16 flex-shrink-0 bg-gray-100">
                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
              </div>
              <div className="flex-1 px-3 py-2 min-w-0">
                <p className="text-sm text-gray-900 font-medium truncate">{post.caption || 'No caption'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(post.createdAt).toLocaleDateString()}</p>
                {post.isPinned && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">Pinned</span>}
              </div>
              <button onClick={() => onDeleteSingle(post.id)} className="flex-shrink-0 p-3 text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
