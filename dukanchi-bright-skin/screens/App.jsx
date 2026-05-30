// App.jsx — shell wiring screens + bottom nav together (reference scaffold)
// This shows how the pieces connect. In your real app, replace local state
// with your router + data layer. Keep features/routes — only the visual shell is new.
import React from 'react';
import BottomNav from '../react-stubs/BottomNav';
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import AskNearby from './AskNearby';
import ChatScreen from './ChatScreen';
import StoreProfile from './StoreProfile';
// import MapScreen from './MapScreen'; // build to match bright.html's map

const SAMPLE_FEED = [
  { id: 's1', name: 'Sharma Electronics', avatar: 'var(--b-grad)', verified: true, status: 'open',
    statusLabel: 'Open till 10pm', distance: '1.6 km', category: 'Electronics', area: 'BKC', pincode: '400051',
    image: 'linear-gradient(135deg,#E8F0FE,#FFF1EA)', caption: 'Brand new PS5 in stock! Aaj hi le jao.', price: '₹1,499', following: false },
  { id: 's2', name: 'Verma Kirana Store', avatar: 'var(--b-green)', verified: true, status: 'soon',
    statusLabel: 'Closes in 48m', distance: '0.8 km', category: 'Grocery', area: 'Kurla', pincode: '400070',
    image: 'linear-gradient(135deg,#E8F5E9,#FFF1EA)', caption: 'Fresh stock aa gaya hai 🛒', price: '₹249', following: true },
];

export default function App() {
  const [tab, setTab] = React.useState('home');
  const [overlay, setOverlay] = React.useState(null); // 'ask' | 'chat' | 'store'
  const [active, setActive] = React.useState(null);

  const screen = {
    home: <HomeScreen feed={SAMPLE_FEED} onOpenStore={s => { setActive(s); setOverlay('store'); }} onChat={s => { setActive(s); setOverlay('chat'); }} />,
    search: <SearchScreen onAskNearby={() => setOverlay('ask')} onCategory={() => {}} onSearch={() => {}} />,
    map: <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--b-gray-2)' }}>Map — build to match bright.html</div>,
    chat: <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--b-gray-2)' }}>Messages list — rows with avatar + last msg + status</div>,
    profile: <StoreProfile isOwner store={{ name: 'Meri Dukaan', role: 'RETAIL' }} />,
  }[tab];

  return (
    <div style={{ width: 390, height: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', background: 'var(--b-surface)', position: 'relative', overflow: 'hidden' }}>
      <div className="b-page-right" key={tab} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {screen}
      </div>
      <BottomNav active={tab} onChange={setTab} />

      {overlay === 'ask' && <AskNearby onClose={() => setOverlay(null)} />}
      {overlay === 'chat' && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--b-surface)', zIndex: 40 }}><ChatScreen peer={active} messages={[{ out: false, text: 'Namaste! Kaise help kar sakte hain?', time: '2:14 PM' }, { out: true, text: 'PS5 available hai?', time: '2:15 PM' }]} onBack={() => setOverlay(null)} onSend={() => {}} /></div>}
      {overlay === 'store' && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--b-surface)', zIndex: 40 }}><StoreProfile store={active} onBack={() => setOverlay(null)} onChat={() => setOverlay('chat')} /></div>}
    </div>
  );
}
