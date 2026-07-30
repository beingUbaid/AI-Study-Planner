const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const CURRENT_LEVEL = process.env.NODE_ENV === 'production' ? LEVELS.INFO : LEVELS.DEBUG;

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  let metaString = '';
  if (meta) {
    if (meta instanceof Error) {
      metaString = ` | Error: ${meta.message} | Stack: ${meta.stack}`;
    } else {
      metaString = ` | Meta: ${JSON.stringify(meta)}`;
    }
  }
  return `[${timestamp}] [${level}] ${message}${metaString}`;
};

const logger = {
  debug: (message, meta) => {
    if (CURRENT_LEVEL <= LEVELS.DEBUG) {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  },
  info: (message, meta) => {
    if (CURRENT_LEVEL <= LEVELS.INFO) {
      console.info(formatMessage('INFO', message, meta));
    }
  },
  warn: (message, meta) => {
    if (CURRENT_LEVEL <= LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, meta));
    }
  },
  error: (message, meta) => {
    if (CURRENT_LEVEL <= LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, meta));
    }
  }
};

export default logger;
