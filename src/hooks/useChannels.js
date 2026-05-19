// Hook do zarządzania kanałami (CRUD + localStorage)
import { useState, useCallback } from 'react';
import { loadChannels, saveChannels, loadChannelData, removeChannelData } from '../utils/storage';
import { removeHistories } from '../utils/viewHistory';
import { generateId } from '../utils/formatters';

export function useChannels() {
  const [channels, setChannels] = useState(() => loadChannels());

  const addChannel = useCallback((channelData) => {
    const newChannel = {
      id: generateId(),
      type: channelData.type, // 'youtube' | 'tiktok'
      name: channelData.name,
      identifier: channelData.identifier,
      mode: channelData.mode || 'auto',       // 'auto' | 'manual'
      videoUrls: channelData.videoUrls || [],  // up to 3 URLs for manual mode
      createdAt: Date.now(),
    };

    setChannels(prev => {
      const updated = [...prev, newChannel];
      saveChannels(updated);
      return updated;
    });

    return newChannel;
  }, []);

  const updateChannel = useCallback((channelId, channelData) => {
    setChannels(prev => {
      const updated = prev.map(ch =>
        ch.id === channelId
          ? { ...ch, ...channelData, id: channelId }
          : ch
      );
      saveChannels(updated);
      return updated;
    });
  }, []);

  const removeChannel = useCallback((channelId) => {
    // Read cached channel data to get video IDs before removing
    const cachedData = loadChannelData(channelId);
    if (cachedData?.videos && Array.isArray(cachedData.videos)) {
      const videoIds = cachedData.videos
        .map(v => v.id || v.videoId)
        .filter(Boolean)
        .map(String);
      if (videoIds.length > 0) {
        removeHistories(videoIds);
      }
    }

    setChannels(prev => {
      const updated = prev.filter(ch => ch.id !== channelId);
      saveChannels(updated);
      removeChannelData(channelId);
      return updated;
    });
  }, []);

  const youtubeChannels = channels.filter(ch => ch.type === 'youtube');
  const tiktokChannels = channels.filter(ch => ch.type === 'tiktok');

  return {
    channels,
    youtubeChannels,
    tiktokChannels,
    addChannel,
    updateChannel,
    removeChannel,
  };
}
