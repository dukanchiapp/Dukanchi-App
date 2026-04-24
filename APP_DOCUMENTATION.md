# G-AI — Local Retail Platform
## App Documentation

> **Keep this file updated** whenever features are added, changed, or removed.

---

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Models](#database-models)
5. [User Roles](#user-roles)
6. [Main App — Features](#main-app--features)
7. [Admin Panel — Features](#admin-panel--features)
8. [API Overview](#api-overview)
9. [Real-time (Socket.IO)](#real-time-socketio)
10. [File Uploads](#file-uploads)
11. [Rate Limiting](#rate-limiting)
12. [Caching (Redis)](#caching-redis)
13. [Background Jobs (BullMQ)](#background-jobs-bullmq)
14. [Environment Variables](#environment-variables)
15. [Deployment](#deployment)

---

## Overview

G-AI is a **local retail discovery platform** connecting customers with nearby retailers, suppliers, brands, and manufacturers. Users can browse stores, follow them, view posts/products, chat with businesses, write reviews, and get real-time notifications.

There are two separate front-end apps:
- **Main App** (`/`) — for end users (customers, retailers, suppliers, brands, manufacturers)
- **Admin Panel** (`admin.*`) — for platform administrators

Both share a single **Express + TypeScript backend** (`server.ts`).

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | Express.js 4 + TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL 14 |
| Cache / PubSub | Redis 7 |
| Real-time | Socket.IO 4 (Redis adapter for cluster mode) |
| Background Jobs | BullMQ 5 (Redis-backed queue) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| File Uploads | Multer (local disk) or Multer-S3 (AWS S3) |
| Security Headers | `helmet` |
| Validation | `zod` |
| Compression | `compression` (gzip/brotli) |
| Rate Limiting | `express-rate-limit` + Redis store |
| Error Tracking | Sentry (`@sentry/node`) |
| Process Manager | PM2 (cluster mode, all CPU cores) |

### Frontend (Main App)
| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Maps | @react-google-maps/api |
| HTTP | fetch API |
| Real-time | socket.io-client 4 |
| Animation | motion (Framer Motion) |

### Frontend (Admin Panel)
| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Routing | React Router DOM 7 |
| Styling | Tailwind CSS 4 |
| HTTP | axios |
| Icons | Lucide React |

### Infrastructure
| Component | Tool |
|---|---|
| Reverse Proxy | Nginx (SSL termination, WebSocket upgrade, static file serving) |
| SSL | Let's Encrypt via Certbot |
| OS | Ubuntu 22.04 |
| Hosting | Hostinger VPS |

---

## Architecture

```
Internet
   │
Nginx (port 80/443)
   ├── yourdomain.com  → serves /dist (React build) + proxies /api/ and /socket.io/ to Node
   ├── admin.yourdomain.com → serves /admin-panel/dist + proxies /api/ and /socket.io/ to Node
   └── /uploads/       → served directly by Nginx (no Node.js hit)
         │
    Node.js (port 3000, PM2 cluster — one process per CPU core)
         ├── Express REST API
         ├── Socket.IO server (Redis adapter syncs across all workers)
         ├── BullMQ workers (background notifications)
         └── Prisma → PostgreSQL
                    └── Redis (cache, rate limit, pub/sub, job queue)
```

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | All accounts — customers, retailers, suppliers, brands, manufacturers, admins |
| `Store` | Business profile created by a retailer/supplier/brand/manufacturer after KYC approval |
| `Product` | Products listed under a store |
| `Post` | Photo posts by a store (image + caption + price, optionally linked to a product) |
| `Message` | Direct messages between users |
| `Follow` | User following a store |
| `Review` | Star rating + comment on a store or product |
| `Notification` | In-app notifications for users |
| `SavedItem` | Saved posts or stores by a user |
| `SearchHistory` | Recent searches per user |
| `SavedLocation` | Pinned locations on the map |
| `TeamMember` | Store team accounts (max 3 per store, separate login from main User) |
| `Report` | User-submitted reports against users or stores |
| `Complaint` | Support tickets submitted by users |
| `Like` | Post likes |
| `Category` | Product/store categories |
| `AppSettings` | Global app config (name, logo, colors, carousel images) — singleton row |

### Key field notes
- `Post.isOpeningPost` — the store's main photo; always displayed first, never expires
- `Post.isPinned` — pinned by store owner; shown after opening post
- `Post.expiryDate` — regular posts expire 30 days after creation unless promoted
- `User.kycStatus` — `none | pending | approved | rejected`
- `Store.chatEnabled` — owner can disable chat
- `Store.hideRatings` — owner can hide public ratings

---

## User Roles

| Role | Description |
|---|---|
| `customer` | Browse, follow, chat, review, save |
| `retailer` | Own a retail store, post products/photos |
| `supplier` | Own a supplier store |
| `brand` | Own a brand store |
| `manufacturer` | Own a manufacturer store |
| `admin` | Full access to admin panel |

Non-customer roles (retailer, supplier, brand, manufacturer) must complete KYC before their store is created.

---

## Main App — Features

### Authentication
- **Phone + password signup/login** — JWT token stored in localStorage
- **Role selection** at signup (customer / retail shop / supplier / brand / manufacturer)
- Google OAuth **temporarily removed** (can be re-enabled)

### Home Feed (`/`)
- Scrollable discovery feed of posts from all stores
- Posts filtered by user role (different feed per role)
- Redis-cached 30 seconds per role+page combination
- Follow/unfollow stores inline
- Like posts
- Save posts

### Search (`/search`)
- **Smart Semantic Search**: Two-layer pipeline combining fast alias dictionary matching with Gemini + `pgvector` semantic embeddings for deep conceptual matches.
- **Fuzzy Spell Correction**: Levenshtein distance algorithm auto-corrects typos against a dynamic vocabulary (refreshed every 5 mins).
- **Category-Aware Filtering**: Intelligent keyword inference (e.g. "phone" -> Electronics) prevents irrelevant cross-category results.
- **Real-time Autocomplete**: Dropdown suggestions with highlighted match text as users type.
- Results cached in Redis for 60 seconds per role+query.
- Search history saved per user (last 10 queries).
- Role-aware results.

### Map (`/map`)
- Google Maps integration
- Shows all stores as pins
- Filter by category
- **Bottom Sheet UI**: Upward-expanding bottom sheet showing nearby stores (horizontal cards when collapsed, scrollable list when expanded).
- Save locations
- Click pin → store profile

### Store Profile (`/store/:id`)
- Store info: name, category, address, hours, phone, rating
- Posts tab with photo grid
- Products tab
- Reviews tab (star ratings + comments)
- Follow/unfollow button
- Chat button (opens DM with store owner)
- Report store

### Profile (`/profile`)
- Your own profile page
- **Posts tab**: 
  - Opening post first → pinned posts → regular posts (30-day filter)
  - Edit post (caption, price, image replaceable with cropper)
  - Pin/unpin/delete posts
  - No chat button on own profile
- KYC status screen for non-customer users who haven't set up a store yet:
  - **none** — show KYC form
  - **pending** — waiting for admin review
  - **approved** — prompt to create store
  - **rejected** — show rejection reason + re-submit option
- Store setup after KYC approval

### Chat (`/chat`, `/chat/:userId`)
- Real-time direct messaging via Socket.IO
- Auto-reply sent when a new conversation is started with a store owner (BullMQ background job)
- Image sharing in messages
- Conversation list with last message preview

### User Settings (`/settings`)
- Edit profile (name, phone, location, profile photo)
- **Manage Posts tab** — edit/delete your store's posts
- **Team Members tab** — add/remove team members (max 3), each gets their own login
- Store settings (hours, category, address, GST, etc.)
- Password change

### Support (`/support`)
- Submit a complaint/support ticket
- Issue types: store issue, bug, spam, account, other

### Notifications
- Real-time via Socket.IO (`newNotification` event)
- Types: `NEW_POST` (when a followed store posts), `REVIEW_RECEIVED`, `SYSTEM`
- Notification bell with unread count

---

## Admin Panel — Features

### Login
- Phone + password login, must have `role: 'admin'`
- Uses `VITE_API_URL` env var (not hardcoded to localhost)

### Dashboard (`/dashboard`)
- Total counts: users, stores, posts, reviews, reports
- Recent signups list (shows business name for non-customers)
- Recent reports list

### Users (`/users`)
- Full user list with search and role filter
- Block/unblock users
- Delete users
- View user details

### Stores (`/stores`)
- All stores with search
- View store details
- Delete stores

### KYC Review (`/kyc-review`)
- List of pending KYC submissions with document/selfie viewer
- Approve or reject with notes
- Approved → triggers store creation prompt for user

### Posts (`/posts`)
- All posts across the platform
- Delete posts
- Confirmation modal (no browser prompts)

### Store Members (`/store-members`)
- Left panel: list of all stores with owner name, role badge, member count (X/3)
- Right panel: store admin card (amber) + team members list
- Delete team members
- Confirmation modal

### Complaints (`/complaints`)
- All support tickets with status filter
- Update status (open → in_progress → resolved → dismissed)
- Add admin notes

### Reports (`/reports`)
- All user-submitted reports
- View reported user/store details

### Settings (`/settings`)
- App name, logo, primary/accent colors
- Carousel images management

---

## API Overview

All routes are prefixed `/api/`. Full list in `server.ts`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | DB + Redis health check |
| POST | `/api/users` | None | Register new user |
| POST | `/api/login` | None | Login (phone + password) |
| GET | `/api/users/me` | JWT | Current user profile |
| PUT | `/api/users/me` | JWT | Update profile |
| GET | `/api/posts` | JWT | Discovery feed |
| POST | `/api/posts` | JWT | Create post |
| PUT | `/api/posts/:id` | JWT | Edit post (caption, image, price) |
| DELETE | `/api/posts/:id` | JWT | Delete post |
| GET | `/api/stores` | JWT | Store list/search |
| POST | `/api/stores` | JWT | Create store (after KYC) |
| PUT | `/api/stores/:id` | JWT | Update store |
| GET | `/api/stores/:id` | JWT | Store details |
| GET | `/api/search` | JWT | Search stores + products |
| POST | `/api/messages` | JWT | Send message |
| GET | `/api/messages/:userId` | JWT | Get conversation |
| GET | `/api/conversations` | JWT | All conversations |
| POST | `/api/kyc` | JWT | Submit KYC |
| GET | `/api/kyc/status` | JWT | Get own KYC status |
| POST | `/api/team` | JWT | Add team member |
| DELETE | `/api/team/:id` | JWT | Remove team member |
| GET | `/api/notifications` | JWT | Get notifications |
| POST | `/api/follow/:storeId` | JWT | Follow/unfollow store |
| POST | `/api/reviews` | JWT | Post review |
| POST | `/api/reports` | JWT | Submit report |
| POST | `/api/complaints` | JWT | Submit complaint |
| GET | `/api/admin/stats` | Admin JWT | Dashboard stats |
| GET | `/api/admin/users` | Admin JWT | All users |
| PATCH | `/api/admin/users/:id/block` | Admin JWT | Block/unblock user |
| DELETE | `/api/admin/users/:id` | Admin JWT | Delete user |
| GET | `/api/admin/kyc` | Admin JWT | Pending KYC list |
| PATCH | `/api/admin/kyc/:userId` | Admin JWT | Approve/reject KYC |
| GET | `/api/admin/posts` | Admin JWT | All posts |
| DELETE | `/api/admin/posts/:id` | Admin JWT | Delete post |
| GET | `/api/admin/store-members` | Admin JWT | All stores with member counts |
| GET | `/api/admin/store-members/:storeId` | Admin JWT | Members of a store |
| DELETE | `/api/admin/team/:memberId` | Admin JWT | Delete team member |
| GET | `/api/admin/complaints` | Admin JWT | All complaints |
| PATCH | `/api/admin/complaints/:id` | Admin JWT | Update complaint status |
| GET | `/api/settings` | None | App settings (public) |
| PUT | `/api/admin/settings` | Admin JWT | Update app settings |

---

## Real-time (Socket.IO)

- Server uses **Redis adapter** so events work correctly across all PM2 cluster workers
- Each user joins their own room (`socket.join(userId)`) on connect
- **Events emitted by server:**
  - `newMessage` — sent to both sender and receiver room when a message is created
  - `newNotification` — sent to a user room when a notification is created
- **Client usage in Chat.tsx:** connects with JWT auth token, listens for `newMessage`

---

## File Uploads

- **Local mode** (default): files stored in `/uploads/` directory, served by Nginx directly
- **S3 mode**: set `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` env vars
- Max file size: 5MB
- Allowed types: JPEG, PNG, WebP, GIF, Excel (.xlsx, .xls)
- Nginx serves `/uploads/` directly with 30-day cache headers (bypasses Node.js)

---

## Rate Limiting

All limits are Redis-backed (survive restarts, shared across cluster workers).

| Limiter | Routes | Limit |
|---|---|---|
| `generalLimiter` | All `/api/*` | 300 req/min per IP |
| `authLimiter` | `/api/login`, `/api/users` | 20 req / 15 min per IP |
| `uploadLimiter` | `/api/upload` | 10 req/min per IP |
| `messageLimiter` | `/api/messages` | 30 req/min per IP |

---

## Caching (Redis)

| Cache Key | TTL | What |
|---|---|---|
| `feed:{role}:p{page}:l{limit}` | 30s | Discovery feed per role + page |
| `search:{role}:{query}` | 60s | Search results per role + query |
| `blocked:{userId}` | 60s | User blocked status (avoids DB hit per request) |
| `team:{teamMemberId}` | 120s | Team member existence check |

---

## Background Jobs (BullMQ)

Queue name: `Notifications`

| Job | Trigger | What it does |
|---|---|---|
| `publishPostNotifications` | New post created | Creates `NEW_POST` notifications for all store followers in 1000-record chunks; emits `newNotification` to online users |
| `autoReply` | First message sent to a store | Sends an automated reply from the store owner |

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
DATABASE_URL=postgresql://g_ai_user:PASSWORD@localhost:5432/g_ai
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-long-random-secret-here-minimum-32-chars

# Admin account seeding — both required for admin account to be created on startup
ADMIN_PHONE=your-admin-phone-number
ADMIN_PASSWORD=your-admin-password

# Optional
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# File uploads — only needed for S3 mode
S3_BUCKET_NAME=your-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Admin panel (`.env` in `admin-panel/`):
```env
VITE_API_URL=https://yourdomain.com
```

Main app (`.env` in root for Vite):
```env
VITE_GOOGLE_MAPS_API_KEY=your-key
```

---

## Deployment

One-command deploy on fresh Ubuntu 22.04 VPS:

```bash
chmod +x deploy.sh && ./deploy.sh
```

The script installs: Node.js 22, PostgreSQL 14, Redis, Nginx, Certbot (SSL), PM2, clones the repo, runs `npm ci`, runs Prisma migrations, builds both frontends, configures Nginx, gets SSL certificate, and starts the app with PM2.

**After deploy**, create `.env` at `/var/www/g-ai/.env` with the variables above.

### Process Management (PM2)
- Cluster mode: one worker per CPU core
- Auto-restart on crash or if memory exceeds 1GB per worker
- Logs: `/var/log/g-ai/out.log` and `/var/log/g-ai/error.log`

---

*Last updated: 2026-04-22 (Session 4)*

### Architecture Update (2026-04-24)
The application has been successfully migrated to a Domain-Driven Design (DDD). The monolithic server.ts has been deprecated as a router and now serves strictly as the application entry point. All business logic and routes have been extracted into the `src/modules/` directory, background jobs into `src/workers/`, and real-time events into `src/config/socket-listeners.ts`.
