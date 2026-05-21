// Hook do komunikacji z backendem — sprawdza dostępność i udostępnia metody API
// Backend jest jedynym źródłem prawdy — brak fallbacku do localStorage
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../lib/supabase';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper: get current access token for Authorization header
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export function useBackend() {
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [channels, setChannels] = useState([]);

  // Health check — public endpoint, no auth needed
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

  // Fetch channels when backend becomes available
  useEffect(() => {
    if (!isBackendAvailable) return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await axios.get(`${BACKEND_URL}/api/channels`, { headers });
        setChannels(res.data);
      } catch (err) {
        console.warn('[useBackend] Failed to fetch channels:', err.message);
      }
    })();
  }, [isBackendAvailable]);

  const fetchChannels = useCallback(async () => {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${BACKEND_URL}/api/channels`, { headers });
    setChannels(res.data);
    return res.data;
  }, []);

  const fetchVideos = useCallback(async (channelId) => {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${BACKEND_URL}/api/channels/${channelId}/videos`, { headers });
    return res.data;
  }, []);

  const addChannel = useCallback(async ({ type, name, identifier }) => {
    const headers = await getAuthHeaders();
    const res = await axios.post(`${BACKEND_URL}/api/channels`, { type, name, identifier }, { headers });
    setChannels(prev => [...prev, res.data]);
    return res.data;
  }, []);

  const deleteChannel = useCallback(async (id) => {
    const headers = await getAuthHeaders();
    await axios.delete(`${BACKEND_URL}/api/channels/${id}`, { headers });
    setChannels(prev => prev.filter(c => c.id !== id));
  }, []);

  const refresh = useCallback(async (type) => {
    const headers = await getAuthHeaders();
    const res = await axios.post(`${BACKEND_URL}/api/refresh`, type ? { type } : {}, { headers });
    return res.data;
  }, []);

  // Sync API keys to backend (called when user updates keys in settings)
  const syncApiKeys = useCallback(async () => {
    if (!isBackendAvailable) return;
    const { getStoredYouTubeKey, getStoredTikTokKey } = await import('../utils/apiKeys');
    const youtubeApiKey = getStoredYouTubeKey();
    const tiktokApiKey = getStoredTikTokKey();
    try {
      const headers = await getAuthHeaders();
      await axios.post(`${BACKEND_URL}/api/settings`, { youtubeApiKey, tiktokApiKey }, { headers });
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
