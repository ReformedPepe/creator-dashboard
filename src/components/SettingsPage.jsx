// SettingsPage — strona ustawień (klucze API + konto)
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Loader2, Key, User } from 'lucide-react';
import {
  getStoredYouTubeKey,
  getStoredTikTokKey,
  saveYouTubeApiKey,
  saveTikTokApiKey,
  validateYouTubeKey,
  validateTikTokKey,
} from '../utils/apiKeys';

export default function SettingsPage({ onKeysSaved, user, onSignOut }) {
  const [youtubeKey, setYoutubeKey] = useState('');
  const [tiktokKey, setTiktokKey] = useState('');
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [showTiktokKey, setShowTiktokKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [youtubeStatus, setYoutubeStatus] = useState('idle');
  const [tiktokStatus, setTiktokStatus] = useState('idle');
  const [youtubeError, setYoutubeError] = useState('');
  const [tiktokError, setTiktokError] = useState('');

  useEffect(() => {
    setYoutubeKey(getStoredYouTubeKey());
    setTiktokKey(getStoredTikTokKey());
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setYoutubeStatus('idle');
    setTiktokStatus('idle');
    setYoutubeError('');
    setTiktokError('');

    const ytTrimmed = youtubeKey.trim();
    const ttTrimmed = tiktokKey.trim();

    const validations = [];

    if (ytTrimmed.length > 0) {
      validations.push(validateYouTubeKey(ytTrimmed).then(r => ({ service: 'youtube', result: r })));
    } else {
      saveYouTubeApiKey('');
      validations.push(Promise.resolve({ service: 'youtube', result: { valid: true, skipped: true } }));
    }

    if (ttTrimmed.length > 0) {
      validations.push(validateTikTokKey(ttTrimmed).then(r => ({ service: 'tiktok', result: r })));
    } else {
      saveTikTokApiKey('');
      validations.push(Promise.resolve({ service: 'tiktok', result: { valid: true, skipped: true } }));
    }

    try {
      const results = await Promise.all(validations);

      for (const { service, result } of results) {
        if (service === 'youtube') {
          if (!result.skipped && result.valid) {
            saveYouTubeApiKey(ytTrimmed);
            setYoutubeStatus('success');
          } else if (!result.skipped) {
            setYoutubeStatus('error');
            setYoutubeError(result.error || 'Klucz jest nieprawidłowy.');
          }
        } else if (service === 'tiktok') {
          if (!result.skipped && result.valid) {
            saveTikTokApiKey(ttTrimmed);
            setTiktokStatus('success');
          } else if (!result.skipped) {
            setTiktokStatus('error');
            setTiktokError(result.error || 'Klucz jest nieprawidłowy.');
          }
        }
      }

      if (onKeysSaved) onKeysSaved();
    } catch (err) {
      console.error('Błąd walidacji kluczy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* API Keys Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold tracking-widest uppercase text-text-muted">
            Klucze API
          </h2>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-6 space-y-5">
          {/* YouTube */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              YouTube Data API v3
            </label>
            <div className="relative">
              <input
                type={showYoutubeKey ? 'text' : 'password'}
                value={youtubeKey}
                onChange={(e) => { setYoutubeKey(e.target.value); setYoutubeStatus('idle'); }}
                placeholder="AIza..."
                className={`w-full rounded-lg border bg-bg-card-inner px-4 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent font-mono ${
                  youtubeStatus === 'error' ? 'border-error' : youtubeStatus === 'success' ? 'border-success' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary cursor-pointer"
              >
                {showYoutubeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {youtubeStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-success">
                <Check className="h-3 w-3" /> Zweryfikowany
              </p>
            )}
            {youtubeStatus === 'error' && <p className="mt-1 text-xs text-error">{youtubeError}</p>}
          </div>

          {/* TikTok */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              TikTok RapidAPI
            </label>
            <div className="relative">
              <input
                type={showTiktokKey ? 'text' : 'password'}
                value={tiktokKey}
                onChange={(e) => { setTiktokKey(e.target.value); setTiktokStatus('idle'); }}
                placeholder="xxxxxxxx..."
                className={`w-full rounded-lg border bg-bg-card-inner px-4 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent font-mono ${
                  tiktokStatus === 'error' ? 'border-error' : tiktokStatus === 'success' ? 'border-success' : 'border-border'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowTiktokKey(!showTiktokKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary cursor-pointer"
              >
                {showTiktokKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tiktokStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-success">
                <Check className="h-3 w-3" /> Zweryfikowany
              </p>
            )}
            {tiktokStatus === 'error' && <p className="mt-1 text-xs text-error">{tiktokError}</p>}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Weryfikacja...' : 'Zapisz klucze'}
          </button>
        </div>
      </section>

      {/* Account Section — placeholder */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-accent" />
          <h2 className="text-xs font-semibold tracking-widest uppercase text-text-muted">
            Konto
          </h2>
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-6 space-y-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Email</p>
            <p className="text-sm text-text-primary">{user?.email || '—'}</p>
          </div>
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-[#1C1C1C] transition-colors cursor-pointer"
          >
            Wyloguj
          </button>
        </div>
      </section>
    </div>
  );
}
