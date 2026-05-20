import { useState, useCallback } from 'react';
import { Play, Music, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import EmptyState from './components/EmptyState';
import ChannelManager from './components/ChannelManager';
import ChannelCard from './components/ChannelCard';
import SettingsPage from './components/SettingsPage';
import { useBackend } from './hooks/useBackend';
import { saveLastRefresh } from './utils/storage';

export default function App() {
  // ALL hooks must be called unconditionally at the top
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

  const [currentView, setCurrentView] = useState('dashboard');
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('creator-dashboard-sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const youtubeChannels = channels.filter(ch => ch.type === 'youtube');
  const tiktokChannels = channels.filter(ch => ch.type === 'tiktok');

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await backendRefresh('youtube');
      await fetchChannels();
    } catch (err) {
      console.error('Backend refresh failed:', err);
    }
    saveLastRefresh(Date.now());
    setIsRefreshing(false);
  }, [backendRefresh, fetchChannels]);

  const handleNavigate = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const openAddModal = useCallback(() => {
    setEditingChannel(null);
    setManagerOpen(true);
  }, []);

  const openEditModal = useCallback((channel) => {
    setEditingChannel(channel);
    setManagerOpen(true);
  }, []);

  const handleSave = useCallback((data) => {
    if (!data.id) {
      addChannel(data);
    }
  }, [addChannel]);

  // --- Conditional renders (after all hooks) ---

  // Loading state
  if (isChecking) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
          <p className="text-sm text-text-muted">Łączenie z serwerem...</p>
        </div>
      </div>
    );
  }

  // Error state — backend unavailable
  if (!isBackendAvailable) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-500/10 mb-5">
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
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-light transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  // Main app layout
  return (
    <div className="min-h-screen bg-bg-page">
      <Sidebar currentView={currentView} onNavigate={handleNavigate} onCollapseChange={setSidebarCollapsed} />

      {/* Main content area */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}>
        <div className="dotted-bg min-h-screen p-6">
          {/* Dashboard view */}
          {(currentView === 'dashboard' || currentView === 'channels') && (
            <>
              <Topbar
                title={currentView === 'dashboard' ? 'Dashboard' : 'Kanały'}
                onRefresh={handleManualRefresh}
                onAddChannel={openAddModal}
                isRefreshing={isRefreshing}
              />

              {channels.length === 0 ? (
                <EmptyState onAddChannel={openAddModal} />
              ) : (
                <div className="space-y-6">
                  {/* YouTube Section */}
                  {youtubeChannels.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-youtube" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">
                          YouTube
                        </span>
                        <span className="text-[11px] text-[#52525B]">
                          ({youtubeChannels.length})
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
                      <div className="mb-3 flex items-center gap-2">
                        <Music className="h-3.5 w-3.5 text-tiktok" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">
                          TikTok
                        </span>
                        <span className="text-[11px] text-[#52525B]">
                          ({tiktokChannels.length})
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
            </>
          )}

          {/* Settings view */}
          {currentView === 'settings' && (
            <>
              <Topbar title="Ustawienia" />
              <SettingsPage onKeysSaved={syncApiKeys} />
            </>
          )}
        </div>
      </main>

      {/* Channel Manager Modal */}
      <ChannelManager
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSave={handleSave}
        onDelete={deleteChannel}
        editingChannel={editingChannel}
      />
    </div>
  );
}
