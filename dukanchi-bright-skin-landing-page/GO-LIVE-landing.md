# Going Live — Dukanchi Landing Page

You have two files (both in this folder):

| File | Use it when |
|---|---|
| `landing-standalone.html` | **Fastest way to go live.** One self-contained file — fonts + the news image are baked in. Upload it anywhere and it just works. |
| `landing.html` + `assets/` | The editable source. Use this if your dev will maintain/extend the page. Keep the `assets/` folder next to it. |

---

## Option A — Go live in 2 minutes (no dev needed)
Use `landing-standalone.html`. Pick any host:

- **Netlify Drop** — go to app.netlify.com/drop → drag `landing-standalone.html` in → you get a live URL instantly. Rename the file to `index.html` first so it's the homepage.
- **Vercel / Cloudflare Pages** — same idea: drop the file in, deploy.
- **GitHub Pages** — put `landing-standalone.html` (renamed `index.html`) in a repo, enable Pages.
- **Your existing host (dukanchi.com)** — upload it as `index.html` to your web root via cPanel / FTP / your hosting dashboard. It replaces the current page.

> Tip: rename `landing-standalone.html` → `index.html` so it loads as the default page.

## Option B — Integrate into your codebase (dev / Claude Code)
Use `landing.html` + `assets/`:
1. Drop `landing.html` and the `assets/` folder into your web project (e.g. a `public/` or marketing route).
2. The page is plain HTML/CSS/JS — no build step, no framework needed. It can live as a static route even if the app is React.
3. Wire the **download buttons** to your real App Store / Play Store URLs, and the **"browser mein use karo"** link to your web-app URL.
4. Point dukanchi.com (or a subpath) at it.

### Claude Code prompt
> Add the marketing landing page from `dukanchi-bright-skin/landing.html` (+ `assets/`) as a static page served at our site root / marketing route. Do not change its design or copy. Wire the two store buttons to our real App Store and Play Store links, and the "browser mein use karo" link to our web-app URL. Keep it as the dukanchi.com homepage.

---

## Before launch — quick checklist
- [ ] Replace the **App Store / Play Store** placeholder links (`href="#"`) with real store URLs.
- [ ] Point the **"Ya abhi browser mein hi use karo"** link (`href="bright.html"`) to your live web app.
- [ ] Update footer links (About, Careers, Privacy, Terms) to real pages.
- [ ] Add your favicon (the "द" tile — spec in `ICONS.md`).
- [ ] Confirm the **2,400+ / stat numbers** and the news source are accurate before publishing.
