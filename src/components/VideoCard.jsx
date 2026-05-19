// VideoCard — karta pojedynczego filmu
import { Eye, Calendar, ExternalLink, ThumbsUp, MessageCircle } from 'lucide-react';
import { formatViewCount, formatRelativeDate, formatPercentChange } from '../utils/formatters';
import { calculatePercentChange } from '../utils/trendCalculator';
import { useViewHistory } from '../hooks/useViewHistory';
import SparklineChart from './SparklineChart';

export default function VideoCard({ video, timeRangeMs = Infinity }) {
  const { dataPoints: allDataPoints, trend } = useViewHistory(video.id || video.videoId);
  
  // Filter data points to selected time range
  const now = Date.now();
  const dataPoints = timeRangeMs === Infinity
    ? allDataPoints
    : allDataPoints.filter(dp => dp.timestamp >= now - timeRangeMs);
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-[var(--radius-video)] bg-bg-page transition-all duration-300 hover:shadow-[var(--shadow-card-hover)] hover:scale-[1.02]"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Eye className="h-8 w-8 text-text-muted/30" />
          </div>
        )}
        
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/20">
          <ExternalLink className="h-5 w-5 text-white opacity-0 transition-all duration-300 group-hover:opacity-100 transform scale-50 group-hover:scale-100" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        {/* Title */}
        <h4 className="mb-2 text-[13px] font-semibold leading-snug text-text-primary line-clamp-2 group-hover:text-accent-purple transition-colors duration-200">
          {video.title}
        </h4>

        {/* Stats */}
        <div className="flex items-center gap-3">
          {/* Views */}
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-text-muted" />
            <span className="text-xs font-semibold text-text-secondary">
              {formatViewCount(video.viewCount)}
            </span>
          </div>

          {/* Likes */}
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-text-muted" />
            <span className="text-xs font-semibold text-text-secondary">
              {formatViewCount(video.likeCount ?? 0)}
            </span>
          </div>

          {/* Comments */}
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3 text-text-muted" />
            <span className="text-xs font-semibold text-text-secondary">
              {formatViewCount(video.commentCount ?? 0)}
            </span>
          </div>

          {/* Date */}
          {video.publishedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-text-muted" />
              <span className="text-xs text-text-muted">
                {formatRelativeDate(video.publishedAt)}
              </span>
            </div>
          )}
        </div>

        {/* Sparkline trend chart + percent change badge */}
        <div className="flex items-center mt-auto">
          <div className="flex-1">
            <SparklineChart dataPoints={dataPoints} trend={trend} />
          </div>
          {(() => {
            if (dataPoints.length < 2) return null;
            
            const percentChange = calculatePercentChange(dataPoints);
            const formatted = formatPercentChange(percentChange);
            
            const colorClass = percentChange >= 1
              ? 'text-[var(--color-trend-up)]'
              : percentChange <= -1
                ? 'text-[var(--color-trend-down)]'
                : 'text-[var(--color-trend-neutral)]';
            return (
              <span className={`text-[11px] font-semibold ${colorClass} w-14 text-right shrink-0`}>
                {formatted}
              </span>
            );
          })()}
        </div>
      </div>
    </a>
  );
}
