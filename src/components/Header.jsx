// Header — nagłówek aplikacji z nazwą, przyciskiem dodawania i statusem odświeżania
import { Plus, BarChart3, Settings } from 'lucide-react';
import RefreshStatus from './RefreshStatus';
import ApiUsageCounter from './ApiUsageCounter';
import ThemeToggle from './ThemeToggle';

export default function Header({
  onAddChannel,
  onOpenSettings,
  lastRefreshAt,
  isRefreshing,
  onManualRefresh,
  tiktokCooldownMinutes,
  isBackendAvailable,
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple shadow-sm">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Creator Stats
            </h1>
            <p className="text-xs text-text-muted font-medium">
              Dashboard wyświetleń
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <RefreshStatus
            lastRefreshAt={lastRefreshAt}
            isRefreshing={isRefreshing}
            onManualRefresh={onManualRefresh}
            tiktokCooldownMinutes={tiktokCooldownMinutes}
            isBackendAvailable={isBackendAvailable}
          />

          <ApiUsageCounter />

          <button
            onClick={onOpenSettings}
            className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-button)] bg-white/60 text-text-muted shadow-sm transition-all duration-200 hover:bg-white/80 hover:text-text-primary hover:shadow-md active:scale-[0.95] cursor-pointer"
            title="Ustawienia"
          >
            <Settings className="h-4 w-4" />
          </button>

          <ThemeToggle />

          <button
            onClick={onAddChannel}
            className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Dodaj kanał
          </button>
        </div>
      </div>
    </header>
  );
}
