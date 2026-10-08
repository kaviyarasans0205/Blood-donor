import config from '../config/index.js';
import ApiError from '../utils/ApiError.js';
import AuditLog from '../models/AuditLog.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let error = err;

  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    error = ApiError.unprocessable('Validation failed', 'MONGO_VALIDATION', details);
  } else if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid value for ${err.path}`, 'INVALID_ID');
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`Duplicate value for ${field}`, 'DUPLICATE_KEY');
  } else if (err.name === 'MulterError') {
    error = ApiError.badRequest(err.message, 'UPLOAD_ERROR');
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(config.isProd ? 'Internal server error' : err.message, 'INTERNAL_ERROR');
    error.stack = err.stack;
  }

  const payload = {
    success: false,
    message: error.message,
    errorCode: error.errorCode || 'ERROR',
  };
  if (error.details) payload.details = error.details;
  if (!config.isProd && error.stack) payload.stack = error.stack.split('\n').slice(0, 5);

  if (error.statusCode >= 500) {
    console.error('[error]', req.method, req.originalUrl, error.message, error.stack);
  }

  if (req.user?.id && error.statusCode >= 400) {
    AuditLog.create({
      userId: req.user.id,
      action: `error:${error.errorCode}`,
      entityType: 'request',
      changes: { path: req.originalUrl, method: req.method, status: error.statusCode },
      ip: req.ip,
      status: 'failure',
    }).catch(() => {});
  }

  res.status(error.statusCode || 500).json(payload);
};
