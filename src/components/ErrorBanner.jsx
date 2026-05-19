// ErrorBanner — komunikat błędu z informacją o ostatnich danych
import { AlertCircle, Clock } from 'lucide-react';
import { formatTimestamp } from '../utils/formatters';

export default function ErrorBanner({ message, hasCache, lastFetchedAt }) {
  return (
    <div className="mb-3 rounded-[var(--radius-input)] border border-warning/20 bg-warning-bg px-3.5 py-2.5">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-warning">
            Nie udało się pobrać nowych danych
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted leading-relaxed truncate">
            {message}
          </p>
          {hasCache && lastFetchedAt && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
              <Clock className="h-2.5 w-2.5" />
              <span>Pokazuję dane z {formatTimestamp(lastFetchedAt)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
