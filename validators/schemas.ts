import { z } from 'zod';

const phone10 = z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits');

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phone10,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['customer', 'retailer', 'supplier', 'brand', 'manufacturer']),
  location: z.string().optional(),
}).passthrough();

export const loginSchema = z.object({
  phone: phone10,
  password: z.string().min(1, 'Password is required'),
}).passthrough();

export const createPostSchema = z.object({
  imageUrl: z.string().min(1, 'imageUrl is required'),
  caption: z.string().max(500).optional(),
  price: z.coerce.number().positive().optional(),
  productId: z.string().uuid().optional(),
}).passthrough();

export const updatePostSchema = z.object({
  imageUrl: z.string().min(1).optional(),
  caption: z.string().max(500).optional(),
  price: z.coerce.number().positive().nullable().optional(),
  productId: z.string().uuid().optional(),
}).passthrough();

export const createStoreSchema = z.object({
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  // Store phone may include +91 country code prefix sent by the frontend
  phone: z.string().regex(/^(\+91)?\d{10}$/, 'Phone must be 10 digits').optional(),
}).passthrough();

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  storeId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
}).passthrough();

export const sendMessageSchema = z.object({
  receiverId: z.string().uuid('receiverId must be a valid UUID'),
  message: z.string().min(1).max(5000).optional(),
  imageUrl: z.string().min(1).nullish(),
}).passthrough().refine(
  data => !!(data.message?.trim() || data.imageUrl),
  { message: 'Message text or image is required' }
);

export const submitComplaintSchema = z.object({
  issueType: z.enum(['store_issue', 'bug', 'spam', 'account', 'other', 'fake_user', 'feedback']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
}).passthrough();

// Schema exists; POST /api/reports route not yet implemented in server.ts
export const submitReportSchema = z.object({
  reason: z.string().min(5).max(500),
  reportedUserId: z.string().uuid().optional(),
  reportedStoreId: z.string().uuid().optional(),
}).passthrough();

// KYC route receives documentUrl/selfieUrl/storeName/storePhoto (no kyc prefix)
// These are local upload paths (/uploads/...) not external URLs, so min(1) not url()
export const submitKycSchema = z.object({
  documentUrl: z.string().min(1, 'documentUrl is required'),
  selfieUrl: z.string().min(1, 'selfieUrl is required'),
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  storePhoto: z.string().min(1).optional(),
}).passthrough();
