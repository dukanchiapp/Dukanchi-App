export interface User {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
  role: 'customer' | 'retailer' | 'admin' | 'supplier' | 'manufacturer' | 'brand';
  location?: string | null;
  kycStatus?: string;
  kycStoreName?: string | null;
  kycNotes?: string | null;
  isBlocked?: boolean;
  createdAt?: string;
}

export interface Store {
  id: string;
  storeName: string;
  category: string;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  ownerId: string;
  openingTime?: string | null;
  closingTime?: string | null;
  workingDays?: string | null;
  is24Hours?: boolean;
  chatEnabled?: boolean;
  phoneVisible?: boolean;
  hideRatings?: boolean;
  isVerified?: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  _count?: { posts?: number; products?: number; followers?: number };
  followers?: { userId: string }[];
  owner?: { role: string; isBlocked: boolean };
}

export interface Product {
  id: string;
  storeId: string;
  productName: string;
  brand?: string | null;
  category: string;
  price: number;
  description?: string | null;
}

export interface Post {
  id: string;
  storeId: string;
  imageUrl: string;
  caption?: string | null;
  price?: number | null;
  isPinned?: boolean;
  isOpeningPost?: boolean;
  createdAt: string;
  store?: Store;
  product?: Product | null;
  likes?: { userId: string }[];
  _count?: { likes?: number };
  isOwnPost?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  message: string | null;
  imageUrl?: string | null;
  createdAt: string;
}

export interface Conversation {
  id?: string;
  userId: string;
  name: string;
  logoUrl?: string | null;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

export interface Interactions {
  likedPostIds: string[];
  savedPostIds: string[];
  followedStoreIds: string[];
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FeedResponse {
  posts: Post[];
  pagination: ApiPagination;
}
