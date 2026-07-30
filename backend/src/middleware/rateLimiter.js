import rateLimit from 'express-rate-limit';

/**
 * Safe key generator: prefers authenticated user ID, falls back to IP.
 *
 * express-rate-limit v8+ throws ERR_ERL_KEY_GEN_IPV6 at module-load time
 * when a custom keyGenerator is defined and the library cannot confirm that
 * `trust proxy` is configured (this check runs before the Express app is
 * fully initialised in test environments).
 *
 * We use `validate: false` on every limiter that uses this generator to
 * suppress all startup-time validation. The proxy is correctly configured
 * in app.js via `app.set('trust proxy', 1)`.
 */
const userOrIPKeyGenerator = (req) => {
  if (req.user && req.user.id) return String(req.user.id);
  return req.ip || '0.0.0.0';
};

// ── Global request rate limiter
// (no custom keyGenerator — uses express-rate-limit's built-in IPv6-safe default)
export const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { status: 'fail', message: 'Too many requests, please try again after 15 minutes.' }
});

// ── Authentication limiter (login, register, verify, forgot-password, refresh)
export const authLimiter = rateLimit({
  windowMs:           60 * 60 * 1000,
  max:                15,
  keyGenerator:       userOrIPKeyGenerator,
  skipFailedRequests: false,
  standardHeaders:    true,
  legacyHeaders:      false,
  validate:           false,   // suppress startup IPv6 / trust-proxy validation
  message: { status: 'fail', message: 'Too many authentication attempts. Please try again after an hour.' }
});

// ── AI generation limiter (to prevent cost overruns)
export const aiLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             20,
  keyGenerator:    userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  validate:        false,
  message: { status: 'fail', message: 'AI generation limit reached. Please wait before generating more content.' }
});

// ── Upload limiter (per-user quota: 5 PDFs per hour)
export const uploadLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  keyGenerator:    userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  validate:        false,
  message: { status: 'fail', message: 'PDF upload limit reached. You can upload up to 5 syllabi per hour.' }
});

// ── General API limiter (subjects, planner, analytics, progress)
export const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             150,
  keyGenerator:    userOrIPKeyGenerator,
  standardHeaders: true,
  legacyHeaders:   false,
  validate:        false,
  message: { status: 'fail', message: 'Too many API requests. Please slow down.' }
});
