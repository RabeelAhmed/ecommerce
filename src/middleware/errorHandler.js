const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  // Temporary diagnostics — remove before production
  console.error('[errorHandler] name=%s statusCode=%s status=%s message=%s',
    err.name, err.statusCode, err.status, err.message);

  // Read directly from err — spreading an Error subclass can drop custom
  // properties (statusCode, isOperational) in Express 5's error pipeline.
  const statusCode = err.statusCode || err.status || 500;
  const message    = err.message    || 'Server Error';

  // API response
  if (req.originalUrl.startsWith('/api')) {
    return res.status(statusCode).json({
      error: message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Render view response for non-API requests
  if (statusCode === 404) {
    return res.status(404).render('pages/404', {
      title: 'Page Not Found',
      description: message,
    });
  }

  res.status(statusCode).render('pages/error', {
    title: 'Error',
    message: message,
    statusCode: statusCode,
  });
};

module.exports = errorHandler;
