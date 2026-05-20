// Topbar — tytuł strony + akcje (brak osobnego tła, wtapia się w stronę)
import { RefreshCw, Plus } from 'lucide-react';

export default function Topbar({ title, onRefresh, onAddChannel, isRefreshing }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-button)] border border-[#2A2A2A] bg-transparent text-sm text-[#888] hover:text-white hover:border-[#3A3A3A] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Odśwież</span>
          </button>
        )}

        {onAddChannel && (
          <button
            onClick={onAddChannel}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-button)] bg-accent text-sm font-medium text-white hover:bg-accent-light transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dodaj kanał</span>
          </button>
        )}
      </div>
    </div>
  );
}
