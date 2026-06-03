# Screens — assembled from the primitives

Copy-paste-ready screen scaffolds. Each imports the primitives in `../react-stubs/` and lays them out to match `bright.html`. Wire real data + handlers; don't restyle.

| File | Screen | Status |
|---|---|---|
| `App.jsx` | Shell: screens + bottom nav + overlays | Reference scaffold |
| `HomeScreen.jsx` | Feed: header, location strip, carousel, tabs, post cards | ✅ complete |
| `SearchScreen.jsx` | Search bar, trending, category grid, Ask Nearby CTA | ✅ complete |
| `AskNearby.jsx` | Hero feature: compose → broadcasting (radar) → success | ✅ complete |
| `ChatScreen.jsx` | Thread: peer header + bubbles + composer (Send=green) | ✅ complete |
| `StoreProfile.jsx` | Banner + DP + info + stats + actions + posts grid | ✅ complete |
| `MapScreen.jsx` | Pins + "N nearby" pill + bottom-sheet store cards | ✅ complete (mount real map as base layer) |
| `MessagesScreen.jsx` | Conversation rows (avatar + last msg + status + unread) | ✅ complete |

## One global addition
`AskNearby.jsx`'s radar needs this keyframe in your global CSS (add once):
```css
@keyframes b-radar { 0% { transform: scale(0.3); opacity: 0.8 } 100% { transform: scale(1); opacity: 0 } }
```

## Requirements (same as primitives)
1. `tokens.css` loaded globally.
2. `bright-skin.css` loaded globally (provides `b-head`, `b-clay`, `b-tilt-wrap`, `b-stagger`, `b-page-right`, `b-float3d`, `b-pop`, `data-count` count-up is wired in `bright.html`'s `enhance()` — port that helper or use a small count-up hook).
3. Inter + Sora fonts.

## The count-up + tilt + ripple helpers
`bright.html` runs an `enhance()` function after each render that powers: `data-count` count-up, `.b-tilt` pointer tilt, and `.b-ripple` taps. Copy that function (top of `bright.html`'s `<script>`) into a `useEffect(() => enhance(), [screen])` hook, or drop the helpers into a shared `useEnhance()` hook.

## Build order
1. Load foundation (`tokens.css` + `bright-skin.css`).
2. Confirm the 5 primitives render (drop them on a test page).
3. Wire `HomeScreen` → `SearchScreen`+`AskNearby` → `ChatScreen` → `StoreProfile` → `MessagesScreen`.
4. `MapScreen` is styled as overlays — mount your real map SDK (Google Maps / Mapbox / Leaflet) as the base layer where marked, and project pin x/y from lat/lng.
5. Diff every screen against `bright.html`.
