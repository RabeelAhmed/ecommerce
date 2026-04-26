const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Default error status and message
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  // API response
  if (req.originalUrl.startsWith('/api')) {
    return res.status(statusCode).json({
      error: message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Render view response for non-API requests
  res.status(statusCode).render('pages/error', {
    title: 'Error',
    message: message,
    statusCode: statusCode,
  });
};

module.exports = errorHandler;
