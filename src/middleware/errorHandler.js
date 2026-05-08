const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message    = err.message    || 'Server Error';

  // Only log truly unexpected errors (bugs, unhandled rejections, 5xx).
  // Operational 4xx errors (wrong password, 401, 404, validation) are normal
  // business-logic responses — logging them as errors creates noise that
  // obscures real problems.
  const isUnexpected = !err.isOperational || statusCode >= 500;
  if (isUnexpected) {
    console.error(
      '[errorHandler] %s %s → %s %s\n%s',
      req.method,
      req.originalUrl,
      statusCode,
      message,
      err.stack || ''
    );
  }

  // API response
  if (req.originalUrl.startsWith('/api')) {
    return res.status(statusCode).json({
      error: message,
      stack: process.env.NODE_ENV === 'development' && isUnexpected ? err.stack : undefined,
    });
  }

  // Render view response for non-API requests
  if (statusCode === 404) {
    return res.status(404).render('pages/404', {
      title: 'Page Not Found',
      description: message,
    });
  }

  // For 401 on a page route (e.g. Stripe redirect arriving without cookie),
  // redirect to the login/account page instead of showing a raw error page.
  // The returnTo param lets the account page bounce the user back after login.
  if (statusCode === 401 && !req.originalUrl.startsWith('/api')) {
    const returnTo = encodeURIComponent(req.originalUrl);
    return res.redirect(`/account?returnTo=${returnTo}`);
  }

  res.status(statusCode).render('pages/error', {
    title: 'Error',
    message,
    statusCode,
  });
};

module.exports = errorHandler;
