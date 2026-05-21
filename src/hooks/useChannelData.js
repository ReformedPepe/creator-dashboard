// Hook do pobierania danych dla kanału (YouTube lub TikTok)
// Gdy backend jest dostępny, pobiera dane z backendu zamiast bezpośrednio z API
// Auto-refresh co 2 minuty gdy backend dostępny
import { useState, useEffect, useRef, useReducer } from 'react';
import axios from 'axios';
import { fetchYouTubeVideos } from '../utils/youtube';
import { fetchTikTokVideos, fetchTikTokVideoByUrl } from '../utils/tiktok';
import { loadChannelData, saveChannelData } from '../utils/storage';
import { canRefreshTikTok, markTikTokRefreshed } from '../utils/rateLimiter';
import { saveSnapshots } from '../utils/viewHistory';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AUTO_REFRESH_MS = 2 * 60 * 1000; // 2 minutes

export function useChannelData(channel, { isBackendAvailable = false } = {}) {
  // Use useReducer to guarantee re-renders on state changes
  const [state, dispatch] = useReducer((prev, action) => {
    switch (action.type) {
      case 'LOADING':
        return { ...prev, loading: true, error: null };
      case 'SUCCESS':
        return {
          ...prev,
          videos: action.videos,
          channelStats: action.channelStats,
          lastFetchedAt: Date.now(),
          loading: false,
          error: null,
        };
      case 'ERROR':
        return { ...prev, loading: false, error: action.error };
      case 'DONE_LOADING':
        return { ...prev, loading: false };
      default:
        return prev;
    }
  }, null, () => {
    const cached = loadChannelData(channel?.id);
    return {
      videos: cached?.videos || null,
      channelStats: cached?.channelStats || null,
      loading: false,
      error: null,
      lastFetchedAt: cached?.cachedAt || null,
    };
  });

  const channelRef = useRef(channel);
  channelRef.current = channel;
  const isBackendRef = useRef(isBackendAvailable);
  isBackendRef.current = isBackendAvailable;

  // fetchData as a ref-based function (always fresh, no stale closures)
  const fetchData = useRef(async () => {
    const ch = channelRef.current;
    if (!ch) return;

    if (isBackendRef.current && ch.id) {
      dispatch({ type: 'LOADING' });
      try {
        const res = await axios.get(`${BACKEND_URL}/api/channels/${ch.id}/videos`);
        const backendVideos = res.data;

        const mappedVideos = backendVideos.map(v => ({
          id: v.video_id,
          title: v.title || 'Bez tytułu',
          thumbnail: v.thumbnail || '',
          viewCount: v.snapshots?.length > 0
            ? v.snapshots[v.snapshots.length - 1].view_count
            : 0,
          likeCount: v.like_count || 0,
          commentCount: v.comment_count || 0,
          publishedAt: v.published_at || new Date().toISOString(),
          url: '',
          _backendSnapshots: [...(v.snapshots || [])],
        }));

        dispatch({ type: 'SUCCESS', videos: mappedVideos, channelStats: null });
        saveChannelData(ch.id, { videos: mappedVideos, channelStats: null });

        // Save snapshots for sparkline
        for (const v of backendVideos) {
          if (v.snapshots && v.snapshots.length > 0) {
            const latestSnapshot = v.snapshots[v.snapshots.length - 1];
            saveSnapshots([{ id: v.video_id, viewCount: latestSnapshot.view_count }]);
          }
        }
      } catch (err) {
        dispatch({ type: 'ERROR', error: err.message || 'Błąd pobierania z backendu' });
      }
      return;
    }

    // Fallback: direct API
    if (ch.type === 'tiktok' && !canRefreshTikTok()) {
      dispatch({ type: 'DONE_LOADING' });
      return;
    }

    dispatch({ type: 'LOADING' });
    try {
      let fetchedVideos;
      let fetchedChannelStats = null;

      if (ch.type === 'youtube') {
        const result = await fetchYouTubeVideos(ch.identifier);
        fetchedVideos = result.videos;
        fetchedChannelStats = result.channelStats;
      } else if (ch.type === 'tiktok') {
        if (ch.mode === 'manual' && ch.videoUrls?.length > 0) {
          const results = await Promise.allSettled(
            ch.videoUrls.filter(url => url.trim()).map(url => fetchTikTokVideoByUrl(url))
          );
          fetchedVideos = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        } else {
          const result = await fetchTikTokVideos(ch.identifier);
          fetchedVideos = result.videos;
          fetchedChannelStats = result.channelStats;
        }
        markTikTokRefreshed();
      }

      dispatch({ type: 'SUCCESS', videos: fetchedVideos, channelStats: fetchedChannelStats });
      saveChannelData(ch.id, { videos: fetchedVideos, channelStats: fetchedChannelStats });
      saveSnapshots(fetchedVideos.map(v => ({ id: v.id || v.videoId, viewCount: v.viewCount })));
    } catch (err) {
      dispatch({ type: 'ERROR', error: err.message || 'Nieznany błąd' });
    }
  }).current;

  // Auto-refresh every 2 minutes when backend is available
  useEffect(() => {
    if (!isBackendAvailable || !channel?.id) return;

    const id = setInterval(fetchData, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [isBackendAvailable, channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videos: state.videos,
    channelStats: state.channelStats,
    loading: state.loading,
    error: state.error,
    lastFetchedAt: state.lastFetchedAt,
    fetchData,
  };
}
