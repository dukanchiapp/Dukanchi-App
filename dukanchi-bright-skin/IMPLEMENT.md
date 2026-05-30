# Dukanchi Bright Skin — Claude Code Implementation Guide

> Read this whole file first. Your job is to **port an approved visual skin onto the existing app — exact values, no reinvention.** This is a RE-SKIN, not a redesign. If you find yourself choosing a color, radius, or font, STOP — the value is already defined here. Copy it.

---

## Why a previous attempt didn't match (read this)
The skin was handed over as a vibe ("make it look premium / like Blinkit"). That makes an agent *invent* — wrong oranges, wrong spacing, generic shadows. **Do not invent.** Every color, font, radius, shadow, and button rule is pinned below and in `tokens.css` / `tailwind.theme.js`. Use those literal values. When in doubt, open `bright.html` in a browser and match it pixel-for-pixel — it is the source of truth.

## Files in this folder
| File | Role |
|---|---|
| `bright.html` | **Source of truth.** The running skin. Open it; inspect any element to read exact styles. |
| `bright-skin.css` | All component classes + animations, ready to reuse. |
| `bright-screens.js` | Per-screen markup (template strings) — your structural reference. |
| `tokens.css` | **Drop-in** CSS variables. Paste at the top of your global stylesheet. |
| `tailwind.theme.js` | **Drop-in** Tailwind `extend` block (bg-brand, text-ink, shadow-card, font-display…). |
| `design-tokens.html` | Human-readable token spec sheet. |
| `ICONS.md` | **Exact icon + favicon reference** — every icon's Lucide name + literal SVG so Claude Code matches 1:1 (Profile page excluded). |

---

## Step 0 — Wire the foundation (do this before touching any screen)
1. Copy `tokens.css` to the **top** of `src/index.css` (or your global CSS). This gives you every `--b-*` variable + the optional yellow theme.
2. Merge `tailwind.theme.js`'s `extend` block into your `tailwind.config`.
3. Add the fonts: the `@import` is already in `tokens.css`. Confirm **Inter** (body) and **Sora** (headings) load.
4. Set the app background to `var(--b-surface)` (`#FAFAF7`) and base text to `var(--b-ink)`.
5. Commit. Now the tokens exist everywhere.

## Step 1 — Build 6 shared primitives FIRST (don't start on screens yet)
Build these as components, matching `bright.html` exactly, then reuse them everywhere:
1. **`<Header>`** — gradient bg (`var(--b-grad)`), 52px top pad (status bar overlaps), foreground uses `var(--b-on-grad)`. Add class `b-head` for the animated mesh sheen.
2. **`<BottomNav>`** — 5 tabs (Home/Search/Map/Chat/Profile), 62px tall, white, 1px top border `var(--b-line)`. Active tab tinted `var(--b-magenta-ink)`.
3. **`<StatusPill status>`** — capsule. open→green, soon→amber, ≤30m→orange, closed/≤15m→red. Classes `b-pill open|soon|closed|info`. Dot breathes.
4. **`<PostCard>`** — see spec table below. The most-used component; get it perfect.
5. **`<Button variant>`** — `grad` (hero), `green` (Follow/confirm), `blue` (Chat/Directions), `red` (destructive), plus `-soft` tinted variants. Classes in `bright-skin.css`.
6. **`<CategoryTile>`** — dimensional clay (`b-clay`), emoji at 26–30px, label 12px/700.

## Step 2 — Assemble screens from those primitives
Home → Search (+ Ask Nearby) → Map → Chat → Profile → Settings. One screen per commit. After each, open `bright.html` on the same screen and diff visually.

---

## EXACT component specs (copy these numbers)

### Header
- bg `var(--b-grad)` · padding `52px 16px 0` (home) / `…16px 16px` (search, messages)
- wordmark: Sora 19px/800, `var(--b-on-grad)`, letter-spacing −0.03em
- tagline: 11px, `var(--b-on-grad-soft)`
- logo tile: 40×40, radius 12px, bg `var(--b-chip-bg)`, glyph द 20px `var(--b-on-grad)`
- add class `b-head` for the living gradient-mesh sheen

### Post card (the workhorse)
- container: radius **22px**, bg `#fff`, border `1px solid #F1ECE4`, shadow `var(--b-elev-card)`
- avatar 46px circle · name Inter 15px/700 ink (max-width 170px, ellipsis, never wraps)
- verified tick: 14px green (#0C831F) circle + white check
- Follow button: `b-btn-green` (solid) → `Following` becomes plain/outline
- meta row (one line, nowrap): `<StatusPill>` · distance gray-2 700 · "·" · category `var(--b-magenta-ink)` 700
- product image: portrait, full-bleed top
- caption: 14px gray-1 · price: Inter 800 (e.g. ₹1,499)
- action row: Like=red filled · Chat=blue · Share=green · Save=ink

### Buttons — color = function (strict)
| Action | Class | Color |
|---|---|---|
| Ask Nearby (hero) | `b-btn-grad` | brand gradient |
| Follow / confirm / Send | `b-btn-green` / `b-btn-green-soft` | green |
| Chat / Directions / navigate | `b-btn-blue` / `b-btn-blue-soft` | blue |
| Logout / delete | `b-btn-red` | red |
- radius 14px · weight 800 · `:active { transform: scale(0.95) }`

### Category tile (clay)
- `b-clay`, radius 17px, the glossy `::after` sheen, soft drop + inset shadows (see `bright-skin.css`)
- tints rotate across blue-bg / green-bg / red-bg / tint by category

### Type scale
Sora 800 for: wordmark, screen titles ("Kya dhoondh rahe ho?", "Messages"), section headings (16px, −0.03em). Inter for everything else. Body 14/500, meta 11/700, price Inter 800.

### Motion (all transform/opacity — never gate opacity from 0 with `both` fill on a whole screen)
- page change: `b-dissolve` 0.34s · cards: `b-stagger` rise · stats: count-up · taps: `b-tap` scale(0.94) + `b-ripple` · live dot: `b-breathe`. Respect `prefers-reduced-motion`.

---

## Hard rules (the "don't reinvent" contract)
- ❌ Do NOT change features, routes, API calls, schema, sockets, auth, state, or copy (Hindi/Hinglish stays).
- ❌ Do NOT pick new colors/fonts/radii — only values from `tokens.css`.
- ❌ Do NOT substitute icons — use the EXACT Lucide names / SVG paths in `ICONS.md` (everywhere except the Profile page, which is out of scope).
- ❌ Do NOT add drop shadows or neon beyond the defined elevation tokens (this skin is flat + whisper-soft).
- ✅ DO open `bright.html` and match it. It is the spec.
- ✅ DO build the 6 primitives first, then compose screens.
- ✅ DO commit per screen and diff against `bright.html`.

## Paste-this prompt for Claude Code
> This folder is an approved visual re-skin of our Dukanchi app. Read `IMPLEMENT.md` and `ICONS.md` fully. This is a RE-SKIN, not a redesign — port EXACT values, do not invent colors/fonts/radii, and use the EXACT icons in `ICONS.md` (install `lucide-react` and use the named components, or paste the given SVG paths). Generate the favicon/app icon from the "द" gradient-tile spec in `ICONS.md`. Step 0: paste `tokens.css` into `src/index.css` and merge `tailwind.theme.js` into the Tailwind config. Step 1: build the 6 shared primitives matching `bright.html` exactly. Step 2: re-skin each screen one commit at a time, diffing against `bright.html`. **Do NOT modify the Profile / Store Profile page icons — out of scope.** Keep all features, routes, APIs, schema, sockets, auth, and Hindi/Hinglish copy unchanged. Show me each primitive before moving on.
