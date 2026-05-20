// ChannelCard — karta kanału (Attio/Linear dark style)
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
  const [timeRangeMs, setTimeRangeMs] = useState(24 * 60 * 60 * 1000);

  useEffect(() => {
    fetchData();
  }, [refreshTrigger, fetchData]);

  const isYoutube = channel.type === 'youtube';
  const PlatformIcon = isYoutube ? Play : Music;

  return (
    <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-5">
      {/* Channel header */}
      <div className="mb-4 flex items-center justify-between">
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
            {channelStats && (
              <div className="mt-1 flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-[#555]" />
                  <span className="text-[#A1A1AA] font-medium">
                    {formatViewCount(isYoutube ? channelStats.subscriberCount : channelStats.followerCount)}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-[#555]" />
                  <span className="text-[#A1A1AA] font-medium">
                    {formatViewCount(isYoutube ? channelStats.viewCount : channelStats.heartCount)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => onEdit(channel)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-[#888] hover:text-white hover:bg-[#252525] transition-colors cursor-pointer"
          title="Edytuj kanał"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Error */}
      {error && <ErrorBanner message={error} hasCache={!!videos} lastFetchedAt={lastFetchedAt} />}

      {/* Content */}
      {loading && !videos ? (
        <LoadingSkeleton count={3} />
      ) : videos && videos.length > 0 ? (
        <>
          {/* Time range + legend */}
          <div className="mb-3 flex items-center justify-between">
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
            <div className="flex items-center gap-0.5">
              {TIME_RANGES.map(({ label, ms }) => (
                <button
                  key={label}
                  onClick={(e) => { e.preventDefault(); setTimeRangeMs(ms); }}
                  className={`px-2 py-0.5 text-[10px] rounded-md cursor-pointer transition-colors ${
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
      ) : !error ? (
        <div className="flex items-center justify-center rounded-lg bg-[#0F0F0F] border border-[#1A1A1A] py-8">
          <p className="text-sm text-[#555]">Brak filmów do wyświetlenia</p>
        </div>
      ) : null}
    </div>
  );
}
