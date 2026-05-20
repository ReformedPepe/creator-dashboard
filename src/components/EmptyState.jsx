// EmptyState — pusty stan gdy brak kanałów
import { MonitorPlay, Plus } from 'lucide-react';

export default function EmptyState({ onAddChannel }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-accent-muted mb-5">
        <MonitorPlay className="h-7 w-7 text-accent-light" />
      </div>

      <h2 className="mb-2 text-lg font-bold text-text-primary">
        Nie masz jeszcze żadnych kanałów
      </h2>
      <p className="mb-6 max-w-md text-center text-sm text-text-muted leading-relaxed">
        Dodaj swoje kanały YouTube i TikTok, aby śledzić wyświetlenia ostatnich filmów.
      </p>

      <button
        onClick={onAddChannel}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-light transition-colors cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Dodaj pierwszy kanał
      </button>
    </div>
  );
}
