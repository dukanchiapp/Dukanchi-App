import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { MessageSquare, Clock, ChevronRight, X, Tag } from 'lucide-react';
import api, { getAdminHeaders } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const POST_REF_PREFIX = '__POST_REF__:';

function decodePostRef(text: string) {
  try { return JSON.parse(text.slice(POST_REF_PREFIX.length)); } catch { return null; }
}

function PostRefBubble({ text, isMe, onOpen }: { text: string; isMe: boolean; onOpen: (post: any) => void }) {
  const post = decodePostRef(text);
  if (!post) return <p className="text-xs italic opacity-60">[Post]</p>;
  const imgSrc = post.imageUrl
    ? (post.imageUrl.startsWith('http') ? post.imageUrl : `${API_BASE}${post.imageUrl}`)
    : null;
  return (
    <button
      onClick={() => onOpen({ ...post, imgSrc })}
      className={`flex items-center overflow-hidden rounded-xl border max-w-[220px] text-left active:scale-95 transition-transform ${
        isMe ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      {imgSrc && (
        <img src={imgSrc} alt="post" className="w-14 h-14 object-cover flex-shrink-0" />
      )}
      <div className="px-3 py-2 min-w-0">
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest mb-1 ${isMe ? 'text-indigo-200' : 'text-indigo-500'}`}>
          <Tag size={8} /> Tap to view post
        </span>
        {post.price && (
          <p className={`text-sm font-extrabold leading-tight ${isMe ? 'text-white' : 'text-gray-900'}`}>
            ₹{Number(post.price).toLocaleString()}
          </p>
        )}
        {post.caption && (
          <p className={`text-[11px] truncate mt-0.5 ${isMe ? 'text-indigo-200' : 'text-gray-500'}`}>
            {post.caption}
          </p>
        )}
      </div>
    </button>
  );
}

function PostPreviewModal({ post, onClose }: { post: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <Tag size={13} className="text-indigo-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Post Preview</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <X size={15} className="text-gray-600" />
          </button>
        </div>

        {/* Image */}
        {post.imgSrc && (
          <div className="relative mx-4 mt-4 rounded-xl overflow-hidden bg-gray-100">
            <img src={post.imgSrc} alt="post" className="w-full object-cover max-h-64" />
            {post.price && (
              <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <Tag size={11} className="text-indigo-300" />
                <span className="text-sm font-extrabold">₹{Number(post.price).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Caption</p>
            <p className="text-sm text-gray-700 leading-relaxed">{post.caption}</p>
          </div>
        )}
        <div className="h-5" />
      </div>
    </div>
  );
}

function previewText(msg: string) {
  if (msg?.startsWith(POST_REF_PREFIX)) return '📎 Post reference';
  return msg;
}

interface ChatUser {
  id: string;
  name: string;
  role: string;
  kycStoreName?: string | null;
  stores?: { storeName: string }[];
}

interface Chat {
  id: string;
  user1: ChatUser;
  user2: ChatUser;
  lastMessage: string;
  timestamp: string;
  count: number;
}

interface Message {
  id: string;
  sender: ChatUser;
  receiver: ChatUser;
  message: string;
  imageUrl: string | null;
  createdAt: string;
}

// Helper: show business name for non-customers
const chatDisplayName = (user: ChatUser) => {
  if (user.role !== 'customer') {
    return user.stores && user.stores.length > 0 ? user.stores[0].storeName : (user.kycStoreName || user.name);
  }
  return user.name;
};

const chatDisplayNameFull = (user: ChatUser) => {
  if (user.role !== 'customer') {
    const bName = user.stores && user.stores.length > 0 ? user.stores[0].storeName : (user.kycStoreName || user.name);
    return bName !== user.name ? `${bName} (${user.name})` : bName;
  }
  return user.name;
};

export default function Chats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewPost, setPreviewPost] = useState<any>(null);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/chats', { headers: getAdminHeaders() });
      setChats(res.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (chat: Chat) => {
    setSelectedChat(chat);
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/admin/chats/history', { 
        headers: getAdminHeaders(),
        params: { u1: chat.user1.id, u2: chat.user2.id }
      });
      setHistory(res.data);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  };

  const roleBadge = (role: string) => {
    const c: Record<string, string> = {
      admin: 'bg-red-50 text-red-700',
      retailer: 'bg-blue-50 text-blue-700',
      customer: 'bg-gray-50 text-gray-700',
      supplier: 'bg-purple-50 text-purple-700',
      brand: 'bg-amber-50 text-amber-700',
      manufacturer: 'bg-emerald-50 text-emerald-700',
    };
    return c[role] || 'bg-gray-50 text-gray-700';
  };

  return (
    <AdminLayout title="Chat Monitoring">
      {previewPost && <PostPreviewModal post={previewPost} onClose={() => setPreviewPost(null)} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
        {/* Chat List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={18} className="text-indigo-600" /> Conversations
            </h2>
            <span className="text-xs bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 font-medium">{chats.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : chats.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <MessageSquare size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              chats.map(chat => (
                <button 
                  key={chat.id}
                  onClick={() => fetchHistory(chat)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-center gap-3 group ${selectedChat?.id === chat.id ? 'bg-indigo-50/50 ring-1 ring-inset ring-indigo-100' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{chatDisplayName(chat.user1)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${roleBadge(chat.user1.role)}`}>{chat.user1.role}</span>
                      <span className="text-[10px] text-gray-300">↔</span>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{chatDisplayName(chat.user2)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${roleBadge(chat.user2.role)}`}>{chat.user2.role}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-1.5">{previewText(chat.lastMessage)}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Clock size={10} /> {new Date(chat.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      <span className="inline-block w-1 h-1 bg-gray-200 rounded-full" />
                      {chat.count} messages
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-gray-300 group-hover:text-gray-500 transition-colors ${selectedChat?.id === chat.id ? 'text-indigo-400' : ''}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat History */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden shadow-sm relative">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare size={32} className="opacity-20 text-indigo-600" />
              </div>
              <h3 className="text-gray-900 font-bold mb-1">Select a Conversation</h3>
              <p className="text-sm max-w-[200px]">Click on a conversation to monitor the messages and media shared between users.</p>
            </div>
          ) : (
            <>
              {/* History Header */}
              <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 font-bold text-xs ring-1 ring-indigo-50">
                      {chatDisplayName(selectedChat.user1)[0]}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-emerald-700 font-bold text-xs ring-1 ring-emerald-50">
                      {chatDisplayName(selectedChat.user2)[0]}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{chatDisplayNameFull(selectedChat.user1)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(selectedChat.user1.role)}`}>{selectedChat.user1.role}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-gray-900">{chatDisplayNameFull(selectedChat.user2)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleBadge(selectedChat.user2.role)}`}>{selectedChat.user2.role}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedChat(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
                {historyLoading ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                ) : (
                  history.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender.id === selectedChat.user1.id ? 'items-start' : 'items-end'}`}>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{chatDisplayName(msg.sender)}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${roleBadge(msg.sender.role || '')}`}>{msg.sender.role}</span>
                        <span className="text-[9px] text-gray-300">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {(() => {
                        const isMe = msg.sender.id === selectedChat.user1.id;
                        const isPostRef = msg.message?.startsWith(POST_REF_PREFIX);
                        return (
                          <div className={`max-w-[85%] shadow-sm rounded-2xl text-sm ${
                            isMe
                              ? 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                              : 'bg-indigo-600 text-white rounded-tr-none'
                          } ${isPostRef ? 'p-1.5' : 'px-4 py-2.5'}`}>
                            {isPostRef ? (
                              <PostRefBubble text={msg.message} isMe={!isMe} onOpen={setPreviewPost} />
                            ) : (
                              <>
                                {msg.message && <p className="leading-relaxed">{msg.message}</p>}
                                {msg.imageUrl && (
                                  <img
                                    src={msg.imageUrl.startsWith('http') ? msg.imageUrl : `${API_BASE}${msg.imageUrl}`}
                                    alt="Attachment"
                                    className="mt-2 rounded-lg max-h-60 w-full object-cover border border-black/5 cursor-pointer hover:brightness-95 transition-all"
                                    onClick={() => window.open(msg.imageUrl!.startsWith('http') ? msg.imageUrl! : `${API_BASE}${msg.imageUrl}`, '_blank')}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
