// localStorage helpers for Creator Stats Dashboard

const CHANNELS_KEY = 'creator-dashboard-channels';
const DATA_PREFIX = 'creator-dashboard-data-';
const LAST_REFRESH_KEY = 'creator-dashboard-last-refresh';

export function loadChannels() {
  try {
    const data = localStorage.getItem(CHANNELS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Błąd odczytu kanałów z localStorage:', e);
    return [];
  }
}

export function saveChannels(channels) {
  try {
    localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
  } catch (e) {
    console.error('Błąd zapisu kanałów do localStorage:', e);
  }
}

export function loadChannelData(channelId) {
  try {
    const data = localStorage.getItem(DATA_PREFIX + channelId);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error(`Błąd odczytu danych kanału ${channelId}:`, e);
    return null;
  }
}

export function saveChannelData(channelId, data) {
  try {
    localStorage.setItem(DATA_PREFIX + channelId, JSON.stringify({
      ...data,
      cachedAt: Date.now(),
    }));
  } catch (e) {
    console.error(`Błąd zapisu danych kanału ${channelId}:`, e);
  }
}

export function removeChannelData(channelId) {
  try {
    localStorage.removeItem(DATA_PREFIX + channelId);
  } catch (e) {
    console.error(`Błąd usuwania danych kanału ${channelId}:`, e);
  }
}

export function loadLastRefresh() {
  try {
    const ts = localStorage.getItem(LAST_REFRESH_KEY);
    return ts ? parseInt(ts, 10) : null;
  } catch {
    return null;
  }
}

export function saveLastRefresh(timestamp) {
  try {
    localStorage.setItem(LAST_REFRESH_KEY, String(timestamp));
  } catch (e) {
    console.error('Błąd zapisu timestampu:', e);
  }
}
