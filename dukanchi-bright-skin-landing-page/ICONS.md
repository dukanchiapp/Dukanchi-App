# Dukanchi — Icon & Favicon Reference (exact)

> Goal: Claude Code must use the **exact same icons** as the design — no substitutions. Every icon below is from the **Lucide / Feather** family (24×24 viewBox, `fill="none"`, `stroke-width="2"`, round caps/joins) unless noted. Two ways to match exactly:
> 1. **Preferred:** install `lucide-react` and use the named component (column "Lucide name").
> 2. **Or:** paste the literal `<svg>…` inner paths below.
>
> ⚠️ **Scope:** Apply these across the whole app **EXCEPT the Profile / Store Profile page** — leave that page's icons as they already are in production. (Profile rows, the role/verified badges, and rating stars on Profile are intentionally excluded.)

---

## 1. App icon / favicon / logo
The brand mark is **not** an image file — it is the Devanagari glyph **"द"** set in a rounded gradient tile. Reproduce it as the favicon, app icon, and in-app logo so it always matches.

| Use | Spec |
|---|---|
| In-app logo (header) | 40×40 tile, radius 12px, bg = brand gradient (`linear-gradient(135deg,#FFD63B,#FFB300)`), glyph "द" centered, color `#1C1A18`, font-weight 600, size 20px |
| App icon (1024²) | Same tile full-bleed, radius ~22% of size, glyph centered at ~52% of tile height |
| Favicon | Ship 16/32/180px PNGs of the same tile. Generation snippet below. |

**Favicon generator (run once, e.g. a Node/canvas or browser script):**
```html
<!-- render this at 512×512, export PNGs at 16/32/180/512 -->
<div style="width:512px;height:512px;border-radius:115px;
  background:linear-gradient(135deg,#FFD63B,#FFB300);
  display:flex;align-items:center;justify-content:center;
  font-family:'Sora',sans-serif;font-weight:600;font-size:300px;color:#1C1A18">द</div>
```
```html
<!-- index.html head -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#FFB300">
```
> Keep the glyph dark (`#1C1A18`) on the yellow tile — that's the committed (yellow-only) theme.

---

## 2. Bottom navigation (5 tabs) — Lucide, 24×24, stroke 2
Active tab: stroke color `var(--b-magenta-ink)` (#C77E00); **Home active is filled** (fill = same color, stroke-width 0). Inactive: stroke `#A8A8A8`.

| Tab | Lucide name | Inner SVG |
|---|---|---|
| Home | `Home` | `<path d="M3 9.5L12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z"/>` |
| Search | `Search` | `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` |
| Map | `MapPin` | `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>` |
| Chat | `MessageSquare` | `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` |
| Profile | `User` | `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>` |

---

## 3. Header & feed icons

| Where | Lucide name | Size / color | Inner SVG |
|---|---|---|---|
| Notification bell | `Bell` | 19–20px, `var(--b-on-grad)` | `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>` |
| Location pin (strip / chat meta) | `MapPin` | 14px, `#EA9A00` (brand) | `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>` |
| Filter (feed tabs) | `SlidersHorizontal` | 16px, `var(--b-ink)` | `<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>` |
| Verified tick | *custom badge* | 14px | `<circle cx="6.5" cy="6.5" r="6.5" fill="#0C831F"/><path d="M3.5 6.5l2 2 4-4" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` (13×13 viewBox, no outer stroke) |

### Post-card action row (color = function)
| Action | Lucide name | Color | Inner SVG |
|---|---|---|---|
| Like | `Heart` | `var(--b-red)` (filled when active) | `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>` |
| Chat | `MessageSquare` | `var(--b-blue)` | `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>` |
| Share | `Share2` | `var(--b-green)` | `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>` |
| Save | `Bookmark` | `var(--b-ink)` (filled when active) | `<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>` |

---

## 4. Search / Map / Chat icons

| Where | Lucide name | Color | Inner SVG |
|---|---|---|---|
| Search field glass | `Search` | `#A8A8A8`, stroke 2.2 | `<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>` |
| Search filter (brand) | `SlidersHorizontal` | `#EA9A00` | (same paths as Filter above) |
| Map re-center | `LocateFixed` | `var(--b-blue)` | `<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>` |
| Chat back chevron | `ChevronLeft` | varies | `<path d="M15 6l-6 6 6 6"/>` |
| Forward chevron (CTAs) | `ChevronRight` | varies | `<path d="M9 6l6 6-6 6"/>` |
| Composer attach | `Image` | `var(--b-gray-1)` | `<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>` |
| Composer send | `Send` | `#fff` on green circle | `<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>` |
| Direction to store | `Navigation` | `#fff` on blue btn | `<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>` |

---

## 5. Category-grid icons
The category tiles use **emoji**, not SVG (intentional — friendly, colorful, all-ages). Keep these exact emoji + tints:

| Category | Emoji | Tile tint |
|---|---|---|
| Food | 🍕 | `#FFE9D6` |
| Electronics | 📱 | `#E8F0FE` |
| Fashion | 👕 | `#E8F0FE` |
| Grocery | 🛒 | `#E8F5E9` |
| Beauty | 💄 | `#FDECEA` |
| Health | 💊 | `#E8F5E9` |
| Jewellery | 💍 | `#FFF1EA` |
| Home | 🏠 | `#E8F0FE` |
| Books | 📚 | `#E8F5E9` |
| Auto | 🚗 | `#FDECEA` |
| Services | 🛠️ | `#FFE9D6` |

Other decorative emoji used as-is: 📍 (Ask Nearby hero), 📡 (broadcasting), ✅ (success), 🔥 (trending first chip).

---

## 6. Implementation rule for Claude Code
1. `npm i lucide-react`. Use the named components in the tables above with `size={…}` `strokeWidth={2}` and the listed color. This guarantees a pixel-exact match.
2. For the **custom badges** (verified tick) and the **logo glyph "द"**, use the literal SVG/markup given — they are not Lucide.
3. Category tiles stay **emoji** — do not swap for icon fonts.
4. **Do NOT touch the Profile / Store Profile page icons** — out of scope per request.
5. Active states & colors are defined here and in `tokens.css`; do not invent new colors.
