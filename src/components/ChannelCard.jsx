// ChannelCard — karta kanału z loading spinner i zwijaniem
import { useState, useRef, useEffect } from 'react';
import { Play, Music, Settings, Loader2, ChevronDown, Users, Eye, Film, Heart } from 'lucide-react';
import { formatViewCount } from '../utils/formatters';
import VideoCard from './VideoCard';

const TIME_RANGES = [
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '12h', ms: 12 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Wszystko', ms: Infinity },
];

function getCollapseKey(channelId) {
  return `statflow-collapsed-${channelId}`;
}

export default function ChannelCard({ channel, videos, loading, onEdit, hasApiKey, onGoToSettings }) {
  const [timeRangeMs, setTimeRangeMs] = useState(24 * 60 * 60 * 1000);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(getCollapseKey(channel.id)) === 'true';
    } catch {
      return false;
    }
  });
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState('auto');

  const isYoutube = channel.type === 'youtube';
  const PlatformIcon = isYoutube ? Play : Music;

  // Measure content height for smooth animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight + 'px');
    }
  }, [videos, loading, timeRangeMs]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(getCollapseKey(channel.id), String(next));
    } catch {}
  };

  return (
    <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-3.5 md:p-5">
      {/* Channel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            isYoutube ? 'bg-youtube-bg' : 'bg-tiktok-bg'
          }`}>
            <PlatformIcon className={`h-4 w-4 ${isYoutube ? 'text-youtube' : 'text-tiktok'}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {channel.name}
            </h3>
            <p className="text-[11px] text-[#888] font-mono">
              {channel.identifier}
            </p>
            {/* Channel stats */}
            {(channel.subscriber_count > 0 || channel.follower_count > 0) && (
              <div className="flex items-center gap-3 mt-1 text-[10px] text-[#666]">
                {channel.type === 'youtube' && (
                  <>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatViewCount(channel.subscriber_count || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatViewCount(channel.total_view_count || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Film className="h-3 w-3" />
                      {channel.video_count || 0}
                    </span>
                  </>
                )}
                {channel.type === 'tiktok' && (
                  <>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatViewCount(channel.follower_count || 0)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatViewCount(channel.total_view_count || 0)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-[#888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
            title={collapsed ? 'Rozwiń' : 'Zwiń'}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
          </button>
          <button
            onClick={() => onEdit(channel)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-[#888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
            title="Edytuj kanał"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible content */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: collapsed ? '0px' : contentHeight,
          opacity: collapsed ? 0 : 1,
          marginTop: collapsed ? '0px' : '16px',
        }}
      >
        {/* Loading spinner — shown during refresh */}
        {loading && !videos ? (
          <div className="flex items-center justify-center rounded-lg bg-[#0F0F0F] border border-[#1A1A1A] py-12">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              <p className="text-xs text-[#555]">Odświeżanie danych...</p>
            </div>
          </div>
        ) : videos && videos.length > 0 ? (
          <>
            {/* Time range + legend */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-[10px] text-[#555]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-[2px] w-3 rounded bg-accent" />
                  wzrost
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-[2px] w-3 rounded bg-[#333]" />
                  stabilnie
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-[2px] w-3 rounded bg-[#64748B]" />
                  spadek
                </span>
              </div>
              <div className="flex items-center gap-0.5 overflow-x-auto">
                {TIME_RANGES.map(({ label, ms }) => (
                  <button
                    key={label}
                    onClick={(e) => { e.preventDefault(); setTimeRangeMs(ms); }}
                    className={`px-2 py-0.5 text-[10px] rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                      timeRangeMs === ms
                        ? 'bg-accent-muted text-accent-light font-semibold'
                        : 'text-[#555] hover:text-[#888]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  platform={channel.type}
                  timeRangeMs={timeRangeMs}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-[#0F0F0F] border border-[#1A1A1A] py-8">
            {!hasApiKey ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-[#888]">
                  Dodaj klucz {channel.type === 'youtube' ? 'YouTube API' : 'TikTok RapidAPI'} w Ustawieniach żeby zobaczyć filmy
                </p>
                <button
                  onClick={onGoToSettings}
                  className="text-xs text-accent hover:underline cursor-pointer"
                >
                  Przejdź do Ustawień →
                </button>
              </div>
            ) : (
              <p className="text-sm text-[#555]">Brak filmów do wyświetlenia</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
