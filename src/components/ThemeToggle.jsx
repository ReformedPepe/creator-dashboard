// ThemeToggle — przycisk przełączania motywu (light → dark → system)
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, cyclePreference } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { preference, activeTheme, setPreference } = useTheme();

  const handleClick = () => {
    setPreference(cyclePreference(preference));
  };

  // Determine which icon to display
  let Icon;
  if (preference === 'system') {
    Icon = Monitor;
  } else if (activeTheme === 'dark') {
    Icon = Moon;
  } else {
    Icon = Sun;
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-button)] bg-white/60 dark:bg-white/10 text-text-muted shadow-sm transition-all duration-200 hover:bg-white/80 dark:hover:bg-white/20 hover:text-text-primary hover:shadow-md active:scale-[0.95] cursor-pointer"
      title="Zmień motyw"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
