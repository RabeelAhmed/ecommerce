const crypto = require('crypto');
const AppError = require('../utils/AppError');

/**
 * Generate a cryptographically random CSRF token, store it in a
 * signed cookie, and expose it on res.locals for templates.
 */
function generateCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('_csrf', token, {
    httpOnly: true,
    signed: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  res.locals.csrfToken = token;
  return token;
}

/**
 * attachCsrf — runs on every request.
 * If a valid signed cookie already exists, re-use that token.
 * Otherwise generate a fresh one.
 */
function attachCsrf(req, res, next) {
  const existing = req.signedCookies && req.signedCookies['_csrf'];
  if (existing) {
    res.locals.csrfToken = existing;
  } else {
    generateCsrfToken(req, res);
  }
  next();
}

/**
 * csrfProtection — apply to any route that mutates state.
 * Accepts token from:
 *   1. X-CSRF-Token header  (AJAX)
 *   2. req.body._csrf       (HTML forms)
 */
function csrfProtection(req, res, next) {
  // Safe methods don't need validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.signedCookies && req.signedCookies['_csrf'];
  const requestToken =
    req.headers['x-csrf-token'] ||
    (req.body && req.body._csrf);

  if (!cookieToken || !requestToken || cookieToken !== requestToken) {
    return next(new AppError('Invalid or missing CSRF token', 403));
  }

  next();
}

module.exports = { attachCsrf, csrfProtection, generateCsrfToken };
