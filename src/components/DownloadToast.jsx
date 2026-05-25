// DownloadToast — fixed bottom-right widget showing active download progress.
// Rendered in App.jsx always (regardless of current view).
// Click anywhere on the widget (except cancel X) navigates back to the source tool.
import { X, Loader2, Check } from 'lucide-react';

export default function DownloadToast({ download, onCancel, onClick }) {
  if (!download) return null;

  const { filename, progress, phase, error, done } = download;
  const shortName = filename && filename.length > 30
    ? filename.slice(0, 27) + '...'
    : filename || 'Pobieranie...';

  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[#1E1E1E] bg-[#111111] shadow-2xl p-4 space-y-2 animate-[fadeScale_200ms_ease-out] ${
        isClickable ? 'cursor-pointer hover:border-[#2A2A2A] hover:bg-[#141414] transition-colors duration-200' : ''
      }`}
      title={isClickable ? 'Wróć do narzędzia' : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {done ? (
            <Check className="h-4 w-4 text-green-400 shrink-0" />
          ) : error ? (
            <X className="h-4 w-4 text-red-400 shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 text-[#E53935] animate-spin shrink-0" />
          )}
          <span className="text-xs text-white truncate">{shortName}</span>
        </div>
        {!done && !error && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel?.(); }}
            className="p-1 rounded-md hover:bg-[#1C1C1C] text-[#555] hover:text-white transition-colors cursor-pointer shrink-0"
            title="Anuluj"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!done && !error && (
        <div className="w-full h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
          {progress > 0 ? (
            <div
              className="h-full rounded-full bg-[#E53935] transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div className="h-full w-1/3 rounded-full bg-[#E53935] animate-progress-indeterminate" />
          )}
        </div>
      )}

      <p className="text-[10px] text-[#888]">
        {done && 'Pobrano ✓'}
        {error && `Błąd: ${error}`}
        {!done && !error && phase === 'extracting' && 'Przygotowywanie...'}
        {!done && !error && phase === 'server-download' && `Pobieranie z serwera — ${progress}%`}
        {!done && !error && phase === 'transferring' && `Pobieranie — ${progress}%`}
        {!done && !error && phase === 'preparing' && 'Łączenie...'}
      </p>
    </div>
  );
}
