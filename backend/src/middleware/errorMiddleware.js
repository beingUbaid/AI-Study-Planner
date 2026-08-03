import logger from '../utils/logger.js';
import { env } from '../config/env.js';
import AppError from '../utils/appError.js';

// Helper to redact sensitive information in production logs/messages
function redactSensitiveData(str) {
  if (typeof str !== 'string') return str;
  // Redact Windows paths (e.g. C:\Users\...)
  let sanitized = str.replace(/([a-zA-Z]:|\b)\\[^\s:\\+/*?|<>"]+(?=\\)?/g, '[REDACTED_PATH]');
  // Redact Unix paths (e.g. /app/src/...)
  sanitized = sanitized.replace(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*/g, '[REDACTED_PATH]');
  
  // Redact MongoDB queries/collections
  sanitized = sanitized.replace(/db\.[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+/g, '[REDACTED_QUERY]');
  
  // Redact JWT tokens (e.g. eyJhbGciOi...)
  sanitized = sanitized.replace(/\bey[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\b/g, '[REDACTED_TOKEN]');
  
  // Redact cookies (e.g. session=...)
  sanitized = sanitized.replace(/(cookie|session|jwt)=[^;\s]+/gi, '$1=[REDACTED]');
  
  // Redact Groq keys (gsk_...)
  sanitized = sanitized.replace(/gsk_[a-zA-Z0-9_]+/g, '[REDACTED_KEY]');
  
  return sanitized;
}

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/) : null;
  const message = `Duplicate field value: ${value ? value[0] : ''}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join(' ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () => new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    message: err.message,
    stack: err.stack,
    error: err
  });
};

const sendErrorProd = (err, res) => {
  const message = redactSensitiveData(err.message);
  
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: message
    });
  } else {
    // Programming or other unknown error: redact details and log safely
    logger.error('Production Error Catch 💥', {
      statusCode: err.statusCode || 500,
      message: message,
      stack: err.stack ? redactSensitiveData(err.stack) : undefined
    });
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong on our end.'
    });
  }
};

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = Object.create(err);
    error.message = err.message;
    error.stack = err.stack;
    
    if (err.name === 'CastError') error = handleCastErrorDB(error);
    if (err.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Async error catcher to eliminate try-catch boilerplate in controllers
export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
