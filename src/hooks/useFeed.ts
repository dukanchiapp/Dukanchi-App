import { useState, useEffect, useCallback, useRef } from 'react';
import { Post, FeedResponse } from '../types';
import { apiFetch } from '../lib/api';

interface UseFeedOptions {
  feedType: string;
  locationRange: string;
  lat?: number | null;
  lng?: number | null;
  category?: string;
  enabled?: boolean;
}

export function useFeed({ feedType, locationRange, lat, lng, category, enabled = true }: UseFeedOptions) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const fetchPage = useCallback(async (pageNum: number) => {
    if (!enabled) return;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const useLat = locationRange !== 'all' && lat ? lat : 0;
      const useLng = locationRange !== 'all' && lng ? lng : 0;
      let url = `/api/posts?feedType=${feedType}&locationRange=${locationRange}&lat=${useLat}&lng=${useLng}&page=${pageNum}&limit=15`;
      if (category) url += `&category=${encodeURIComponent(category)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`Feed ${res.status}`);
      const data: FeedResponse = await res.json();
      const incoming = data.posts || [];

      if (pageNum === 1) {
        seenIdsRef.current = new Set(incoming.map(p => p.id));
        setPosts(incoming);
      } else {
        const fresh = incoming.filter(p => !seenIdsRef.current.has(p.id));
        fresh.forEach(p => seenIdsRef.current.add(p.id));
        setPosts(prev => [...prev, ...fresh]);
      }
      setHasMore(pageNum < (data.pagination?.totalPages ?? 1));
    } catch (err) {
      console.error('[useFeed]', err);
      if (pageNum === 1) setPosts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [feedType, locationRange, lat, lng, category, enabled]);

  // Reset and fetch on any option change
  useEffect(() => {
    seenIdsRef.current = new Set();
    setPage(1);
    setHasMore(true);
    if (enabled) setLoading(true);
    fetchPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType, locationRange, lat, lng, category, enabled]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [page, hasMore, loadingMore, loading, fetchPage]);

  // Session 128.3: explicit page-1 refetch for pull-to-refresh. Resets the
  // dedupe set + page cursor and returns the promise so the caller can await
  // it (the pull-to-refresh indicator hides on resolve).
  const refresh = useCallback(async () => {
    seenIdsRef.current = new Set();
    setPage(1);
    setHasMore(true);
    await fetchPage(1);
  }, [fetchPage]);

  return { posts, setPosts, loading, loadingMore, hasMore, loadMore, refresh };
}
