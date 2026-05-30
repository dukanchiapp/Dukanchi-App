// Dukanchi · Bright (Blinkit-style) Skin — screens renderer (vanilla JS, no deps)

const BS = {
  cats: [
    { l: 'Food', e: '🍕', bg: '#FFE9D6' }, { l: 'Electronics', e: '📱', bg: '#E8F0FE' },
    { l: 'Fashion', e: '👕', bg: '#E8F0FE' }, { l: 'Grocery', e: '🛒', bg: '#E8F5E9' },
    { l: 'Beauty', e: '💄', bg: '#FDECEA' }, { l: 'Health', e: '💊', bg: '#E8F5E9' },
    { l: 'Jewellery', e: '💍', bg: '#FFF1EA' }, { l: 'Home', e: '🏠', bg: '#E8F0FE' },
    { l: 'Books', e: '📚', bg: '#E8F5E9' }, { l: 'Auto', e: '🚗', bg: '#FDECEA' },
    { l: 'Services', e: '🛠️', bg: '#FFE9D6' },
  ],
  stores: [
    { n: 'test store', rating: '4.2', dist: '3 min away', cat: 'Electronics', area: 'Kurla West', status: ['open','Open 24h'], img: 'linear-gradient(135deg,#FFB74D,#F57C00)', badge: 'OPEN 24h' },
    { n: 'Sharma Electronics', rating: '4.8', dist: '1.2 km', cat: 'Electronics', area: 'Andheri West', status: ['soon','Closes in 42m'], img: 'linear-gradient(135deg,#4DB6AC,#00897B)' },
    { n: 'Dolphin hotel', rating: '—', dist: '1.6 km', cat: 'Jewellery', area: 'Shiv Chowk', status: ['closed','Closed today'], img: 'linear-gradient(135deg,#9575CD,#5E35B1)' },
  ],
  products: [
    { n: 'PS5 Disc Edition Console', qty: '1 unit', price: '₹49,990', eta: '3 min', img: 'linear-gradient(135deg,#E1F5FE,#B3E5FC)' },
    { n: 'iPhone 16 Pro 256GB', qty: '1 unit', price: '₹1,19,900', eta: '5 min', img: 'linear-gradient(135deg,#FFF8E1,#FFE082)' },
    { n: 'Diwali Dry Fruits Box', qty: '500 g', price: '₹599', eta: '2 min', img: 'linear-gradient(135deg,#F1F8E9,#C5E1A5)' },
  ],
  convos: [
    { n: 'test store', role: 'business', status: ['open','Open 24h'], dist: '3 min', cat: 'Electronics', area: 'Kurla West', last: 'Haan ji, available hai!', time: '2m' },
    { n: 'Sharma Electronics', role: 'business', status: ['soon','Closes 42m'], dist: '1.2 km', cat: 'Electronics', area: 'Andheri W', last: 'Aa jao 6 baje', time: '1h' },
    { n: 'Deep', role: 'customer', last: 'hi', time: '3h' },
    { n: 'Mandy', role: 'customer', last: 'sir kya milega', time: '5h' },
  ],
};

const statusPill = (s) => `<span class="b-pill ${s[0]}">${s[1]}</span>`;

// ── HOME — matches the real app: header + location strip + carousel + tabs + post feed ──
function bsHome() {
  const posts = [
    { n: 'Nikhil Bhai', verified: true, status: ['open','Open 24h'], dist: '1.6 km', cat: 'Services', area: 'Bandra · 400050', avatar: 'linear-gradient(135deg,#FF6B35,#FF2A8C)', img: 'linear-gradient(135deg,#2B1B5B,#7C3AED)', likes: 12, following: true, cap: '<b>Welcome to Nikhil Bhai!</b> 24x7 home services — plumbing, electrical, AC repair.' },
    { n: 'Sharma Electronics', verified: true, status: ['soon','Closes in 42m'], dist: '1.2 km', cat: 'Electronics', area: 'Andheri W · 400053', avatar: 'linear-gradient(135deg,#FFA94D,#FF6B35)', img: 'linear-gradient(135deg,#1A0B0B,#FF6B35)', likes: 87, following: false, cap: '<b>Fresh PS5 stock!</b> MRP pe seedha dukaan se — koi delivery fee nahi.' },
  ];
  return `
  <div class="b-scroll">
    <!-- Header: logo + bell (gradient, status bar merges over it) -->
    <div class="b-head" style="background:var(--b-grad);padding:52px 16px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:14px">
        <div style="display:flex;align-items:center;gap:11px">
          <div style="width:40px;height:40px;border-radius:12px;background:var(--b-chip-bg);border:1px solid var(--b-chip-line);display:flex;align-items:center;justify-content:center;color:var(--b-on-grad);font-weight:600;font-size:20px">द</div>
          <div><div style="font-size:19px;font-weight:800;font-family:var(--b-display);color:var(--b-on-grad);letter-spacing:-0.03em;line-height:1.1">Dukanchi</div><div style="font-size:11px;color:var(--b-on-grad-soft);line-height:1.1">apna bazaar, apni dukaan</div></div>
        </div>
        <button style="width:42px;height:42px;border-radius:14px;background:var(--b-chip-bg);border:1px solid var(--b-chip-line);display:flex;align-items:center;justify-content:center;position:relative">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" stroke-width="2" stroke-linecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span style="position:absolute;top:8px;right:10px;width:8px;height:8px;border-radius:50%;background:#fff"></span>
        </button>
      </div>
    </div>
    <!-- Location strip -->
    <div style="background:var(--b-tint);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #FFE0D4">
      <div style="display:flex;align-items:center;gap:8px;min-width:0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF2A8C" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span style="font-size:13px;color:var(--b-gray-1);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Showing stores near <b style="color:var(--b-ink)">Kurla West</b></span>
      </div>
      <button style="background:none;border:none;color:var(--b-magenta-ink);font-size:13px;font-weight:700;font-family:inherit">Change</button>
    </div>
    <!-- Carousel -->
    <div style="padding:14px 16px 8px">
      <div style="position:relative;border-radius:18px;overflow:hidden;aspect-ratio:16/9">
        <div style="position:absolute;inset:0;background:var(--b-grad)"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.4))"></div>
        <div style="position:absolute;bottom:16px;left:18px;right:18px;color:#fff">
          <div style="font-size:10px;font-weight:800;letter-spacing:0.6px;text-transform:uppercase;opacity:0.9;margin-bottom:4px">Tonight near you</div>
          <div style="font-size:19px;font-weight:800;letter-spacing:-0.02em">Diwali Sale · 30% tak</div>
        </div>
        <div style="position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:5px">
          <span style="width:18px;height:5px;border-radius:3px;background:#fff"></span><span style="width:5px;height:5px;border-radius:3px;background:rgba(255,255,255,0.5)"></span><span style="width:5px;height:5px;border-radius:3px;background:rgba(255,255,255,0.5)"></span>
        </div>
      </div>
    </div>
    <!-- Tabs + filter -->
    <div style="padding:6px 16px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div style="display:flex;padding:4px;border-radius:9999px;gap:2px;background:var(--b-surface)">
        ${['For you','Following','Saved'].map((t,i)=>`<button style="padding:8px 16px;border-radius:9999px;font-size:12px;font-weight:700;cursor:pointer;border:none;font-family:inherit;${i===0?'background:var(--b-grad);color:var(--b-on-grad)':'background:transparent;color:var(--b-gray-2)'}">${t}</button>`).join('')}
      </div>
      <button style="width:38px;height:38px;border-radius:12px;border:1px solid var(--b-line);background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--b-ink)" stroke-width="2" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
      </button>
    </div>
    <!-- Post feed -->
    <div style="padding:4px 16px 20px;display:flex;flex-direction:column;gap:16px" class="b-stagger b-tilt-wrap">
      ${posts.map(p => `<div data-store="${p.n}" class="b-tilt" style="border-radius:22px;overflow:hidden;background:#fff;border:1px solid #F1ECE4;box-shadow:var(--b-elev-card);cursor:pointer">
        <div style="padding:14px 14px 12px;display:flex;align-items:center;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:${p.avatar};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:17px;flex-shrink:0">${p.n[0]}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:15px;font-weight:700;color:var(--b-ink);white-space:nowrap;flex-shrink:0;max-width:170px;overflow:hidden;text-overflow:ellipsis">${p.n}</span>
              ${p.verified?'<svg width="14" height="14" viewBox="0 0 13 13" fill="none" style="flex-shrink:0"><circle cx="6.5" cy="6.5" r="6.5" fill="#0C831F"/><path d="M3.5 6.5l2 2 4-4" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}
              <span style="flex:1"></span>
              <button class="${p.following?'':'b-btn-green'}" style="padding:6px 14px;border-radius:9999px;font-size:11.5px;font-weight:700;flex-shrink:0;${p.following?'background:#fff;border:1px solid var(--b-line);color:var(--b-gray-2)':'border:none'}">${p.following?'Following':'Follow'}</button>
            </div>
            <div style="display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11px;white-space:nowrap;overflow:hidden">${statusPill(p.status)}<span style="color:var(--b-gray-2);font-weight:600;flex-shrink:0">${p.dist}</span><span style="color:var(--b-gray-3);flex-shrink:0">·</span><span style="color:var(--b-magenta-ink);font-weight:700;flex-shrink:0">${p.cat}</span></div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:4px;font-size:10.5px;color:var(--b-gray-3)">📍 ${p.area}</div>
          </div>
        </div>
        <div style="aspect-ratio:4/5;background:${p.img};position:relative"><div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,0.2),transparent 50%)"></div></div>
        <div style="padding:14px 16px 8px;display:flex;align-items:center;gap:22px">
          <span style="display:flex;align-items:center;gap:6px"><svg width="22" height="22" viewBox="0 0 24 24" fill="var(--b-red)" stroke="var(--b-red)" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span style="font-size:13px;font-weight:700;color:var(--b-ink)">${p.likes}</span></span>
          <span style="display:flex;align-items:center;gap:6px"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--b-blue)" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span style="font-size:13px;font-weight:600;color:var(--b-blue)">Chat</span></span>
          <span style="display:flex;align-items:center;gap:6px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-green)" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span style="font-size:13px;font-weight:600;color:var(--b-green)">Share</span></span>
          <span style="flex:1"></span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--b-ink)" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
        <p style="margin:0;padding:0 16px 16px;font-size:13px;line-height:1.45;color:var(--b-gray-1)">${p.cap}</p>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── SEARCH ──
function bsSearch() {
  const trending = ['PS5', 'iPhone 15', 'perfumes', 'earbuds', 'Diwali lights'];
  return `
  <div class="b-scroll">
    <div class="b-head" style="background:var(--b-grad);padding:52px 16px 16px">
      <div style="font-size:23px;font-weight:800;font-family:var(--b-display);color:var(--b-on-grad);letter-spacing:-0.03em;margin-bottom:14px">Kya dhoondh rahe ho?</div>
      <div style="display:flex;gap:8px">
        <div style="flex:1;background:#fff;border-radius:12px;height:46px;display:flex;align-items:center;gap:10px;padding:0 14px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search products, brands, stores" style="flex:1;border:none;outline:none;font-family:inherit;font-size:14px;background:transparent"/>
        </div>
        <button style="width:46px;height:46px;border-radius:12px;border:none;background:#fff;display:flex;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" stroke-width="2" stroke-linecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
        </button>
      </div>
    </div>
    <div class="b-section"><div class="b-eyebrow" style="margin-bottom:12px">Trending near you</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px">
        ${trending.map((t,i) => `<button style="padding:9px 15px;border-radius:9999px;font-size:13px;font-weight:600;color:var(--b-ink);border:1px solid var(--b-line);background:#fff;cursor:pointer;font-family:inherit;white-space:nowrap" class="b-tap">${i===0?'🔥 ':''}${t}</button>`).join('')}
      </div>
      <div class="b-eyebrow" style="margin-bottom:12px">Browse by category</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px" class="b-stagger b-tilt-wrap">
        ${BS.cats.map(c => `<div class="b-tap b-tilt" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:14px 4px;border-radius:18px;border:1px solid #F1ECE4;background:#fff;box-shadow:var(--b-elev-1)">
          <div class="b-clay b-clay-emoji-wrap" style="width:46px;height:46px;background:${c.bg};font-size:24px"><span class="b-clay-emoji">${c.e}</span></div>
          <div style="font-size:11px;font-weight:700;color:var(--b-ink)">${c.l}</div></div>`).join('')}
      </div>
    </div>
    <div style="margin:18px 16px 0;border-radius:16px;overflow:hidden;border:1px solid #FFD3C4;background:var(--b-tint)">
      <div style="padding:16px;display:flex;gap:12px;align-items:flex-start">
        <span class="b-float3d" style="font-size:30px;flex-shrink:0">📍</span>
        <div><div style="font-size:16px;font-weight:800;color:var(--b-ink)">Aur dhundho nearby?</div><div style="font-size:12px;color:var(--b-gray-2);margin-top:3px;line-height:1.5">Aapke area ki shops se seedha poocho — sirf wahi dikhenge jiske paas stock hai</div></div>
      </div>
      <div style="padding:0 14px 14px"><button class="b-btn-grad" style="width:100%;padding:13px;border-radius:12px;font-size:14px">Nearby shops se poocho ›</button></div>
    </div>
    <div style="height:18px"></div>
  </div>`;
}

// ── MAP ──
function bsMap() {
  return `
  <div class="b-scroll" style="display:flex;flex-direction:column;overflow:hidden">
    <div class="b-head" style="background:var(--b-grad);padding:52px 16px 14px">
      <div style="background:#fff;border-radius:12px;height:44px;display:flex;align-items:center;gap:10px;padding:0 14px;margin-bottom:10px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Search stores near you" style="flex:1;border:none;outline:none;font-family:inherit;font-size:13px;background:transparent"/>
      </div>
      <div style="display:flex;gap:6px;overflow-x:auto">
        ${['All','Food','Electronics','Fashion','Grocery'].map((c,i) => `<button style="padding:7px 14px;border-radius:9999px;font-size:12px;font-weight:700;white-space:nowrap;border:none;cursor:pointer;font-family:inherit;${i===0?'background:#fff;color:var(--b-magenta-ink)':'background:rgba(255,255,255,0.22);color:#fff'}">${c}</button>`).join('')}
      </div>
    </div>
    <div style="flex:1;position:relative;background:#E8E0D2;min-height:300px;overflow:hidden">
      <div style="position:absolute;inset:0;background-image:linear-gradient(135deg,#F4ECDC 25%,transparent 25%),linear-gradient(45deg,#F4ECDC 25%,transparent 25%);background-size:120px 120px;opacity:0.6"></div>
      <svg width="100%" height="100%" style="position:absolute;inset:0" preserveAspectRatio="none"><path d="M0,140 Q120,170 240,150 T480,180" stroke="#fff" stroke-width="4" fill="none" opacity="0.8"/><path d="M90,0 L110,400" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/><path d="M280,0 L260,400" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/></svg>
      <span style="position:absolute;top:18%;left:16%;font-size:10px;color:#5A4A38;font-weight:700;letter-spacing:0.5px">KURLA W</span>
      <span style="position:absolute;top:60%;left:58%;font-size:10px;color:#5A4A38;font-weight:700;letter-spacing:0.5px">ANDHERI</span>
      ${[['32%','34%','#FF6B35','S'],['62%','52%','#FF2A8C','N'],['46%','66%','#E53935','D']].map(([x,y,c,l]) => `<div style="position:absolute;left:${x};top:${y};transform:translate(-50%,-100%)"><div style="width:36px;height:36px;border-radius:50%;background:${c};border:3px solid #fff}80;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:800">${l}</div></div>`).join('')}
      <div style="position:absolute;left:45%;top:52%;transform:translate(-50%,-50%)"><span style="position:absolute;inset:-16px;border-radius:50%;background:#3B82F6;opacity:0.2"></span><span style="display:block;width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff"></span></div>
      <div style="position:absolute;top:12px;left:14px;background:#fff;border-radius:9999px;padding:7px 13px;font-size:11px;font-weight:700"><span style="color:var(--b-magenta-ink)">●</span> <b style="color:var(--b-magenta-ink)">2</b> stores nearby</div>
    </div>
    <div style="background:#fff;border-radius:20px 20px 0 0;border-top:1px solid var(--b-line);padding:14px 14px 12px;flex-shrink:0">
      <div style="width:40px;height:4px;border-radius:2px;background:var(--b-line);margin:0 auto 10px"></div>
      <div style="font-size:14px;font-weight:800;margin-bottom:10px">Stores near you · <span style="color:var(--b-magenta-ink)">2</span></div>
      <div style="display:flex;gap:10px;overflow-x:auto;margin-right:-14px;padding-right:14px">
        ${BS.stores.slice(0,2).map(s => `<div class="bs-store-card" data-store="${s.n}" style="width:180px;flex-shrink:0;border-radius:14px;overflow:hidden;border:1px solid var(--b-line);cursor:pointer">
          <div style="aspect-ratio:4/3;background:${s.img}"></div>
          <div style="padding:10px 12px"><div style="font-size:14px;font-weight:700">${s.n}</div><div style="margin-top:5px">${statusPill(s.status)}</div><div style="font-size:11px;color:var(--b-gray-2);margin-top:5px">${s.dist} · ${s.cat}</div></div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── CHAT (messages list) ──
function bsChat() {
  return `
  <div class="b-scroll">
    <div class="b-head" style="background:var(--b-grad);padding:52px 16px 16px">
      <div style="font-size:25px;font-weight:800;font-family:var(--b-display);color:var(--b-on-grad);letter-spacing:-0.03em;margin-bottom:14px">Messages</div>
      <div style="background:#fff;border-radius:12px;height:44px;display:flex;align-items:center;gap:10px;padding:0 14px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A8A8A8" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Search conversations" style="flex:1;border:none;outline:none;font-family:inherit;font-size:14px;background:transparent"/>
      </div>
    </div>
    <div style="padding:8px 0">
      ${BS.convos.map(c => `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--b-line)">
        <div style="width:50px;height:50px;border-radius:14px;background:var(--b-grad);display:flex;align-items:center;justify-content:center;color:var(--b-on-grad);font-weight:800;font-size:19px;flex-shrink:0">${c.n[0]}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;color:var(--b-ink)">${c.n}</div>
          ${c.role === 'business' ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">${statusPill(c.status)}<span style="font-size:11px;color:var(--b-gray-2);font-weight:600">${c.dist}</span><span style="font-size:11px;color:var(--b-magenta-ink);font-weight:700">· ${c.cat}</span></div>
          <div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--b-gray-3);margin-top:3px">📍 ${c.area}</div>` : ''}
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:4px"><span style="font-size:13px;color:var(--b-gray-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${c.last}</span><span style="font-size:11px;color:var(--b-gray-3);flex-shrink:0">${c.time}</span></div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── PROFILE ──
function bsProfile() {
  return `
  <div class="b-scroll">
    <!-- Banner with back / bell / settings -->
    <div class="b-head" style="position:relative;aspect-ratio:16/8.5;background:var(--b-grad)">
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,0.22))"></div>
      <button class="b-tap" style="position:absolute;top:44px;left:16px;width:42px;height:42px;border-radius:14px;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <div style="position:absolute;top:44px;right:16px;display:flex;gap:8px">
        <button class="b-tap" style="position:relative;width:42px;height:42px;border-radius:14px;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" stroke-width="2" stroke-linecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span style="position:absolute;top:9px;right:11px;width:8px;height:8px;border-radius:50%;background:#fff"></span></button>
        <button class="b-tap" style="width:42px;height:42px;border-radius:14px;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
      </div>
    </div>
    <div style="padding:0 20px;margin-top:-42px;position:relative">
      <!-- DP + distance pill -->
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:16px">
        <div style="width:84px;height:84px;border-radius:22px;background:var(--b-grad);border:4px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:34px">D</div>
        <span style="display:inline-flex;align-items:center;gap:5px;padding:7px 12px;border-radius:9999px;background:#fff;border:1px solid var(--b-line);font-size:11px;font-weight:700;margin-bottom:8px">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF2A8C" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> 1.6 km away
        </span>
      </div>
      <!-- Name + stars -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <h1 style="font-size:25px;font-weight:800;letter-spacing:-0.03em">Dolphin hotel</h1>
        <div style="display:flex;gap:1px">${[0,0,0,0,0].map(f=>`<svg width="15" height="15" viewBox="0 0 24 24" fill="${f?'#FFB800':'none'}" stroke="${f?'#FFB800':'#D8D2CB'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`).join('')}</div>
      </div>
      <!-- Role + category + status -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="padding:4px 11px;border-radius:9999px;font-size:10px;font-weight:800;letter-spacing:1px;background:var(--b-grad);color:var(--b-on-grad)">RETAIL</span>
        <span style="font-size:14px;color:var(--b-gray-2);font-weight:500">Jewellery</span>
        <span style="color:var(--b-gray-3)">·</span>
        <span class="b-pill closed" style="font-size:11px">Closed Today</span>
      </div>
      <!-- Bio -->
      <p style="font-size:14px;color:var(--b-gray-1);line-height:1.55;margin-bottom:6px">Dolphin Hotel General Store mein aapka swagat hai! Yahaan milega sab kuch, bilkul aapke trust aur comfort ke liye. Apni local needs ke liye hum par bharosa karein, jaisa ek 4-star experience hota hai.</p>
      <span class="b-tap" style="color:var(--b-magenta-ink);font-size:12.5px;font-weight:700;display:inline-block;white-space:nowrap">Read more</span>
      <!-- Info card -->
      <div style="margin:16px 0;border-radius:18px;background:#fff;border:1px solid var(--b-line);padding:16px 18px">
        ${[
          ['mappin','Shiv Chowk','110086 · North West Delhi, Delhi'],
          ['phone','+917654321098',''],
          ['clock','10:00 AM – 9:00 PM','Mon, Tue, Wed, Thu, Fri'],
        ].map(([ic,main,sub])=>{
          const svg = ic==='mappin'?'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'
            : ic==='phone'?'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>'
            : '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>';
          return `<div style="display:flex;align-items:flex-start;gap:12px;padding:7px 0">
            <span style="width:30px;height:30px;border-radius:10px;background:var(--b-tint);border:1px solid var(--b-orange);opacity:1;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF2A8C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></span>
            <div style="flex:1;min-width:0"><div style="font-size:13.5px;color:var(--b-ink);font-weight:600;line-height:1.35">${main}</div>${sub?`<div style="font-size:12px;color:var(--b-gray-3);margin-top:3px">${sub}</div>`:''}</div>
          </div>`;
        }).join('')}
        <button class="b-btn-blue" style="width:100%;margin-top:12px;padding:14px;border-radius:14px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Direction to Store</button>
      </div>
      <!-- Stats -->
      <div style="display:flex;gap:10px;margin-bottom:16px">
        ${[['1284','Followers'],['47','Posts'],['312','Reviews']].map(([v,l])=>`<div style="flex:1;padding:15px 8px;border-radius:16px;background:#fff;border:1px solid #F1ECE4;box-shadow:var(--b-elev-1);text-align:center"><div data-count="${v}" style="font-size:22px;font-weight:800;font-family:var(--b-display)">0</div><div style="font-size:10px;color:var(--b-gray-2);text-transform:uppercase;letter-spacing:0.6px;margin-top:5px;font-weight:700">${l}</div></div>`).join('')}
      </div>
      <!-- Follow + Chat -->
      <div style="display:flex;gap:10px;margin-bottom:20px">
        <button class="b-btn-green-soft" style="flex:1;padding:14px;border-radius:14px;font-size:14px">Follow</button>
        <button class="b-btn-blue" style="flex:1;padding:14px;border-radius:14px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:7px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Chat</button>
      </div>
      <!-- Posts / Reviews tabs -->
      <div style="display:flex;border-bottom:1px solid var(--b-line);margin-bottom:14px">
        <button style="flex:1;padding:12px 0;background:none;border:none;border-bottom:2px solid var(--b-orange);color:var(--b-ink);font-size:14px;font-weight:800;font-family:inherit">Posts 1</button>
        <button style="flex:1;padding:12px 0;background:none;border:none;color:var(--b-gray-3);font-size:14px;font-weight:500;font-family:inherit">Reviews 0</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;padding-bottom:20px">
        <div style="aspect-ratio:1;background:linear-gradient(135deg,#9575CD,#5E35B1);border-radius:10px;position:relative"><span style="position:absolute;top:6px;left:8px;font-size:9px;font-weight:800;color:#fff;letter-spacing:0.5px;padding:2px 6px;border-radius:6px;background:rgba(0,0,0,0.4)">STORE</span></div>
      </div>
    </div>
  </div>`;
}

window.BS_SCREENS = { home: bsHome, search: bsSearch, map: bsMap, chat: bsChat, profile: bsProfile };
