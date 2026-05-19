import { useState, useCallback } from 'react';
import { Play, Music } from 'lucide-react';
import Layout from './components/Layout';
import Header from './components/Header';
import EmptyState from './components/EmptyState';
import ChannelManager from './components/ChannelManager';
import ChannelCard from './components/ChannelCard';
import SettingsPanel from './components/SettingsPanel';
import { useChannels } from './hooks/useChannels';
import { loadLastRefresh, saveLastRefresh } from './utils/storage';
import { getTikTokCooldownMinutes } from './utils/rateLimiter';

export default function App() {
  const {
    channels,
    youtubeChannels,
    tiktokChannels,
    addChannel,
    updateChannel,
    removeChannel,
  } = useChannels();

  const [managerOpen, setManagerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(() => loadLastRefresh());
  const [tiktokCooldownMinutes, setTiktokCooldownMinutes] = useState(() => getTikTokCooldownMinutes());

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);

    // Give ChannelCards time to trigger their fetches
    // Use a short delay to allow re-renders to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    const now = Date.now();
    saveLastRefresh(now);
    setLastRefreshAt(now);
    setTiktokCooldownMinutes(getTikTokCooldownMinutes());
    setIsRefreshing(false);
  }, []);

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
      updateChannel(data.id, data);
    } else {
      addChannel(data);
    }
  };

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
        onDelete={removeChannel}
        editingChannel={editingChannel}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </Layout>
  );
}
