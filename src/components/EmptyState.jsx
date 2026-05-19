// EmptyState — pusty stan gdy brak kanałów
import { MonitorPlay, Plus } from 'lucide-react';

export default function EmptyState({ onAddChannel }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="relative mb-6">
        {/* Decorative rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-28 rounded-full bg-gradient-to-br from-accent-pink/10 to-accent-purple/10 animate-pulse" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-accent-pink/15 to-accent-purple/15" />
        </div>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent-pink to-accent-purple shadow-lg">
          <MonitorPlay className="h-7 w-7 text-white" />
        </div>
      </div>

      <h2 className="mb-2 text-xl font-bold text-text-primary">
        Nie masz jeszcze żadnych kanałów
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-text-secondary leading-relaxed">
        Dodaj swoje kanały YouTube i TikTok, aby śledzić wyświetlenia
        ostatnich filmów w jednym miejscu.
      </p>

      <button
        onClick={onAddChannel}
        className="inline-flex items-center gap-2 rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Dodaj pierwszy kanał
      </button>
    </div>
  );
}
