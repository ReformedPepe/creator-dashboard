import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { Loader2 } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)

    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setSuccessMessage('Sprawdź swoją skrzynkę email, aby potwierdzić konto.')
      }
    } catch (err) {
      setError(translateError(err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError(null)
    setSuccessMessage(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Statflow</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {mode === 'login' ? 'Zaloguj się do swojego konta' : 'Stwórz nowe konto'}
          </p>
        </div>

        {/* Formularz */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-zinc-600 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-[#E53935] transition-colors"
              style={{ backgroundColor: '#111111', border: '1px solid #1E1E1E' }}
              placeholder="twoj@email.com"
            />
          </div>

          <div>
            <label className="block text-xs tracking-widest uppercase text-zinc-600 mb-1.5">
              Hasło
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-[#E53935] transition-colors"
              style={{ backgroundColor: '#111111', border: '1px solid #1E1E1E' }}
              placeholder="••••••••"
            />
          </div>

          {/* Błąd */}
          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Sukces */}
          {successMessage && (
            <div className="text-sm text-green-400 bg-green-400/10 px-3 py-2 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Przycisk submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#E53935' }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </button>
        </form>

        {/* Przełącznik trybu */}
        <p className="text-center text-sm text-zinc-500 mt-6">
          {mode === 'login' ? 'Nie masz konta?' : 'Masz już konto?'}{' '}
          <button
            onClick={toggleMode}
            className="text-[#E53935] hover:underline font-medium"
          >
            {mode === 'login' ? 'Zarejestruj się' : 'Zaloguj się'}
          </button>
        </p>
      </div>
    </div>
  )
}

function translateError(message) {
  if (message.includes('Invalid login credentials')) return 'Nieprawidłowy email lub hasło'
  if (message.includes('User already registered')) return 'Ten email jest już zajęty'
  if (message.includes('Password should be at least')) return 'Hasło musi mieć minimum 6 znaków'
  if (message.includes('Unable to validate email')) return 'Nieprawidłowy adres email'
  if (message.includes('Email rate limit exceeded')) return 'Zbyt wiele prób. Spróbuj za chwilę.'
  return message
}
