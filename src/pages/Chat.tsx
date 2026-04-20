import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function ChatPage() {
  const { userId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverInitial, setReceiverInitial] = useState('');
  const [receiverLogo, setReceiverLogo] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const currentUserId = currentUser?.id || '';

  // Fetch receiver info once
  useEffect(() => {
    if (!userId || !token) return;
    fetch(`/api/users/${userId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(async (userData) => {
        if (!userData) return;
        if (['retailer', 'supplier', 'brand', 'manufacturer'].includes(userData.role)) {
          try {
            const storeRes = await fetch(`/api/users/${userId}/store`);
            const storeData = await storeRes.json();
            if (storeData?.storeName) {
              setReceiverName(storeData.storeName);
              setReceiverInitial(storeData.storeName.charAt(0));
              setReceiverLogo(storeData.logoUrl || '');
              return;
            }
          } catch {}
        }
        setReceiverName(userData.name || 'User');
        setReceiverInitial((userData.name || 'U').charAt(0));
      })
      .catch(() => { setReceiverName('User'); setReceiverInitial('U'); });
  }, [userId, token]);

  // Load message history once, then switch to Socket.IO for live updates
  useEffect(() => {
    if (!currentUserId || !token || !userId) return;

    // Initial fetch
    fetch(`/api/messages/${currentUserId}/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : { messages: [] })
      .then(data => setMessages(Array.isArray(data) ? data : (data.messages ?? [])))
      .catch(() => {});

    // Connect Socket.IO — replaces polling entirely
    const socket = io('/', { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('newMessage', (msg: any) => {
      // Only add messages that belong to this conversation
      const belongs =
        (msg.senderId === currentUserId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === currentUserId);
      if (!belongs) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, currentUserId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(file));
      setUploadError('');
    }
  };

  const clearImagePreview = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
    setImageFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || isSending) return;

    setIsSending(true);
    let uploadedImageUrl = null;

    if (imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          uploadedImageUrl = (await res.json()).url;
        } else {
          setUploadError('Image upload failed. Message sent without image.');
        }
      } catch {
        setUploadError('Image upload failed. Message sent without image.');
      }
    }

    // Send via HTTP — server emits newMessage via Socket.IO to both parties
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId: userId, message: newMessage, imageUrl: uploadedImageUrl })
      });
    } catch {}

    setNewMessage('');
    clearImagePreview();
    setIsSending(false);
  };

  return (
    <div className="max-w-md mx-auto bg-gray-50 h-screen flex flex-col">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <Link to="/messages" className="p-2 -ml-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
              {receiverLogo
                ? <img src={receiverLogo} alt="receiver logo" className="w-full h-full object-cover" />
                : receiverInitial || '?'
              }
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">{receiverName || 'Loading...'}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center my-4">
          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {messages.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            <p>No messages yet. Say hi! 👋</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                isMe
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'
              }`}>
                {msg.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                    <img src={msg.imageUrl} alt="attachment" className="w-full max-h-48 object-cover" loading="lazy" />
                  </div>
                )}
                {msg.message && <p>{msg.message}</p>}
                <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer className="bg-white p-4 border-t border-gray-100 pb-safe relative">
        {uploadError && (
          <div className="mb-2 flex items-center space-x-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-600">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{uploadError}</span>
            <button type="button" onClick={() => setUploadError('')} className="ml-auto"><X size={12} /></button>
          </div>
        )}
        {imagePreview && (
          <div className="absolute bottom-full left-0 right-0 bg-white p-3 border-t border-gray-100 flex items-center shadow-lg rounded-t-xl z-20">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
              <img src={imagePreview} className="w-full h-full object-cover" />
              <button onClick={clearImagePreview} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors" type="button">
                <X size={12} className="text-white" />
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <label className="p-2 text-gray-400 hover:bg-gray-50 rounded-full cursor-pointer transition-colors relative">
            <Paperclip size={24} />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 border-transparent rounded-full px-4 py-3 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm"
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !imageFile) || isSending}
            className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-sm"
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-1" />}
          </button>
        </form>
      </footer>
    </div>
  );
}
