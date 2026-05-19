// SettingsPanel — modal do zarządzania kluczami API
import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import {
  getStoredYouTubeKey,
  getStoredTikTokKey,
  saveYouTubeApiKey,
  saveTikTokApiKey,
  validateYouTubeKey,
  validateTikTokKey,
} from '../utils/apiKeys';

export default function SettingsPanel({ isOpen, onClose, onKeysSaved }) {
  const [youtubeKey, setYoutubeKey] = useState('');
  const [tiktokKey, setTiktokKey] = useState('');
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [showTiktokKey, setShowTiktokKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [tiktokStatus, setTiktokStatus] = useState('idle');
  const [youtubeError, setYoutubeError] = useState('');
  const [tiktokError, setTiktokError] = useState('');

  // Pre-fill inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setYoutubeKey(getStoredYouTubeKey());
      setTiktokKey(getStoredTikTokKey());
      setShowYoutubeKey(false);
      setShowTiktokKey(false);
      setYoutubeStatus('idle');
      setTiktokStatus('idle');
      setYoutubeError('');
      setTiktokError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsLoading(true);
    setYoutubeStatus('idle');
    setTiktokStatus('idle');
    setYoutubeError('');
    setTiktokError('');

    const ytTrimmed = youtubeKey.trim();
    const ttTrimmed = tiktokKey.trim();

    // Build validation promises
    const validations = [];

    if (ytTrimmed.length > 0) {
      validations.push(
        validateYouTubeKey(ytTrimmed).then((result) => ({ service: 'youtube', result }))
      );
    } else {
      // Empty field — remove key from localStorage
      saveYouTubeApiKey('');
      setYoutubeStatus('idle');
      validations.push(Promise.resolve({ service: 'youtube', result: { valid: true, skipped: true } }));
    }

    if (ttTrimmed.length > 0) {
      validations.push(
        validateTikTokKey(ttTrimmed).then((result) => ({ service: 'tiktok', result }))
      );
    } else {
      // Empty field — remove key from localStorage
      saveTikTokApiKey('');
      setTiktokStatus('idle');
      validations.push(Promise.resolve({ service: 'tiktok', result: { valid: true, skipped: true } }));
    }

    try {
      const results = await Promise.all(validations);

      for (const { service, result } of results) {
        if (service === 'youtube') {
          if (result.skipped) {
            // Already handled above
          } else if (result.valid) {
            saveYouTubeApiKey(ytTrimmed);
            setYoutubeStatus('success');
          } else {
            setYoutubeStatus('error');
            setYoutubeError(result.error || 'Klucz jest nieprawidłowy.');
          }
        } else if (service === 'tiktok') {
          if (result.skipped) {
            // Already handled above
          } else if (result.valid) {
            saveTikTokApiKey(ttTrimmed);
            setTiktokStatus('success');
          } else {
            setTiktokStatus('error');
            setTiktokError(result.error || 'Klucz jest nieprawidłowy.');
          }
        }
      }

      // Sync keys to backend if callback provided
      if (onKeysSaved) {
        onKeysSaved();
      }
    } catch (err) {
      console.error('Błąd walidacji kluczy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-bg-card p-6 shadow-[var(--shadow-modal)] animate-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-page hover:text-text-primary cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <h2 className="mb-6 text-lg font-bold text-text-primary">
          Ustawienia kluczy API
        </h2>

        <div className="space-y-5">
          {/* YouTube API Key */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Klucz YouTube API
            </label>
            <div className="relative">
              <input
                type={showYoutubeKey ? 'text' : 'password'}
                value={youtubeKey}
                onChange={(e) => {
                  setYoutubeKey(e.target.value);
                  setYoutubeStatus('idle');
                  setYoutubeError('');
                }}
                placeholder="AIza..."
                className={`w-full rounded-[var(--radius-input)] border bg-bg-page px-4 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/10 font-mono ${
                  youtubeStatus === 'error'
                    ? 'border-error'
                    : youtubeStatus === 'success'
                    ? 'border-green-400'
                    : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                aria-label={showYoutubeKey ? 'Ukryj klucz' : 'Pokaż klucz'}
              >
                {showYoutubeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {youtubeStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                Klucz zapisany i zweryfikowany
              </p>
            )}
            {youtubeStatus === 'error' && (
              <p className="mt-1 text-xs text-error">
                {youtubeError}
              </p>
            )}
            {youtubeStatus === 'idle' && (
              <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                <span className="font-medium">Jak uzyskać:</span> Wejdź na{' '}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">console.cloud.google.com</a>
                {' → '}Utwórz projekt → Włącz "YouTube Data API v3" → Dane logowania → Utwórz klucz API
              </p>
            )}
          </div>

          {/* TikTok RapidAPI Key */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Klucz TikTok RapidAPI
            </label>
            <div className="relative">
              <input
                type={showTiktokKey ? 'text' : 'password'}
                value={tiktokKey}
                onChange={(e) => {
                  setTiktokKey(e.target.value);
                  setTiktokStatus('idle');
                  setTiktokError('');
                }}
                placeholder="xxxxxxxx..."
                className={`w-full rounded-[var(--radius-input)] border bg-bg-page px-4 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/10 font-mono ${
                  tiktokStatus === 'error'
                    ? 'border-error'
                    : tiktokStatus === 'success'
                    ? 'border-green-400'
                    : 'border-gray-200'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowTiktokKey(!showTiktokKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                aria-label={showTiktokKey ? 'Ukryj klucz' : 'Pokaż klucz'}
              >
                {showTiktokKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tiktokStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                <Check className="h-3 w-3" />
                Klucz zapisany i zweryfikowany
              </p>
            )}
            {tiktokStatus === 'error' && (
              <p className="mt-1 text-xs text-error">
                {tiktokError}
              </p>
            )}
            {tiktokStatus === 'idle' && (
              <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
                <span className="font-medium">Jak uzyskać:</span> Wejdź na{' '}
                <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" rel="noopener noreferrer" className="underline hover:text-text-secondary">rapidapi.com</a>
                {' → '}Załóż konto (darmowe) → Subskrybuj plan "Basic" (0$) → Skopiuj klucz z "X-RapidAPI-Key"
              </p>
            )}
          </div>

          {/* Save button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="w-full rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Weryfikacja...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
