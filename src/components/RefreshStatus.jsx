// RefreshStatus — elapsed time display, TikTok cooldown info, manual refresh button
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatElapsedTime } from '../utils/formatters';

export default function RefreshStatus({
  lastRefreshAt,
  isRefreshing,
  onManualRefresh,
  tiktokCooldownMinutes,
  isBackendAvailable,
}) {
  const [elapsedText, setElapsedText] = useState(() => formatElapsedTime(lastRefreshAt));

  // Update elapsed time display every 60 seconds
  useEffect(() => {
    setElapsedText(formatElapsedTime(lastRefreshAt));

    const interval = setInterval(() => {
      setElapsedText(formatElapsedTime(lastRefreshAt));
    }, 60_000);

    return () => clearInterval(interval);
  }, [lastRefreshAt]);

  return (
    <div className="flex items-center gap-2">
      {/* Elapsed time since last refresh */}
      <div className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-bg-card px-3 py-1.5 text-xs text-text-secondary shadow-[var(--shadow-card)]">
        <span>Ostatnio: {elapsedText}</span>
      </div>

      {/* TikTok cooldown message — hidden when backend manages the schedule */}
      {!isBackendAvailable && tiktokCooldownMinutes > 0 && (
        <div className="flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-bg-card px-3 py-1.5 text-xs text-text-secondary shadow-[var(--shadow-card)]">
          <span>TikTok: odśwież za {tiktokCooldownMinutes >= 60 ? `${Math.ceil(tiktokCooldownMinutes / 60)}h` : `${tiktokCooldownMinutes} min`}</span>
        </div>
      )}

      {/* Manual refresh button */}
      <button
        onClick={onManualRefresh}
        disabled={isRefreshing}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-button)] bg-bg-card text-text-secondary shadow-[var(--shadow-card)] transition-all duration-200 hover:bg-bg-card-hover hover:text-text-primary disabled:opacity-50 cursor-pointer"
        title="Odśwież teraz"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
