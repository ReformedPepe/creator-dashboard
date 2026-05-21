const { supabase } = require('../lib/supabase')

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacji' })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Nieprawidłowy token' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('[Auth] Błąd weryfikacji tokenu:', err.message)
    return res.status(401).json({ error: 'Błąd autoryzacji' })
  }
}

module.exports = { requireAuth }
