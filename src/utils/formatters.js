// Formatowanie liczb i dat

/**
 * Formatuje liczbę wyświetleń w czytelny sposób
 * 1234 → "1,2K"
 * 45300 → "45,3K"
 * 1234567 → "1,2M"
 * 1234567890 → "1,2B"
 */
export function formatViewCount(count) {
  if (count == null || isNaN(count)) return '—';
  
  const num = typeof count === 'string' ? parseInt(count, 10) : count;
  
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace('.', ',') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace('.', ',') + 'K';
  }
  return num.toLocaleString('pl-PL');
}

/**
 * Formatuje datę jako relatywną (np. "2 dni temu", "3 godz. temu")
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffSec < 60) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  if (diffHour < 24) return `${diffHour} godz. temu`;
  if (diffDay === 1) return 'wczoraj';
  if (diffDay < 7) return `${diffDay} dni temu`;
  if (diffWeek < 4) return `${diffWeek} tyg. temu`;
  if (diffMonth < 12) return `${diffMonth} mies. temu`;
  return `${diffYear} lat temu`;
}

/**
 * Formatuje timestamp jako pełną datę i godzinę
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '—';
  
  const date = new Date(timestamp);
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatuje countdown w sekundach jako mm:ss
 */
export function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) return '00:00';
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Generuje unikalne ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Formatuje czas, który upłynął od podanego timestampu
 * null/undefined → "nigdy"
 * < 60 sekund → "przed chwilą"
 * 1–59 minut → "X min temu"
 * 60+ minut → "X godz. temu"
 */
export function formatElapsedTime(timestamp) {
  if (timestamp == null) return 'nigdy';

  const now = Date.now();
  const elapsedMs = now - timestamp;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));

  if (elapsedSeconds < 60) return 'przed chwilą';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min temu`;
  return `${elapsedHours} godz. temu`;
}

/**
 * Formatuje wartość procentową w polskim formacie.
 * @param {number} value — wartość procentowa (np. 12.34)
 * @returns {string} — sformatowany string (np. "+12,3%", "-3,1%", "0%")
 */
export function formatPercentChange(value) {
  // Handle NaN, Infinity
  if (!isFinite(value) || isNaN(value)) return '0%';

  const rounded = Math.round(value * 10) / 10;

  if (Math.abs(rounded) < 1) {
    return '0%';
  }

  const formatted = Math.abs(rounded).toFixed(1).replace('.', ',');

  // Remove ",0" if value is whole number
  const display = formatted.endsWith(',0')
    ? formatted.slice(0, -2)
    : formatted;

  if (rounded > 0) return `+${display}%`;
  if (rounded < 0) return `-${display}%`;
  return '0%';
}
