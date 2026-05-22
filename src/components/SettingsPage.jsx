// SettingsPage — strona ustawień (klucze API + konto)
// Layout identyczny z Dashboard: te same klasy, marginesy, paddingi
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, Loader2, Key, User, Trash2, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import {
  getStoredYouTubeKey,
  getStoredTikTokKey,
  saveYouTubeApiKey,
  saveTikTokApiKey,
  validateYouTubeKey,
  validateTikTokKey,
} from '../utils/apiKeys';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [backendKeyStatus, setBackendKeyStatus] = useState(null);
  const [youtubeEditing, setYoutubeEditing] = useState(false);
  const [tiktokEditing, setTiktokEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchKeyStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await axios.get(`${BACKEND_URL}/api/settings/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setBackendKeyStatus(res.data);
    } catch {}
  };

  useEffect(() => {
    const localYt = getStoredYouTubeKey();
    const localTt = getStoredTikTokKey();
    if (localYt) setYoutubeKey(localYt);
    if (localTt) setTiktokKey(localTt);
    fetchKeyStatus();
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
      await fetchKeyStatus();
      setYoutubeEditing(false);
      setTiktokEditing(false);
    } catch (err) {
      console.error('Błąd walidacji kluczy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Keys Section — same structure as YouTube/TikTok sections on Dashboard */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Key className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">Klucze API</span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-5">
          {/* YouTube */}
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              YouTube Data API v3
            </label>
            <div className="relative">
              <input
                type={showYoutubeKey ? 'text' : 'password'}
                value={youtubeEditing ? youtubeKey : (youtubeKey || backendKeyStatus?.youtubeMasked || '')}
                onChange={(e) => { setYoutubeKey(e.target.value); setYoutubeStatus('idle'); }}
                onFocus={() => {
                  if (!youtubeEditing && !youtubeKey && backendKeyStatus?.youtubeMasked) {
                    setYoutubeKey('');
                  }
                  setYoutubeEditing(true);
                }}
                placeholder="AIza..."
                className={`w-full rounded-lg border bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-white placeholder:text-[#555] outline-none transition-colors focus:border-accent font-mono ${
                  youtubeStatus === 'error' ? 'border-red-500' : youtubeStatus === 'success' ? 'border-green-500' : 'border-[#1E1E1E]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#555] hover:text-white cursor-pointer"
              >
                {showYoutubeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {youtubeStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3 w-3" /> Zweryfikowany
              </p>
            )}
            {youtubeStatus === 'error' && <p className="mt-1 text-xs text-red-400">{youtubeError}</p>}
            {youtubeStatus === 'idle' && !youtubeKey && backendKeyStatus?.youtubeKeySet && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3 w-3" /> Klucz zapisany na serwerze
              </p>
            )}
            <details className="mt-3">
              <summary className="text-[11px] text-[#666] cursor-pointer hover:text-[#999] transition-colors">
                Jak uzyskać klucz YouTube API? ↓
              </summary>
              <ol className="mt-2 ml-3 space-y-1 text-[11px] text-[#555] list-decimal list-outside">
                <li>Wejdź na <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">console.cloud.google.com</a></li>
                <li>Utwórz nowy projekt</li>
                <li>Włącz „YouTube Data API v3" w bibliotece API</li>
                <li>Przejdź do „Dane logowania" → „Utwórz dane logowania" → „Klucz API"</li>
                <li>Skopiuj wygenerowany klucz</li>
              </ol>
            </details>
          </div>

          {/* TikTok */}
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
              TikTok RapidAPI
            </label>
            <div className="relative">
              <input
                type={showTiktokKey ? 'text' : 'password'}
                value={tiktokEditing ? tiktokKey : (tiktokKey || backendKeyStatus?.tiktokMasked || '')}
                onChange={(e) => { setTiktokKey(e.target.value); setTiktokStatus('idle'); }}
                onFocus={() => {
                  if (!tiktokEditing && !tiktokKey && backendKeyStatus?.tiktokMasked) {
                    setTiktokKey('');
                  }
                  setTiktokEditing(true);
                }}
                placeholder="xxxxxxxx..."
                className={`w-full rounded-lg border bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-white placeholder:text-[#555] outline-none transition-colors focus:border-accent font-mono ${
                  tiktokStatus === 'error' ? 'border-red-500' : tiktokStatus === 'success' ? 'border-green-500' : 'border-[#1E1E1E]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowTiktokKey(!showTiktokKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#555] hover:text-white cursor-pointer"
              >
                {showTiktokKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tiktokStatus === 'success' && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3 w-3" /> Zweryfikowany
              </p>
            )}
            {tiktokStatus === 'error' && <p className="mt-1 text-xs text-red-400">{tiktokError}</p>}
            {tiktokStatus === 'idle' && !tiktokKey && backendKeyStatus?.tiktokKeySet && (
              <p className="mt-1 flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3 w-3" /> Klucz zapisany na serwerze
              </p>
            )}
            <details className="mt-3">
              <summary className="text-[11px] text-[#666] cursor-pointer hover:text-[#999] transition-colors">
                Jak uzyskać klucz TikTok RapidAPI? ↓
              </summary>
              <ol className="mt-2 ml-3 space-y-1 text-[11px] text-[#555] list-decimal list-outside">
                <li>Zarejestruj się na <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">rapidapi.com</a></li>
                <li>Wyszukaj „TikTok Scraper" (tiktok-scraper7)</li>
                <li>Wybierz darmowy plan Basic (300 req/miesiąc)</li>
                <li>Skopiuj klucz z zakładki „Header Parameters" → „X-RapidAPI-Key"</li>
              </ol>
            </details>
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

      {/* Account Section */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">Konto</span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-4">
          <div>
            <p className="text-xs text-[#888] mb-1">Email</p>
            <p className="text-sm text-white">{user?.email || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#1E1E1E] text-sm font-medium text-[#A1A1AA] hover:bg-[#1C1C1C] transition-colors cursor-pointer"
            >
              Wyloguj
            </button>
          </div>

          {/* Delete account */}
          <div className="pt-4 border-t border-[#1E1E1E]">
            <p className="text-xs text-[#666] mb-3">
              Usunięcie konta jest nieodwracalne. Wszystkie kanały, filmy, snapshoty i klucze API zostaną trwale usunięte.
            </p>
            <button
              onClick={() => { setDeleteConfirm(true); setDeleteInput(''); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Usuń konto
            </button>
          </div>
        </div>
      </section>

      {/* Delete account modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 modal-backdrop" onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }} />
          <div className="relative w-full max-w-sm rounded-[16px] border border-[#222222] bg-[#111111] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Usunięcie konta</h3>
            </div>
            <p className="text-sm text-[#A1A1AA] mb-2">
              Ta operacja jest <span className="text-red-400 font-medium">nieodwracalna</span>. Zostaną usunięte:
            </p>
            <ul className="text-xs text-[#888] mb-4 space-y-1 ml-4 list-disc">
              <li>Wszystkie kanały i filmy</li>
              <li>Historia wyświetleń (snapshoty)</li>
              <li>Klucze API</li>
              <li>Konto użytkownika</li>
            </ul>
            <p className="text-xs text-[#A1A1AA] mb-2">
              Wpisz <span className="font-mono font-bold text-white">USUŃ</span> aby potwierdzić:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="USUŃ"
              className="w-full rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none focus:border-red-500 transition-colors mb-4"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) return;
                    await axios.delete(`${BACKEND_URL}/api/account`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    await supabase.auth.signOut();
                    window.location.reload();
                  } catch (err) {
                    console.error('Błąd usuwania konta:', err);
                    setIsDeleting(false);
                  }
                }}
                disabled={deleteInput !== 'USUŃ' || isDeleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isDeleting ? 'Usuwanie...' : 'Usuń konto na zawsze'}
              </button>
              <button
                onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-lg border border-[#1E1E1E] text-sm font-medium text-[#A1A1AA] hover:bg-[#1C1C1C] transition-colors cursor-pointer"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
