import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Session 128.34 — input-validation rollout (Path A: extend existing pattern).
//
// PASSTHROUGH-FREE BY POLICY. Default zod behaviour STRIPS unknown keys from
// the parsed output. `validators/validate.ts` then assigns `result.data` back
// to `req.body` / `req.query` / `req.params`, so downstream controllers see
// the stripped values — no client-supplied unknown field can sneak into a
// Prisma `.create({ data: ... })` or `.update({ data: ... })` via spread.
// This closes the mass-assignment vector at the SCHEMA layer (defense in
// depth #1); the spread sites are independently destructure-allowlisted in
// the controllers (defense in depth #2 — see e.g. store.controller createStore).
//
// If you find yourself wanting `.passthrough()` on a new schema: don't. Add
// the field to the schema instead. The only legitimate exception is a schema
// for an external system's webhook payload we don't fully spec — and that's
// not a thing on this API surface today.
//
// Shared schemas live at the top; per-endpoint schemas grouped by module
// below in order: auth · posts · stores · reviews · messages · misc ·
// kyc · account · users · team · ai · ask-nearby · landing.
// ─────────────────────────────────────────────────────────────────────────

// ── Shared building blocks ──
const phone10 = z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits');

/** Indian phone: 10 digits, optional +91 prefix (matches user-facing forms). */
export const phoneSchema = z.string().regex(/^(\+91)?\d{10}$/, 'Phone must be 10 digits');

/** The 6 app roles. Mirrors the auth.middleware B2B_ROLES union + customer + admin. */
export const roleSchema = z.enum(['customer', 'retailer', 'supplier', 'brand', 'manufacturer', 'admin']);

/**
 * UUID-SHAPED string: 8-4-4-4-12 hex segments, version/variant unconstrained.
 *
 * Looser than zod's RFC-strict `.uuid()` so both real Prisma v4 IDs AND the
 * project's test-fixture nil-ish IDs (`00000000-0000-0000-0000-...`, used
 * across the test suite via makeTestUser) validate identically. Real attack
 * vectors — non-hex strings, SQL fragments, path-traversal, scalar `id=admin`
 * — are still caught (the value of the check). Mirror this in any local
 * `:foo` param schema where the underlying Prisma column is UUID-typed.
 */
export const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'must be a UUID',
);

/** Common `:id` URL param. Reusable via `idParamSchema.extend({ ... })`. */
export const idParamSchema = z.object({ id: uuidLike });

/**
 * Common pagination query. Sensible defaults match the production controllers
 * (`page=1, limit=20`, both coerced from strings). Limit is hard-capped at 100
 * to prevent the unbounded-fetch foot-gun on list endpoints.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ── Auth ──
export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phone10,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['customer', 'retailer', 'supplier', 'brand', 'manufacturer']),
  location: z.string().optional(),
  // Legal Phase A — DPDP consent. The frontend sends `consent: true` only
  // after the user ticks the (unticked-by-default) signup consent checkbox;
  // z.literal(true) rejects a missing or false value as a 400.
  consent: z.literal(true, {
    message: 'You must accept the Terms of Service and Privacy Policy to sign up',
  }),
});

export const loginSchema = z.object({
  phone: phone10,
  password: z.string().min(1, 'Password is required'),
});

// ── Posts ──
// post.controller.createPost reads req.body.storeId for the ownership gate
// (verify the user owns the store before allowing them to post). Previously
// preserved by .passthrough(); now declared on the schema so the default
// strip doesn't silently drop it (regression caught by the existing posts
// 404-on-nonexistent-store test). storeId is optional (admin posts may not
// have one) — when present it MUST be a UUID.
export const createPostSchema = z.object({
  imageUrl: z.string().min(1, 'imageUrl is required'),
  caption: z.string().max(500).optional(),
  price: z.coerce.number().positive().optional(),
  productId: z.string().uuid().optional(),
  storeId: uuidLike.optional(),
});

export const updatePostSchema = z.object({
  imageUrl: z.string().min(1).optional(),
  caption: z.string().max(500).optional(),
  price: z.coerce.number().positive().nullable().optional(),
  productId: z.string().uuid().optional(),
});

// ── Stores ──
//
// store.controller createStore flows this through to prisma.store.create. With
// .passthrough() previously, an attacker could send { ...validFields, verified:
// true, premium: true } and the spread `{ ...req.body, ownerId }` would write
// those to the row. Default-strip now drops those keys at the schema; the
// controller ALSO destructures explicitly as belt + suspenders.
export const createStoreSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  // Store phone may include +91 country code prefix sent by the frontend
  phone: z.string().regex(/^(\+91)?\d{10}$/, 'Phone must be 10 digits').optional(),
});

// ── Reviews ──
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  storeId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

// ── Messages ──
export const sendMessageSchema = z.object({
  receiverId: z.string().uuid('receiverId must be a valid UUID'),
  message: z.string().min(1).max(5000).optional(),
  imageUrl: z.string().min(1).nullish(),
}).refine(
  data => !!(data.message?.trim() || data.imageUrl),
  { message: 'Message text or image is required' }
);

// ── Misc (complaints / reports) ──
export const submitComplaintSchema = z.object({
  issueType: z.enum(['store_issue', 'bug', 'spam', 'account', 'other', 'fake_user', 'feedback']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
});

// Schema exists; POST /api/reports route not yet implemented in server.ts
export const submitReportSchema = z.object({
  reason: z.string().min(5).max(500),
  reportedUserId: z.string().uuid().optional(),
  reportedStoreId: z.string().uuid().optional(),
});

// ── KYC ──
// KYC route receives documentUrl/selfieUrl/storeName/storePhoto (no kyc prefix)
// These are local upload paths (/uploads/...) not external URLs, so min(1) not url()
export const submitKycSchema = z.object({
  documentUrl: z.string().min(1, 'documentUrl is required'),
  selfieUrl: z.string().min(1, 'selfieUrl is required'),
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  storePhoto: z.string().min(1).optional(),
});

// ── Account ──
// Account deletion (Day 2 hardening) — reason is optional, capped at 500 chars
// to match the User.deletionReason VARCHAR(500) DB column (defense in depth).
export const deleteAccountSchema = z.object({
  reason: z.string().max(500, 'Reason must be 500 characters or fewer').optional(),
});

// ── Users (gap module — Session 128.34) ──
// Profile update accepts ONLY these three fields. The previous controller did
// `const { name, phone, email } = req.body` (implicit allowlist via destructure)
// — the schema now enforces the same allowlist at the boundary + adds shape
// constraints. user.service.updateUserProfile reads only these keys.
export const updateUserProfileBody = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: phone10.optional(),
  email: z.string().email('email must be a valid address').optional(),
});

// ── Team (gap module — Session 128.34) ──
// addTeamMember body: TeamService.addTeamMember reads { phone, password,
// storeId, name }. The service throws "Phone and password are required" /
// "Password must be at least 4 characters" — the schema enforces those
// upfront so we 400 cleanly instead of via a thrown Error → 400 mapping.
// Password min stays 4 to match the existing service behaviour (this is a
// retailer-internal team-member account, not the customer signup path which
// requires min 8).
export const addTeamMemberBody = z.object({
  phone: phone10,
  password: z.string().min(4, 'Password must be at least 4 characters'),
  storeId: z.string().uuid('storeId must be a UUID'),
  name: z.string().min(1).optional(),
});

// ── AI (gap module — Session 128.34) ──
// All three endpoints read base64 payloads + a MIME type. Length caps prevent
// a 10MB+ string blocking the event loop; MIME type is the narrow set the
// Gemini Vision/Audio clients accept.
export const aiAnalyzeImageBody = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required').max(20_000_000, 'image too large'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

export const aiTranscribeVoiceBody = z.object({
  audioBase64: z.string().min(1, 'audioBase64 is required').max(20_000_000, 'audio too large'),
  mimeType: z.enum(['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']),
});

export const aiGenerateStoreDescBody = z.object({
  storeName: z.string().min(1, 'storeName is required').max(200),
  category: z.string().max(200).optional(),
  userContext: z.string().max(2000).optional(),
});

// ── Ask-Nearby (gap module — Session 128.34) ──
export const askNearbySendBody = z.object({
  query: z.string().min(1, 'query is required').max(500),
  // Pilot radius cap (50km is a generous urban-mobility ceiling — bigger
  // radii expand the broadcast set quadratically and cost real money).
  radiusKm: z.coerce.number().positive().max(50, 'radiusKm must be <= 50'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  areaLabel: z.string().max(200).optional(),
  // Pre-uploaded R2 image keys/URLs the client attached. Cap matches the AI
  // photo-to-post limit (a handful of attached images, not arbitrary lists).
  images: z.array(z.string().min(1).max(2048)).max(5).optional(),
});

export const askNearbyRespondBody = z.object({
  responseId: z.string().uuid('responseId must be a UUID'),
  answer: z.enum(['yes', 'no']),
});

// ── Landing (gap module — Session 128.34) ──
// Public GET takes no input. The admin PUT receives a JSON blob for the
// landing-page CMS content. The shape is an open-ended object today; we
// gate it as "non-null object" so an attacker can't smuggle a primitive /
// array / null and crash the controller, but we don't (yet) lock down the
// nested keys — that'd be a separate CMS-content-schema task.
export const updateLandingContentBody = z.object({
  content: z.record(z.string(), z.unknown()),
});

// ─────────────────────────────────────────────────────────────────────────
// Session 128.37 — Admin module input validation (27-route follow-up to #185).
//
// Every admin route is already gated by `authenticateAdminToken + requireAdmin`,
// so 401/403 come BEFORE validation. These schemas exist to (a) close the
// mass-assignment surface on the privilege-write routes (PUT /users/:id,
// POST /users/bulk-update, PUT /complaints/:id, PUT /kyc/:id, PUT /settings,
// POST /reset-password) by allowlisting fields at the schema layer, and
// (b) coerce/cap query inputs (page/limit/status/role) so a malicious or
// buggy client can't unbounded-fetch or smuggle invented status values past
// the controller into a Prisma where clause.
//
// Live-UI shapes were audited against admin-panel/src/pages/* — every body
// field below maps to an actual `api.put/post(...)` call there. No guessing.
// ─────────────────────────────────────────────────────────────────────────

// Reusable across admin status-filter list routes (complaints + kyc).
// The 'all' sentinel is the live UI's "no filter" value (see admin-panel
// Complaints.tsx + KycReview.tsx) — the service strips it server-side.
const complaintStatusEnum = z.enum(['open', 'in_progress', 'resolved', 'dismissed']);
const kycStatusEnum = z.enum(['pending', 'approved', 'rejected']);

// ── Admin: users ──
export const adminListUsersQuery = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
  // role filter accepts any of the 6 known roles OR the 'all' sentinel.
  role: z.union([z.literal('all'), roleSchema]).optional(),
});

export const adminResetPasswordBody = z.object({
  userId: uuidLike,
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
});

// Mass-assignment-prone: this body is read field-by-field in the controller
// and forwarded to AdminService.updateUser(id, role, isBlocked). The schema
// strict-allowlists exactly those two fields. `role` is constrained to the
// 6 known roles — an attacker can't forge "superadmin" / "owner" / arbitrary
// strings into the role column.
export const adminUpdateUserBody = z.object({
  role: roleSchema.optional(),
  isBlocked: z.boolean().optional(),
});

// Mass-assignment-prone: bulk block/unblock. userIds capped at 500 to
// prevent unbounded prisma.user.updateMany targets in one call.
export const adminBulkUpdateUsersBody = z.object({
  userIds: z.array(uuidLike).min(1, 'userIds must contain at least 1 id').max(500),
  isBlocked: z.boolean(),
});

// ── Admin: stores ──
export const adminListStoresQuery = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

// ── Admin: store-members / team ──
export const adminGetStoreMembersQuery = z.object({
  search: z.string().max(200).optional(),
});

export const adminStoreIdParam = z.object({ storeId: uuidLike });
export const adminMemberIdParam = z.object({ memberId: uuidLike });

// ── Admin: reports ──
export const adminListReportsQuery = paginationQuerySchema;

// ── Admin: chats ──
export const adminListChatsQuery = paginationQuerySchema;

export const adminChatHistoryQuery = z.object({
  u1: uuidLike,
  u2: uuidLike,
});

// ── Admin: settings ──
// Strict allowlist: AdminService.updateSettings reads exactly these 5 fields
// today (admin.service.ts:383). Any unknown key in the PUT body is silently
// dropped by zod's default-strip — the field can't reach the Prisma upsert.
// `carouselImages` mirrors the live UI's `string[]` of R2 keys/URLs.
export const adminUpdateSettingsBody = z.object({
  appName: z.string().min(1).max(120).optional(),
  // Logo can be cleared by sending `null` per Settings.tsx ("logoUrl || null").
  logoUrl: z.string().max(2048).nullable().optional(),
  primaryColor: z.string().max(32).optional(),
  accentColor: z.string().max(32).optional(),
  carouselImages: z.array(z.string().min(1).max(2048)).max(20).optional(),
});

// ── Admin: complaints ──
export const adminListComplaintsQuery = paginationQuerySchema.extend({
  status: z.union([z.literal('all'), complaintStatusEnum]).optional(),
});

// Allowlist for `updateComplaint(id, status, adminNotes)`.
export const adminUpdateComplaintBody = z.object({
  status: complaintStatusEnum.optional(),
  adminNotes: z.string().max(5000).optional(),
});

// ── Admin: posts ──
export const adminListPostsQuery = paginationQuerySchema.extend({
  search: z.string().max(200).optional(),
});

// ── Admin: kyc ──
export const adminListKycQuery = paginationQuerySchema.extend({
  status: z.union([z.literal('all'), kycStatusEnum]).optional(),
});

// Allowlist for `updateKycStatus(userId, status, notes)`. `status` is required
// (UI never PUTs without it — sends `{status:'approved'}` or
// `{status:'rejected', notes}`).
export const adminUpdateKycBody = z.object({
  status: kycStatusEnum,
  notes: z.string().max(5000).optional(),
});
