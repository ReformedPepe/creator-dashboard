import { useState, useCallback } from 'react';
import { Play, Music, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import Layout from './components/Layout';
import Header from './components/Header';
import EmptyState from './components/EmptyState';
import ChannelManager from './components/ChannelManager';
import ChannelCard from './components/ChannelCard';
import SettingsPanel from './components/SettingsPanel';
import { useBackend } from './hooks/useBackend';
import { loadLastRefresh, saveLastRefresh } from './utils/storage';
import { getTikTokCooldownMinutes } from './utils/rateLimiter';

export default function App() {
  const {
    isBackendAvailable,
    isChecking,
    channels,
    fetchChannels,
    addChannel,
    deleteChannel,
    refresh: backendRefresh,
    syncApiKeys,
    checkHealth,
  } = useBackend();

  const youtubeChannels = channels.filter(ch => ch.type === 'youtube');
  const tiktokChannels = channels.filter(ch => ch.type === 'tiktok');

  const [managerOpen, setManagerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(() => loadLastRefresh());
  const [tiktokCooldownMinutes, setTiktokCooldownMinutes] = useState(() => getTikTokCooldownMinutes());

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await backendRefresh('youtube');
      await fetchChannels();
    } catch (err) {
      console.error('Backend refresh failed:', err);
    }
    const now = Date.now();
    saveLastRefresh(now);
    setLastRefreshAt(now);
    setIsRefreshing(false);
  }, [backendRefresh, fetchChannels]);

  const openAddModal = () => {
    setEditingChannel(null);
    setManagerOpen(true);
  };

  const openEditModal = (channel) => {
    setEditingChannel(channel);
    setManagerOpen(true);
  };

  const handleSave = (data) => {
    if (data.id) {
      // Edit not supported via backend yet — skip
    } else {
      addChannel(data);
    }
  };

  // Loading state — initial health check in progress
  if (isChecking) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-accent-purple mb-4" />
          <p className="text-sm text-text-muted">Łączenie z serwerem...</p>
        </div>
      </Layout>
    );
  }

  // Error state — backend unavailable
  if (!isBackendAvailable) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error/10 mb-5">
            <WifiOff className="h-8 w-8 text-error" />
          </div>
          <h2 className="text-lg font-bold text-text-primary mb-2">
            Nie można połączyć się z serwerem
          </h2>
          <p className="text-sm text-text-muted mb-6 text-center max-w-sm">
            Upewnij się, że backend jest uruchomiony na porcie 3001
          </p>
          <button
            onClick={checkHealth}
            className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Spróbuj ponownie
          </button>
        </div>
      </Layout>
    );
  }

  const hasChannels = channels.length > 0;

  return (
    <Layout>
      <Header
        onAddChannel={openAddModal}
        onOpenSettings={() => setIsSettingsOpen(true)}
        lastRefreshAt={lastRefreshAt}
        isRefreshing={isRefreshing}
        onManualRefresh={handleManualRefresh}
        tiktokCooldownMinutes={tiktokCooldownMinutes}
        channelCount={channels.length}
        isBackendAvailable={isBackendAvailable}
      />

      {!hasChannels ? (
        <EmptyState onAddChannel={openAddModal} />
      ) : (
        <div className="space-y-8">
          {/* YouTube Section */}
          {youtubeChannels.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-youtube-bg">
                  <Play className="h-3.5 w-3.5 text-youtube" />
                </div>
                <h2 className="text-base font-bold text-text-primary">YouTube</h2>
                <span className="rounded-[var(--radius-pill)] bg-youtube-bg px-2 py-0.5 text-[11px] font-semibold text-youtube">
                  {youtubeChannels.length}
                </span>
              </div>
              <div className="space-y-4">
                {youtubeChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onEdit={openEditModal}
                    refreshTrigger={refreshTrigger}
                    isBackendAvailable={isBackendAvailable}
                  />
                ))}
              </div>
            </section>
          )}

          {/* TikTok Section */}
          {tiktokChannels.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-tiktok-bg">
                  <Music className="h-3.5 w-3.5 text-tiktok" />
                </div>
                <h2 className="text-base font-bold text-text-primary">TikTok</h2>
                <span className="rounded-[var(--radius-pill)] bg-tiktok-bg px-2 py-0.5 text-[11px] font-semibold text-tiktok">
                  {tiktokChannels.length}
                </span>
              </div>
              <div className="space-y-4">
                {tiktokChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    onEdit={openEditModal}
                    refreshTrigger={refreshTrigger}
                    isBackendAvailable={isBackendAvailable}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ChannelManager
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSave={handleSave}
        onDelete={deleteChannel}
        editingChannel={editingChannel}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeysSaved={syncApiKeys}
      />
    </Layout>
  );
}
