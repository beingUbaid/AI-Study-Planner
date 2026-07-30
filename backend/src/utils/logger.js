import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// Instantiate AsyncLocalStorage request store for logging request context globally
export const requestStore = new AsyncLocalStorage();

const formatLog = winston.format.printf(({ timestamp, level, message, ...metadata }) => {
  const store = requestStore.getStore();
  const requestId = store?.requestId || '';
  const userId = store?.userId || '';

  // Standardized structured JSON output in production
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level,
      message,
      requestId,
      userId,
      ...metadata
    });
  } else {
    // Human-readable trace output in development
    const metaStr = Object.keys(metadata).length ? ` | Meta: ${JSON.stringify(metadata)}` : '';
    const reqStr = requestId ? ` [Req: ${requestId}]` : '';
    const userStr = userId ? ` [User: ${userId}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${reqStr}${userStr} ${message}${metaStr}`;
  }
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    formatLog
  ),
  transports: [
    new winston.transports.Console()
  ]
});

export default logger;
