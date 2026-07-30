import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from '../config/env.js';

// Instantiate AsyncLocalStorage request store for logging request context globally
export const requestStore = new AsyncLocalStorage();

// Helper to recursively redact sensitive keys from log metadata
const redactSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }
  
  const redacted = {};
  const sensitiveKeys = [
    'email', 'password', 'token', 'authorization', 'cookie', 
    'cookies', 'refreshtoken', 'newpassword', 'resetcode', 
    'verifycode', 'prompt', 'response', 'pdftext', 'text', 
    'ip', 'rawcontent', 'secret', 'key', 'payload', 'history'
  ];
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        redacted[key] = redactSensitiveData(obj[key]);
      } else {
        redacted[key] = obj[key];
      }
    }
  }
  return redacted;
};

const formatLog = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  const store = requestStore.getStore();
  const requestId = store?.requestId || '';
  const userId = store?.userId || '';

  // Clean metadata of any sensitive keys before writing logs
  const cleanMetadata = redactSensitiveData(metadata);

  // Standardized structured JSON output in production for privacy-compliance
  if (env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId,
      userId,
      ...cleanMetadata
    });
  } else {
    // Human-readable trace output in development
    const metaStr = Object.keys(cleanMetadata).length ? ` | Meta: ${JSON.stringify(cleanMetadata)}` : '';
    const reqStr = requestId ? ` [Req: ${requestId}]` : '';
    const userStr = userId ? ` [User: ${userId}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${reqStr}${userStr} ${message}${metaStr}`;
  }
});

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    formatLog
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
