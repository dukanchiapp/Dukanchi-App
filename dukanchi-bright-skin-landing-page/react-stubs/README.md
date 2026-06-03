# React stubs — pre-built primitives

Six components, pre-filled with the **exact** approved classes and values. Claude Code's job shrinks to: import these, feed real data, wire real handlers. It should NOT restyle them.

| File | Component | Notes |
|---|---|---|
| `StatusPill.jsx` | `<StatusPill status label />` | open/soon/orange/closed/info. Dot breathes. |
| `Button.jsx` | `<Button variant />` | grad·green·blue·red + `-soft`. Color = function. |
| `Header.jsx` | `<Header title tagline onBell unread />` | Gradient + animated mesh sheen. 52px status overlap. |
| `BottomNav.jsx` | `<BottomNav active onChange />` | 5 tabs, magenta-ink active. |
| `CategoryTile.jsx` | `<CategoryTile emoji label bg />` + `CATEGORIES` | Clay 3D tile. Exports the 11 production categories. |
| `PostCard.jsx` | `<PostCard shop onChat onFollow onOpen />` | The workhorse. Like=red, Chat=blue, Share=green, Save=ink. |

## Requirements
1. `tokens.css` must be loaded globally (provides every `--b-*` var these use).
2. `bright-skin.css` must be loaded globally (provides `b-head`, `b-clay`, `b-tilt`, `b-tap`, `b-ripple`, keyframes like `b-breathe`).
3. Inter + Sora fonts loaded (the `@import` is in `tokens.css`).

## Style approach
These stubs use **inline styles referencing CSS vars** (e.g. `color: 'var(--b-ink)'`) so they work whether or not Tailwind is configured. If you prefer Tailwind utility classes, swap them using `tailwind.theme.js` mappings (`text-ink`, `bg-brand`, `shadow-card`, `font-display`, etc.) — the values are identical.

## Example assembly (Home screen)
```jsx
import Header from './Header';
import BottomNav from './BottomNav';
import PostCard from './PostCard';

function HomeScreen({ feed }) {
  const [tab, setTab] = React.useState('home');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--b-surface)' }}>
      <Header onBell={() => {/* open notifications */}} />
      <div className="b-stagger b-tilt-wrap" style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {feed.map(shop => (
          <PostCard key={shop.id} shop={shop}
            onChat={() => {/* route to chat */}}
            onFollow={() => {/* toggle follow */}}
            onOpen={() => {/* route to store profile */}} />
        ))}
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
```

## Sample `shop` shape for PostCard
```js
{
  id: 's1', name: 'Sharma Electronics', avatar: 'var(--b-grad)', verified: true,
  status: 'open', statusLabel: 'Open till 10pm', distance: '1.6 km', category: 'Electronics',
  area: 'Bandra Kurla Complex', pincode: '400051',
  image: 'linear-gradient(135deg,#E8F0FE,#FFF1EA)',  // replace with real <img>
  caption: 'Brand new PS5 in stock! Aaj hi le jao.', price: '₹1,499', following: false,
}
```
Replace `image`/`avatar` gradients with real `<img>` once you have product photos.
