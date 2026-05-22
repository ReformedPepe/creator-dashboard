// VideoCard — karta filmu (miniaturka po lewej 120px, metryki po prawej)
import { useMemo } from 'react';
import { Eye, ThumbsUp, MessageCircle } from 'lucide-react';
import { formatViewCount, formatPercentChange } from '../utils/formatters';
import { calculatePercentChange, calculateTrend, filterZeroSnapshots } from '../utils/trendCalculator';
import { useViewHistory } from '../hooks/useViewHistory';
import SparklineChart from './SparklineChart';

export default function VideoCard({ video, platform, timeRangeMs = Infinity }) {
  // Try backend snapshots first (works across devices), fallback to localStorage
  const localHistory = useViewHistory(video.id || video.videoId);

  const { dataPoints: allDataPoints, trend } = useMemo(() => {
    const backendSnaps = video._backendSnapshots;
    if (backendSnaps && backendSnaps.length >= 2) {
      const points = backendSnaps.map(s => ({
        timestamp: typeof s.timestamp === 'string' ? new Date(s.timestamp).getTime() : s.timestamp,
        viewCount: s.view_count,
      }));
      // Filter out zero/null snapshots — first baseline must be > 0
      const filtered = filterZeroSnapshots(points);
      return { dataPoints: filtered, trend: calculateTrend(filtered) };
    }
    // localStorage fallback — also filter zeros
    const filtered = filterZeroSnapshots(localHistory.dataPoints);
    return { dataPoints: filtered, trend: calculateTrend(filtered) };
  }, [video._backendSnapshots, localHistory]);

  const now = Date.now();
  const dataPoints = timeRangeMs === Infinity
    ? allDataPoints
    : allDataPoints.filter(dp => dp.timestamp >= now - timeRangeMs);

  // Build video URL
  const videoUrl = platform === 'tiktok'
    ? `https://www.tiktok.com/@/video/${video.id}`
    : `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <div className="flex gap-3 rounded-lg bg-[#0F0F0F] border border-[#1A1A1A] p-2.5 md:p-3">
      {/* Thumbnail — clickable, opens video on platform */}
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative w-[80px] md:w-[120px] shrink-0 overflow-hidden rounded-md aspect-video hover:opacity-80 transition-opacity"
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#1A1A1A]">
            <Eye className="h-5 w-5 text-[#333]" />
          </div>
        )}
      </a>

      {/* Info — right */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Title */}
        <h4 className="text-[13px] font-medium leading-snug text-white line-clamp-2 mb-1.5">
          {video.title}
        </h4>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-[#555]" />
            <span className="font-medium text-[#A1A1AA]">{formatViewCount(video.viewCount)}</span>
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-[#555]" />
            <span className="font-medium text-[#A1A1AA]">{formatViewCount(video.likeCount ?? 0)}</span>
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3 text-[#555]" />
            <span className="font-medium text-[#A1A1AA]">{formatViewCount(video.commentCount ?? 0)}</span>
          </span>
        </div>

        {/* Sparkline + percent badge */}
        <div className="relative mt-auto pt-1.5">
          <div className="pr-[68px]">
            <SparklineChart dataPoints={dataPoints} trend={trend} />
          </div>
          <div className="absolute right-0 top-[8px] w-[60px] flex items-center justify-center">
          {(() => {
            if (dataPoints.length < 2) return null;
            const percentChange = calculatePercentChange(dataPoints);
            const formatted = formatPercentChange(percentChange);

            if (percentChange >= 1) {
              return (
                <span className="text-[11px] font-semibold text-accent bg-accent-muted px-1.5 py-0.5 rounded">
                  {formatted}
                </span>
              );
            }
            if (percentChange <= -1) {
              return (
                <span className="text-[11px] font-semibold text-[#64748B] bg-[rgba(100,116,139,0.1)] px-1.5 py-0.5 rounded">
                  {formatted}
                </span>
              );
            }
            return (
              <span className="text-[11px] font-semibold text-[#555] bg-[rgba(85,85,85,0.1)] px-1.5 py-0.5 rounded">
                {formatted}
              </span>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}
