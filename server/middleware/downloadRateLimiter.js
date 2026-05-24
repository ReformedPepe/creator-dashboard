/**
 * Download Rate Limiter Middleware
 *
 * In-memory rate limiting: max 10 downloads per hour per user.
 * Expects req.user.id to be set by auth middleware (runs before this).
 */

const LIMIT = 10;
const WINDOW_MS = 3600000; // 1 hour in milliseconds

// In-memory store: userId → { count, resetAt }
const rateLimitStore = new Map();

function downloadRateLimiter(req, res, next) {
  const userId = req.user.id;
  const now = Date.now();

  let entry = rateLimitStore.get(userId);

  // If no entry or window expired, reset
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    rateLimitStore.set(userId, entry);
  }

  // Check if limit exceeded
  if (entry.count >= LIMIT) {
    const remainingMs = entry.resetAt - now;
    const retryAfterMinutes = Math.ceil(remainingMs / 60000);

    res.set('X-RateLimit-Limit', String(LIMIT));
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    return res.status(429).json({
      error: `Przekroczono limit 10 pobrań/h. Spróbuj za ${retryAfterMinutes} minut.`,
      retryAfterMinutes
    });
  }

  // Increment count
  entry.count += 1;

  // Set rate limit headers
  res.set('X-RateLimit-Limit', String(LIMIT));
  res.set('X-RateLimit-Remaining', String(LIMIT - entry.count));
  res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  next();
}

module.exports = { downloadRateLimiter, rateLimitStore, LIMIT, WINDOW_MS };
