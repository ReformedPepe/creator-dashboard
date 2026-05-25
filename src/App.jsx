import { useState, useCallback, useEffect } from 'react';
import { WifiOff, RefreshCw, Loader2, Play, Music } from 'lucide-react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import EmptyState from './components/EmptyState';
import ChannelManager from './components/ChannelManager';
import ChannelCard from './components/ChannelCard';
import SortableChannelList from './components/SortableChannelList';
import SettingsPage from './components/SettingsPage';
import TranscriptPage from './components/TranscriptPage';
import SilenceRemoverPage from './components/SilenceRemoverPage';
import YouTubeDownloaderPage from './components/YouTubeDownloaderPage';
import SocialDownloaderPage from './components/SocialDownloaderPage';
import DownloadToast from './components/DownloadToast';
import LandingPage from './components/LandingPage';
import { useBackend } from './hooks/useBackend';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';
import { saveLastRefresh } from './utils/storage';
import { saveSnapshots } from './utils/viewHistory';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

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
  } = useBackend(user);

  const [currentView, setCurrentView] = useState('dashboard');
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('creator-dashboard-sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Video data stored at App level — keyed by channel id
  const [videosMap, setVideosMap] = useState({});
  // Loading state — shows spinner instead of videos during refresh
  const [videosLoading, setVideosLoading] = useState(false);
  // API key status from backend
  const [keyStatus, setKeyStatus] = useState({ youtubeKeySet: false, tiktokKeySet: false });

  // Global download state for toast (reported by downloader pages)
  const [activeDownload, setActiveDownload] = useState(null);

  const youtubeChannels = channels.filter(ch => ch.type === 'youtube');
  const tiktokChannels = channels.filter(ch => ch.type === 'tiktok');

  // Fetch key status when backend is available and user is logged in
  useEffect(() => {
    if (!isBackendAvailable || !user) return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`${BACKEND_URL}/api/settings/status`, { headers });
        setKeyStatus(res.data);
      } catch {
        // ignore
      }
    })();
  }, [isBackendAvailable, user]);

  // Fetch videos for all channels from backend
  const fetchAllVideos = useCallback(async (showLoading = false) => {
    if (!isBackendAvailable || channels.length === 0) return;

    if (showLoading) setVideosLoading(true);

    const headers = await getAuthHeaders();
    const newMap = {};
    for (const ch of channels) {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/channels/${ch.id}/videos`, { headers });
        const backendVideos = res.data;

        newMap[ch.id] = backendVideos.map(v => ({
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
          _backendSnapshots: v.snapshots || [],
        }));

        // Save latest snapshot for sparkline
        for (const v of backendVideos) {
          if (v.snapshots && v.snapshots.length > 0) {
            const latest = v.snapshots[v.snapshots.length - 1];
            saveSnapshots([{ id: v.video_id, viewCount: latest.view_count }]);
          }
        }
      } catch {
        // keep previous data on error
        newMap[ch.id] = null;
      }
    }
    setVideosMap(newMap);
    setVideosLoading(false);
  }, [isBackendAvailable, channels]);

  // Fetch videos on mount and when channels change
  useEffect(() => {
    if (isBackendAvailable && channels.length > 0) {
      fetchAllVideos(true);
    }
  }, [isBackendAvailable, channels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 2 minutes (silent, no spinner)
  useEffect(() => {
    if (!isBackendAvailable || channels.length === 0) return;
    const id = setInterval(() => fetchAllVideos(false), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [isBackendAvailable, channels.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual refresh: show spinner, trigger backend collection, then fetch fresh data
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setVideosLoading(true);
    // Clear current videos to force spinner display
    setVideosMap({});

    try {
      await backendRefresh('youtube');
      // Wait for backend to finish writing to DB
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error('Backend refresh failed:', err);
    }

    // Fetch fresh data from backend
    if (channels.length > 0) {
      const headers = await getAuthHeaders();
      const newMap = {};
      for (const ch of channels) {
        try {
          const res = await axios.get(`${BACKEND_URL}/api/channels/${ch.id}/videos`, { headers });
          const backendVideos = res.data;
          newMap[ch.id] = backendVideos.map(v => ({
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
            _backendSnapshots: v.snapshots || [],
          }));

          for (const v of backendVideos) {
            if (v.snapshots && v.snapshots.length > 0) {
              const latest = v.snapshots[v.snapshots.length - 1];
              saveSnapshots([{ id: v.video_id, viewCount: latest.view_count }]);
            }
          }
        } catch {
          newMap[ch.id] = null;
        }
      }
      setVideosMap(newMap);
    }

    saveLastRefresh(Date.now());
    setVideosLoading(false);
    setIsRefreshing(false);
  }, [backendRefresh, channels]);

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

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
          <p className="text-sm text-text-muted">Ładowanie...</p>
        </div>
      </div>
    );
  }

  // Not logged in — show landing page
  if (!user) {
    return <LandingPage />;
  }

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

  return (
    <div className="min-h-screen bg-bg-page overflow-x-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        onCollapseChange={setSidebarCollapsed}
        user={user}
        onSignOut={signOut}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <main className={`min-h-screen transition-all duration-300 ml-0 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-56'}`}>
        <div className="dotted-bg min-h-screen p-4 md:p-6">
          {/* Topbar — always rendered first, same position regardless of view */}
          <Topbar
            title={currentView === 'dashboard' ? 'Dashboard' : currentView === 'channels' ? 'Kanały' : currentView === 'youtube-downloader' ? 'YouTube Downloader' : currentView === 'social-downloader' ? 'Social Downloader' : currentView === 'transcript' ? 'Transkrypcja' : currentView === 'silence-remover' ? 'Silence Remover' : 'Ustawienia'}
            onRefresh={(currentView === 'dashboard' || currentView === 'channels') ? handleManualRefresh : undefined}
            onAddChannel={(currentView === 'dashboard' || currentView === 'channels') ? openAddModal : undefined}
            isRefreshing={isRefreshing}
            onMenuToggle={() => setMobileSidebarOpen(true)}
          />

          {(currentView === 'dashboard' || currentView === 'channels') && (
            <>
              {channels.length === 0 ? (
                <EmptyState onAddChannel={openAddModal} />
              ) : (
                <div className="space-y-6">
                  {youtubeChannels.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Play className="h-3.5 w-3.5 text-youtube" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">YouTube</span>
                        <span className="text-[11px] text-[#52525B]">({youtubeChannels.length})</span>
                      </div>
                      <SortableChannelList
                        channels={youtubeChannels}
                        videosMap={videosMap}
                        videosLoading={videosLoading}
                        onEdit={openEditModal}
                        keyStatus={keyStatus}
                        onGoToSettings={() => setCurrentView('settings')}
                        storageKey="statflow-channels-order-youtube"
                      />
                    </section>
                  )}

                  {tiktokChannels.length > 0 && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Music className="h-3.5 w-3.5 text-tiktok" />
                        <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">TikTok</span>
                        <span className="text-[11px] text-[#52525B]">({tiktokChannels.length})</span>
                      </div>
                      <SortableChannelList
                        channels={tiktokChannels}
                        videosMap={videosMap}
                        videosLoading={videosLoading}
                        onEdit={openEditModal}
                        keyStatus={keyStatus}
                        onGoToSettings={() => setCurrentView('settings')}
                        storageKey="statflow-channels-order-tiktok"
                      />
                    </section>
                  )}
                </div>
              )}
            </>
          )}

          {currentView === 'settings' && (
            <SettingsPage onKeysSaved={syncApiKeys} user={user} onSignOut={signOut} />
          )}

          {currentView === 'transcript' && (
            <TranscriptPage />
          )}

          {currentView === 'silence-remover' && (
            <SilenceRemoverPage />
          )}

          {/* Downloaders: keep-alive (not unmounted) so downloads continue in background */}
          <div style={{ display: currentView === 'youtube-downloader' ? 'block' : 'none' }}>
            <YouTubeDownloaderPage
              onDownloadStateChange={(payload) =>
                setActiveDownload(payload ? { ...payload, source: 'youtube-downloader' } : null)
              }
            />
          </div>

          <div style={{ display: currentView === 'social-downloader' ? 'block' : 'none' }}>
            <SocialDownloaderPage
              onDownloadStateChange={(payload) =>
                setActiveDownload(payload ? { ...payload, source: 'social-downloader' } : null)
              }
            />
          </div>
        </div>
      </main>

      <ChannelManager
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        onSave={handleSave}
        onDelete={deleteChannel}
        editingChannel={editingChannel}
      />

      {/* Download toast — visible from any view when a download is active.
          Click toast body (except cancel X) navigates back to the source tool. */}
      {activeDownload && currentView !== 'youtube-downloader' && currentView !== 'social-downloader' && (
        <DownloadToast
          download={activeDownload}
          onCancel={() => setActiveDownload(null)}
          onClick={activeDownload.source ? () => setCurrentView(activeDownload.source) : undefined}
        />
      )}
    </div>
  );
}
