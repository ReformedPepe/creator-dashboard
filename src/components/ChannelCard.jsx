// ChannelCard — karta jednego kanału z listą filmów
import { useEffect, useState } from 'react';
import { Play, Music, Settings, Users, Eye } from 'lucide-react';
import { useChannelData } from '../hooks/useChannelData';
import { formatViewCount } from '../utils/formatters';
import VideoCard from './VideoCard';
import LoadingSkeleton from './LoadingSkeleton';
import ErrorBanner from './ErrorBanner';

const TIME_RANGES = [
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '12h', ms: 12 * 60 * 60 * 1000 },
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: 'Wszystko', ms: Infinity },
];

export default function ChannelCard({ channel, onEdit, refreshTrigger, isBackendAvailable }) {
  const { videos, channelStats, loading, error, lastFetchedAt, fetchData } = useChannelData(channel, { isBackendAvailable });
  const [timeRangeMs, setTimeRangeMs] = useState(24 * 60 * 60 * 1000); // default 24h

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, fetchData]);

  const PlatformIcon = channel.type === 'youtube' ? Play : Music;

  return (
    <div className="rounded-[var(--radius-card)] bg-bg-card p-5 shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card-hover)]">
      {/* Channel header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${
            channel.type === 'youtube' ? 'bg-youtube-bg' : 'bg-tiktok-bg'
          }`}>
            <PlatformIcon className={`h-4 w-4 ${
              channel.type === 'youtube' ? 'text-youtube' : 'text-tiktok'
            }`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary leading-tight">
              {channel.name}
            </h3>
            <p className="text-[11px] text-text-muted font-mono">
              {channel.identifier}
            </p>
            {channelStats && (
              <div className="mt-1 flex items-center gap-3 text-[12px]">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-text-muted" />
                  <span className="text-text-secondary font-semibold">
                    {formatViewCount(
                      channel.type === 'youtube'
                        ? channelStats.subscriberCount
                        : channelStats.followerCount
                    )}
                  </span>
                  <span className="text-text-muted">
                    {channel.type === 'youtube' ? 'subskrybentów' : 'obserwujących'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-text-muted" />
                  <span className="text-text-secondary font-semibold">
                    {formatViewCount(
                      channel.type === 'youtube'
                        ? channelStats.viewCount
                        : channelStats.heartCount
                    )}
                  </span>
                  <span className="text-text-muted">
                    {channel.type === 'youtube' ? 'wyświetleń' : 'polubień'}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onEdit(channel)}
          className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted transition-all duration-200 hover:bg-bg-page hover:text-text-secondary cursor-pointer"
          title="Edytuj kanał"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <ErrorBanner 
          message={error} 
          hasCache={!!videos}
          lastFetchedAt={lastFetchedAt}
        />
      )}

      {/* Content */}
      {loading && !videos ? (
        <LoadingSkeleton count={3} />
      ) : videos && videos.length > 0 ? (
        <>
          {/* Sparkline legend + time range selector */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: 'var(--color-trend-up)' }} />
                wzrost
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: 'var(--color-trend-neutral)' }} />
                stabilnie
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: 'var(--color-trend-down)' }} />
                spadek
              </span>
            </div>
            <div className="flex items-center gap-1">
              {TIME_RANGES.map(({ label, ms }) => (
                <button
                  key={label}
                  onClick={(e) => { e.preventDefault(); setTimeRangeMs(ms); }}
                  className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
                    timeRangeMs === ms
                      ? 'bg-accent-purple/20 text-accent-purple font-semibold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      ) : !error ? (
        <div className="flex items-center justify-center rounded-[var(--radius-video)] bg-bg-page py-8">
          <p className="text-sm text-text-muted">Brak filmów do wyświetlenia</p>
        </div>
      ) : null}
    </div>
  );
}
