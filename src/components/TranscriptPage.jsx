// TranscriptPage — pobieranie transkrypcji z filmów YouTube
import { useState } from 'react';
import { Loader2, Copy, Check, AlertCircle } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TranscriptPage() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError('');
    setTranscript(null);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/tools/transcript`, { url: trimmed });
      setTranscript(res.data.transcript);
    } catch (err) {
      const msg = err.response?.data?.error || 'Nie udało się pobrać transkrypcji';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    const text = transcript.map(t => `[${t.timestamp}] ${t.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#52525B]">Transkrypcja YouTube</span>
        </div>

        <div className="rounded-[12px] border border-[#1E1E1E] bg-[#111111] p-4 md:p-5 space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 rounded-lg border border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white placeholder:text-[#555] outline-none transition-colors focus:border-accent font-mono"
            />
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoading ? 'Pobieranie...' : 'Transkrybuj'}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Transcript result */}
          {transcript && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#888]">{transcript.length} fragmentów</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E1E1E] text-xs text-[#A1A1AA] hover:bg-[#1C1C1C] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Skopiowano' : 'Kopiuj'}
                </button>
              </div>
              <div className="rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] p-4 max-h-[500px] overflow-y-auto space-y-1">
                {transcript.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="text-[#555] font-mono text-xs shrink-0 pt-0.5">{item.timestamp}</span>
                    <span className="text-[#ccc]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
