// VideoCard — karta filmu (miniaturka po lewej 120px, metryki po prawej)
import { Eye, ThumbsUp, MessageCircle } from 'lucide-react';
import { formatViewCount, formatPercentChange } from '../utils/formatters';
import { calculatePercentChange } from '../utils/trendCalculator';
import { useViewHistory } from '../hooks/useViewHistory';
import SparklineChart from './SparklineChart';

export default function VideoCard({ video, timeRangeMs = Infinity }) {
  const { dataPoints: allDataPoints, trend } = useViewHistory(video.id || video.videoId);

  const now = Date.now();
  const dataPoints = timeRangeMs === Infinity
    ? allDataPoints
    : allDataPoints.filter(dp => dp.timestamp >= now - timeRangeMs);

  return (
    <div className="flex gap-3 rounded-lg bg-[#0F0F0F] border border-[#1A1A1A] p-3">
      {/* Thumbnail — left, 120px wide, 16:9 */}
      <div className="relative w-[120px] shrink-0 overflow-hidden rounded-md aspect-video">
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
      </div>

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
        <div className="flex items-center mt-auto pt-1.5">
          <div className="flex-1">
            <SparklineChart dataPoints={dataPoints} trend={trend} />
          </div>
          {(() => {
            if (dataPoints.length < 2) return null;
            const percentChange = calculatePercentChange(dataPoints);
            const formatted = formatPercentChange(percentChange);

            if (percentChange >= 1) {
              return (
                <span className="text-[11px] font-semibold text-accent bg-accent-muted px-1.5 py-0.5 rounded shrink-0">
                  {formatted}
                </span>
              );
            }
            if (percentChange <= -1) {
              return (
                <span className="text-[11px] font-semibold text-[#64748B] bg-[rgba(100,116,139,0.1)] px-1.5 py-0.5 rounded shrink-0">
                  {formatted}
                </span>
              );
            }
            return (
              <span className="text-[11px] font-semibold text-[#555] px-1.5 py-0.5 shrink-0">
                {formatted}
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
