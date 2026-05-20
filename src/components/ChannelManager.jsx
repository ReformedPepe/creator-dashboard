// ChannelManager — modal do dodawania, edycji, usuwania kanałów
import { useState, useEffect } from 'react';
import { X, Play, Music, Trash2, AlertTriangle } from 'lucide-react';
import { isValidTikTokUrl } from '../utils/tiktok';

export default function ChannelManager({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete, 
  editingChannel 
}) {
  const [type, setType] = useState('youtube');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [mode, setMode] = useState('auto');
  const [videoUrls, setVideoUrls] = useState(['', '', '']);
  const [urlErrors, setUrlErrors] = useState(['', '', '']);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!editingChannel;

  useEffect(() => {
    if (editingChannel) {
      setType(editingChannel.type);
      setName(editingChannel.name);
      setIdentifier(editingChannel.identifier);
      setMode(editingChannel.mode || 'auto');
      setVideoUrls(
        editingChannel.videoUrls && editingChannel.videoUrls.length > 0
          ? [...editingChannel.videoUrls, '', '', ''].slice(0, 3)
          : ['', '', '']
      );
    } else {
      setType('youtube');
      setName('');
      setIdentifier('');
      setMode('auto');
      setVideoUrls(['', '', '']);
    }
    setUrlErrors(['', '', '']);
    setShowDeleteConfirm(false);
  }, [editingChannel, isOpen]);

  if (!isOpen) return null;

  const handleUrlChange = (index, value) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);

    // Clear error when user types
    const newErrors = [...urlErrors];
    newErrors[index] = '';
    setUrlErrors(newErrors);
  };

  const validateUrls = () => {
    const newErrors = ['', '', ''];
    let hasError = false;

    const filledUrls = videoUrls.filter(url => url.trim());
    if (filledUrls.length === 0) {
      // At least 1 URL must be provided
      newErrors[0] = 'Podaj co najmniej jeden link do filmu TikTok';
      hasError = true;
    } else {
      videoUrls.forEach((url, index) => {
        if (url.trim() && !isValidTikTokUrl(url)) {
          newErrors[index] = 'Nieprawidłowy link do filmu TikTok. Wklej pełny URL (np. https://www.tiktok.com/@user/video/123...).';
          hasError = true;
        }
      });
    }

    setUrlErrors(newErrors);
    return !hasError;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) return;

    // For TikTok manual mode, validate URLs
    if (type === 'tiktok' && mode === 'manual') {
      if (!validateUrls()) return;
    } else {
      if (!identifier.trim()) return;
    }

    let cleanIdentifier = identifier.trim();

    // Extract identifier from URL if user pasted a full link
    try {
      if (cleanIdentifier.startsWith('http')) {
        const url = new URL(cleanIdentifier);
        const path = url.pathname;
        if (path.startsWith('/@')) {
          cleanIdentifier = path.substring(1).split('/')[0]; // returns @username
        } else if (path.startsWith('/channel/')) {
          cleanIdentifier = path.split('/channel/')[1].split('/')[0]; // returns UC...
        }
      }
    } catch {
      // Ignore URL parsing errors, use raw identifier
    }

    const payload = {
      id: editingChannel?.id,
      type,
      name: name.trim(),
      identifier: cleanIdentifier,
    };

    // Add TikTok-specific fields
    if (type === 'tiktok') {
      payload.mode = mode;
      payload.videoUrls = mode === 'manual' 
        ? videoUrls.filter(url => url.trim()) 
        : [];
    }

    onSave(payload);
    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(editingChannel.id);
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  // Determine if identifier is required (not required in TikTok manual mode)
  const identifierRequired = !(type === 'tiktok' && mode === 'manual');

  // Determine if submit should be disabled
  const isSubmitDisabled = !name.trim() || (identifierRequired && !identifier.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 modal-backdrop"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[16px] border border-[#222222] bg-[#111111] p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1C] border border-[#2A2A2A] text-[#888] transition-colors hover:text-white hover:bg-[#252525] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <h2 className="mb-6 text-lg font-bold text-text-primary">
          {isEditing ? 'Edytuj kanał' : 'Dodaj nowy kanał'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel type selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Platforma
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('youtube')}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-input)] border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
                  type === 'youtube'
                    ? 'border-youtube bg-youtube-bg text-youtube'
                    : 'border-transparent bg-bg-page text-text-secondary hover:bg-bg-card-hover'
                }`}
              >
                <Play className="h-4 w-4" />
                YouTube
              </button>
              <button
                type="button"
                onClick={() => setType('tiktok')}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-input)] border-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
                  type === 'tiktok'
                    ? 'border-tiktok bg-tiktok-bg text-tiktok'
                    : 'border-transparent bg-bg-page text-text-secondary hover:bg-bg-card-hover'
                }`}
              >
                <Music className="h-4 w-4" />
                TikTok
              </button>
            </div>
          </div>

          {/* TikTok mode toggle */}
          {type === 'tiktok' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Tryb pobierania
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('auto')}
                  className={`rounded-[var(--radius-input)] border-2 px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    mode === 'auto'
                      ? 'border-accent-purple bg-gradient-to-br from-accent-pink/10 to-accent-purple/10 text-accent-purple'
                      : 'border-transparent bg-bg-page text-text-secondary hover:bg-bg-card-hover'
                  }`}
                >
                  Automatyczne
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className={`rounded-[var(--radius-input)] border-2 px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    mode === 'manual'
                      ? 'border-accent-purple bg-gradient-to-br from-accent-pink/10 to-accent-purple/10 text-accent-purple'
                      : 'border-transparent bg-bg-page text-text-secondary hover:bg-bg-card-hover'
                  }`}
                >
                  Ręczne
                </button>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Nazwa wyświetlana
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Mój kanał kulinarny"
              className="w-full rounded-[var(--radius-input)] border border-gray-200 bg-bg-page px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/10"
              required
            />
          </div>

          {/* Identifier — shown in auto mode or for YouTube */}
          {(type !== 'tiktok' || mode === 'auto') && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {type === 'youtube' ? 'ID kanału lub Handle (@)' : 'Nazwa użytkownika TikTok'}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={type === 'youtube' ? 'np. @CiekawskiCzlowieczek lub UC...' : 'np. @username'}
                className="w-full rounded-[var(--radius-input)] border border-gray-200 bg-bg-page px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/10 font-mono"
                required
              />
              <p className="mt-1 text-xs text-text-muted">
                {type === 'youtube' 
                  ? 'Możesz wpisać nazwę z @ (np. @nazwa), ID kanału (UC...) lub wkleić link do kanału.'
                  : 'Wpisz nazwę z @ (np. @tiktokuser) lub wklej link do profilu.'
                }
              </p>
            </div>
          )}

          {/* Manual URL inputs — shown in TikTok manual mode */}
          {type === 'tiktok' && mode === 'manual' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Linki do filmów (max 3)
              </label>
              <div className="space-y-2">
                {videoUrls.map((url, index) => (
                  <div key={index}>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder="https://www.tiktok.com/@user/video/..."
                      className={`w-full rounded-[var(--radius-input)] border bg-bg-page px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-all duration-200 focus:border-accent-purple/40 focus:ring-2 focus:ring-accent-purple/10 font-mono ${
                        urlErrors[index] 
                          ? 'border-error' 
                          : 'border-gray-200'
                      }`}
                    />
                    {urlErrors[index] && (
                      <p className="mt-1 text-xs text-error">
                        {urlErrors[index]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Wklej linki do filmów TikTok. Wymagany co najmniej jeden link.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex-1 rounded-[var(--radius-button)] bg-gradient-to-br from-accent-pink to-accent-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isEditing ? 'Zapisz zmiany' : 'Dodaj kanał'}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1.5 rounded-[var(--radius-button)] px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${
                  showDeleteConfirm
                    ? 'bg-error text-white'
                    : 'bg-error-bg text-error hover:bg-error/10'
                }`}
              >
                {showDeleteConfirm ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Potwierdź
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
