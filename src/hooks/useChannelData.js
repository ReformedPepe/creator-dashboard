// Hook do pobierania danych dla kanału (YouTube lub TikTok)
import { useState, useCallback } from 'react';
import { fetchYouTubeVideos } from '../utils/youtube';
import { fetchTikTokVideos, fetchTikTokVideoByUrl } from '../utils/tiktok';
import { loadChannelData, saveChannelData } from '../utils/storage';
import { canRefreshTikTok, markTikTokRefreshed } from '../utils/rateLimiter';
import { saveSnapshots } from '../utils/viewHistory';

export function useChannelData(channel) {
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
  }, [channel]);

  return {
    videos,
    channelStats,
    loading,
    error,
    lastFetchedAt,
    fetchData,
  };
}
