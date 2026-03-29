import rateLimit from 'express-rate-limit';
import cors from 'cors';

/**
 * CORS configuration.
 * Allows the Railway frontend and any localhost origin in development.
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      'https://biblefi.up.railway.app',
      'https://biblefi-api-production.up.railway.app',
    ];
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin) || origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment', 'X-Agent-Id', 'X-Agent-Signature'],
  credentials: true,
};

/**
 * Global rate limiter: 100 requests per minute per IP.
 */
export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded — try again in 60 seconds' },
});

/**
 * Stricter rate limiter for expensive endpoints (embeddings, blockchain calls).
 * 20 requests per minute per IP.
 */
export const strictRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded for this endpoint — try again in 60 seconds' },
});

/**
 * Request logger middleware.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
    console.log(`${level} ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });
  next();
}

/**
 * Global error handler — must be registered last.
 */
export function errorHandler(err, req, res, next) {
  console.error('[Error]', err.message, err.stack?.split('\n')[1] ?? '');

  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden', message: err.message });
  }

  return res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
