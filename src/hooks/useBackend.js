// Hook do komunikacji z backendem — sprawdza dostępność i udostępnia metody API
// Automatycznie migruje kanały z localStorage i synchronizuje klucze API
// Backend jest jedynym źródłem prawdy — brak fallbacku do localStorage
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getYouTubeApiKey, getTikTokApiKey } from '../utils/apiKeys';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CHANNELS_STORAGE_KEY = 'creator-dashboard-channels';

export function useBackend() {
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // true during initial health check
  const [channels, setChannels] = useState([]);
  const syncDone = useRef(false);

  // Health check function — can be called for retry
  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      await axios.get(`${BACKEND_URL}/api/health`, { timeout: 3000 });
      setIsBackendAvailable(true);
    } catch {
      setIsBackendAvailable(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check backend health on mount
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // When backend becomes available: sync API keys + migrate channels from localStorage
  useEffect(() => {
    if (!isBackendAvailable || syncDone.current) return;
    syncDone.current = true;

    (async () => {
      // 1. Sync API keys from localStorage to backend (in-memory)
      const youtubeApiKey = getYouTubeApiKey();
      const tiktokApiKey = getTikTokApiKey();

      if (youtubeApiKey || tiktokApiKey) {
        try {
          await axios.post(`${BACKEND_URL}/api/settings`, {
            youtubeApiKey,
            tiktokApiKey,
          });
          console.log('[useBackend] API keys synced to backend');
        } catch (err) {
          console.warn('[useBackend] Failed to sync API keys:', err.message);
        }
      }

      // 2. Fetch backend channels
      let backendChannels = [];
      try {
        const res = await axios.get(`${BACKEND_URL}/api/channels`);
        backendChannels = res.data;
      } catch (err) {
        console.warn('[useBackend] Failed to fetch backend channels:', err.message);
        return;
      }

      // 3. If backend has no channels but localStorage does — migrate them
      if (backendChannels.length === 0) {
        let localChannels = [];
        try {
          const stored = localStorage.getItem(CHANNELS_STORAGE_KEY);
          if (stored) {
            localChannels = JSON.parse(stored);
          }
        } catch {
          // ignore parse errors
        }

        if (localChannels.length > 0) {
          console.log(`[useBackend] Migrating ${localChannels.length} channel(s) from localStorage to backend...`);

          for (const ch of localChannels) {
            try {
              const res = await axios.post(`${BACKEND_URL}/api/channels`, {
                type: ch.type,
                name: ch.name,
                identifier: ch.identifier,
              });
              backendChannels.push(res.data);
              console.log(`  ✓ ${ch.name} (${ch.type})`);
            } catch (err) {
              console.warn(`  ✗ ${ch.name}: ${err.message}`);
            }
          }

          console.log('[useBackend] Migration complete');
        }
      }

      setChannels(backendChannels);
    })();
  }, [isBackendAvailable]);

  const fetchChannels = useCallback(async () => {
    const res = await axios.get(`${BACKEND_URL}/api/channels`);
    setChannels(res.data);
    return res.data;
  }, []);

  const fetchVideos = useCallback(async (channelId) => {
    const res = await axios.get(`${BACKEND_URL}/api/channels/${channelId}/videos`);
    return res.data;
  }, []);

  const addChannel = useCallback(async ({ type, name, identifier }) => {
    const res = await axios.post(`${BACKEND_URL}/api/channels`, { type, name, identifier });
    setChannels(prev => [...prev, res.data]);
    return res.data;
  }, []);

  const deleteChannel = useCallback(async (id) => {
    await axios.delete(`${BACKEND_URL}/api/channels/${id}`);
    setChannels(prev => prev.filter(c => c.id !== id));
  }, []);

  const refresh = useCallback(async (type) => {
    const res = await axios.post(`${BACKEND_URL}/api/refresh`, type ? { type } : {});
    return res.data;
  }, []);

  // Sync API keys to backend (called when user updates keys in settings)
  const syncApiKeys = useCallback(async () => {
    if (!isBackendAvailable) return;
    const youtubeApiKey = getYouTubeApiKey();
    const tiktokApiKey = getTikTokApiKey();
    try {
      await axios.post(`${BACKEND_URL}/api/settings`, { youtubeApiKey, tiktokApiKey });
    } catch (err) {
      console.warn('[useBackend] Failed to sync API keys:', err.message);
    }
  }, [isBackendAvailable]);

  return {
    isBackendAvailable,
    isChecking,
    backendUrl: BACKEND_URL,
    channels,
    fetchChannels,
    fetchVideos,
    addChannel,
    deleteChannel,
    refresh,
    syncApiKeys,
    checkHealth,
  };
}
