// Topbar — breadcrumb + tabs + actions (Kit/Automation style)
import { RefreshCw, Plus } from 'lucide-react';

export default function Topbar({ title, onRefresh, onAddChannel, isRefreshing, tabs, activeTab, onTabChange }) {
  return (
    <div className="mb-6 space-y-4">
      {/* Breadcrumb row */}
      <div className="flex items-center justify-between min-h-[28px]">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-white leading-[28px]">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <div className="relative group">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#222] bg-transparent text-xs text-[#777] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Odśwież</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-56 px-3 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[11px] text-[#999] opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                Odświeża dane YouTube. TikTok aktualizuje się automatycznie co 6 godzin.
              </div>
            </div>
          )}

          {onAddChannel && (
            <button
              onClick={onAddChannel}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent text-xs font-medium text-white hover:bg-accent-light transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dodaj kanał</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs row */}
      {tabs && tabs.length > 0 && (
        <div className="flex items-center gap-1 bg-[#111] rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#1E1E1E] text-white'
                  : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
