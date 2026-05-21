import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import AuthPage from './AuthPage'

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)

  if (showAuth) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Ikona */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: '#E53935' }}
      >
        <BarChart3 size={32} className="text-white" />
      </div>

      {/* Nazwa */}
      <h1 className="text-4xl font-bold text-white mb-3">Statflow</h1>

      {/* Opis */}
      <p className="text-zinc-400 text-center max-w-md text-lg mb-8">
        Śledź wyświetlenia swoich filmów z YouTube i TikToka w jednym miejscu
      </p>

      {/* CTA */}
      <button
        onClick={() => setShowAuth(true)}
        className="px-6 py-3 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#E53935' }}
      >
        Zaloguj się
      </button>

      {/* Footer */}
      <p className="text-zinc-600 text-xs mt-12">
        Dashboard do śledzenia statystyk Twoich kanałów
      </p>
    </div>
  )
}
