// ApiUsageCounter — badge wyświetlający liczbę pozostałych zapytań do TikTok API
import { useApiUsage } from '../hooks/useApiUsage';

export default function ApiUsageCounter() {
  const { remaining, limit, loading } = useApiUsage();

  if (loading) return null;

  // Determine visual state based on remaining requests
  const getStyle = () => {
    if (remaining === null) return 'text-text-secondary bg-bg-card shadow-[var(--shadow-card)]';
    if (remaining <= 10) return 'text-red-600 bg-red-50/80';
    if (remaining <= 50) return 'text-amber-600 bg-amber-50/80';
    return 'text-text-secondary bg-bg-card shadow-[var(--shadow-card)]';
  };

  const displayValue = remaining !== null ? remaining : '—';

  return (
    <div className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium ${getStyle()}`}>
      <span>API TikTok: </span>
      <span className="font-bold">{displayValue} / {limit}</span>
    </div>
  );
}
