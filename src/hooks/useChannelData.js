// Hook do pobierania danych dla kanału (YouTube lub TikTok)
// Gdy backend jest dostępny, pobiera dane z backendu zamiast bezpośrednio z API
// Auto-refresh co 5 minut gdy backend dostępny
import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { fetchYouTubeVideos } from '../utils/youtube';
import { fetchTikTokVideos, fetchTikTokVideoByUrl } from '../utils/tiktok';
import { loadChannelData, saveChannelData } from '../utils/storage';
import { canRefreshTikTok, markTikTokRefreshed } from '../utils/rateLimiter';
import { saveSnapshots } from '../utils/viewHistory';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useChannelData(channel, { isBackendAvailable = false } = {}) {
  const [videos, setVideos] = useState(() => {
    const cached = loadChannelData(channel?.id);
    return cached?.videos || null;
  });
  const [channelStats, setChannelStats] = useState(() => {
    const cached = loadChannelData(channel?.id);
    return cached?.channelStats || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(() => {
    const cached = loadChannelData(channel?.id);
    return cached?.cachedAt || null;
  });

  const fetchData = useCallback(async () => {
    if (!channel) return;

    // Backend path: fetch from /api/channels/:id/videos
    if (isBackendAvailable && channel.id) {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${BACKEND_URL}/api/channels/${channel.id}/videos`);
        const backendVideos = res.data;

        // Map backend format to frontend Unified_Video_Format
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
          // Pass raw snapshots for sparkline (already ordered ASC by timestamp)
          _backendSnapshots: v.snapshots || [],
        }));

        setVideos(mappedVideos);
        setChannelStats(null); // Backend doesn't provide channel stats yet
        setLastFetchedAt(Date.now());
        saveChannelData(channel.id, { videos: mappedVideos, channelStats: null });

        // Save snapshots for sparkline from backend data
        if (backendVideos.length > 0) {
          for (const v of backendVideos) {
            if (v.snapshots && v.snapshots.length > 0) {
              const latestSnapshot = v.snapshots[v.snapshots.length - 1];
              saveSnapshots([{
                id: v.video_id,
                viewCount: latestSnapshot.view_count,
              }]);
            }
          }
        }
      } catch (err) {
        console.error(`[useChannelData] Backend fetch failed for "${channel.name}":`, err.message);
        setError(err.message || 'Błąd pobierania z backendu');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fallback: direct API path (original logic)
    // TikTok rate limit check — if cooldown is active, skip fetch silently and keep cached data
    if (channel.type === 'tiktok' && !canRefreshTikTok()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let fetchedVideos;
      let fetchedChannelStats = null;

      if (channel.type === 'youtube') {
        const result = await fetchYouTubeVideos(channel.identifier);
        fetchedVideos = result.videos;
        fetchedChannelStats = result.channelStats;
      } else if (channel.type === 'tiktok') {
        if (channel.mode === 'manual' && channel.videoUrls?.length > 0) {
          // Fetch each URL individually — no channel stats available in this mode
          const results = await Promise.allSettled(
            channel.videoUrls
              .filter(url => url.trim())
              .map(url => fetchTikTokVideoByUrl(url))
          );
          fetchedVideos = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
          fetchedChannelStats = null;
        } else {
          const result = await fetchTikTokVideos(channel.identifier);
          fetchedVideos = result.videos;
          fetchedChannelStats = result.channelStats;
        }
        // Mark TikTok as refreshed after successful fetch
        markTikTokRefreshed();
      }

      setVideos(fetchedVideos);
      setChannelStats(fetchedChannelStats);
      setLastFetchedAt(Date.now());
      saveChannelData(channel.id, { videos: fetchedVideos, channelStats: fetchedChannelStats });

      // Save view history snapshots for sparkline tracking
      saveSnapshots(fetchedVideos.map(v => ({
        id: v.id || v.videoId,
        viewCount: v.viewCount,
      })));
    } catch (err) {
      console.error(`Błąd pobierania danych dla kanału "${channel.name}":`, err);
      setError(err.message || 'Nieznany błąd');
      // Zachowujemy ostatnie znane dane
    } finally {
      setLoading(false);
    }
  }, [channel, isBackendAvailable]);

  // Auto-refresh every 5 minutes when backend is available
  const intervalRef = useRef(null);
  useEffect(() => {
    if (isBackendAvailable && channel?.id) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isBackendAvailable, channel?.id, fetchData]);

  return {
    videos,
    channelStats,
    loading,
    error,
    lastFetchedAt,
    fetchData,
  };
}
