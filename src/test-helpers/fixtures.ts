/**
 * Test fixture factories — Day 2.7 / Session 91 / Phase 1 infrastructure.
 *
 * Default-filled objects matching the production schema. Each factory
 * accepts a partial override so tests can express ONLY the fields that
 * matter to their assertion ("blocked user" → just `{ isBlocked: true }`).
 *
 * Naming convention: `makeTestX` (matches Day 2.5's existing test data
 * construction pattern).
 *
 * NOTE: These factories return PLAIN OBJECTS, not Prisma records. They
 * are used as return values from mocked `prisma.user.findUnique(...)`
 * etc. — they do NOT persist to a real DB (Rule F: tests never touch
 * a real DB).
 */

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

export interface TestUser {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: "customer" | "retailer" | "supplier" | "brand" | "manufacturer" | "admin";
  isBlocked: boolean;
  blockedReason: string | null;
  deletedAt: Date | null;
  deletionRequestedAt: Date | null;
  deletionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  location: string | null;
  email: string | null;
  kycStoreName: string | null;
}

export function makeTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Test User",
    phone: "9876543210",
    // Pre-computed bcrypt hash of "correct-password" at rounds=4 (fast for tests).
    // Generated via bcrypt.hashSync("correct-password", 4).
    // Tests that need a specific password should override `password` AND mock
    // `bcrypt.compare` to control behavior — this default just satisfies the
    // shape of a user row.
    password: "$2b$04$Q9N8Tt8Wj/QnB1JL3iFqMu7yQc.Kc/dWZBe5cWmJxqOcLgQF8u30K",
    role: "customer",
    isBlocked: false,
    blockedReason: null,
    deletedAt: null,
    deletionRequestedAt: null,
    deletionReason: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    location: null,
    email: null,
    kycStoreName: null,
    ...overrides,
  };
}

export interface TestStore {
  id: string;
  storeName: string;
  category: string;
  ownerId: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string | null;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  averageRating: number;
  is24Hours: boolean;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: string[];
  phoneVisible: boolean;
  gstNumber: string | null;
  postalCode: number | null;
  city: string | null;
  state: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeTestStore(overrides: Partial<TestStore> = {}): TestStore {
  return {
    id: "00000000-0000-0000-0000-000000000010",
    storeName: "Test Store",
    category: "Electronics",
    ownerId: "00000000-0000-0000-0000-000000000001",
    latitude: 19.07,
    longitude: 72.87,
    address: "Test Address, Mumbai",
    phone: null,
    description: null,
    logoUrl: null,
    coverUrl: null,
    averageRating: 0,
    is24Hours: false,
    openingTime: "09:00",
    closingTime: "21:00",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    phoneVisible: true,
    gstNumber: null,
    postalCode: null,
    city: null,
    state: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export interface TestProduct {
  id: string;
  storeId: string;
  productName: string;
  brand: string | null;
  category: string;
  price: number | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function makeTestProduct(overrides: Partial<TestProduct> = {}): TestProduct {
  return {
    id: "00000000-0000-0000-0000-000000000020",
    storeId: "00000000-0000-0000-0000-000000000010",
    productName: "Test Product",
    brand: null,
    category: "Electronics",
    price: 999,
    description: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

export interface TestPost {
  id: string;
  storeId: string;
  caption: string | null;
  imageUrl: string;
  price: number | null;
  isPinned: boolean;
  isOpeningPost: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function makeTestPost(overrides: Partial<TestPost> = {}): TestPost {
  return {
    id: "00000000-0000-0000-0000-000000000030",
    storeId: "00000000-0000-0000-0000-000000000010",
    caption: "Test caption",
    imageUrl: "https://example.test/image.jpg",
    price: null,
    isPinned: false,
    isOpeningPost: false,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    ...overrides,
  };
}

/**
 * Convenience: a user in 30-day deletion grace (Day 2.5 carve-out target).
 *
 * `deletedAt` is the FUTURE timestamp at which the soft-delete becomes
 * effective — `deletionRequestedAt + 30 days`. While that timestamp lies
 * in the future, `evaluateUserStatus` returns `deleted_pending` (grace
 * window). Once `deletedAt <= now`, it flips to `deleted_expired`. This
 * matches the Day 2 schema design (see user-status.ts evaluateUserStatus).
 */
export function makeDeletedPendingUser(overrides: Partial<TestUser> = {}): TestUser {
  const now = Date.now();
  return makeTestUser({
    // 25 days in the future — well inside the 30-day grace window
    deletedAt: new Date(now + 25 * 24 * 60 * 60 * 1000),
    // Deletion clicked 5 days ago
    deletionRequestedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    deletionReason: "user_requested",
    ...overrides,
  });
}

/**
 * Convenience: a user whose 30-day grace has expired.
 *
 * `deletedAt` is in the PAST → `evaluateUserStatus` returns
 * `deleted_expired`. Used to verify the strict / permissive policy
 * distinction (deleted_expired is rejected by BOTH paths).
 */
export function makeDeletedExpiredUser(overrides: Partial<TestUser> = {}): TestUser {
  const now = Date.now();
  return makeTestUser({
    // 1 day in the past — grace clearly over
    deletedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
    // Deletion clicked 31 days ago (just past the 30-day grace boundary)
    deletionRequestedAt: new Date(now - 31 * 24 * 60 * 60 * 1000),
    deletionReason: "user_requested",
    ...overrides,
  });
}

/**
 * Convenience: a blocked user (admin block).
 */
export function makeBlockedUser(overrides: Partial<TestUser> = {}): TestUser {
  return makeTestUser({
    isBlocked: true,
    blockedReason: "spam",
    ...overrides,
  });
}
