// Browser-compatible logger (replaces Winston for frontend)
// Winston is Node.js only - this provides the same API for browser environments

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/gi, // Anthropic API keys
  /Bearer\s+[a-zA-Z0-9-_.]+/gi, // Bearer tokens
  /password["\s:=]+[^"\s,}]+/gi, // Password fields
  /apikey["\s:=]+[^"\s,}]+/gi, // API key fields
  /token["\s:=]+[^"\s,}]+/gi, // Token fields
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email addresses (PII)
];

// Correlation ID management (per-request tracking)
let currentCorrelationId: string | null = null;

export const setCorrelationId = (id: string) => {
  currentCorrelationId = id;
};

export const getCorrelationId = (): string => {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId();
  }
  return currentCorrelationId;
};

export const clearCorrelationId = () => {
  currentCorrelationId = null;
};

const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Sanitize sensitive data from log messages
const sanitizeMessage = (message: string): string => {
  let sanitized = message;

  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
};

// Determine environment
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

// Log level priorities
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLogLevel = isProduction ? LOG_LEVELS.warn : LOG_LEVELS.debug;

// Browser console logger (replaces Winston)
class BrowserLogger {
  private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    return LOG_LEVELS[level] >= currentLogLevel;
  }

  private formatMessage(level: string, message: string, meta?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const correlationId = getCorrelationId();
    const sanitizedMessage = typeof message === 'string'
      ? sanitizeMessage(message)
      : sanitizeMessage(JSON.stringify(message));

    let logString = `[${timestamp}] [${level.toUpperCase()}] [${correlationId}] ${sanitizedMessage}`;

    return logString;
  }

  private sanitizeMeta(meta?: Record<string, any>): Record<string, any> | undefined {
    if (!meta) return undefined;

    return JSON.parse(JSON.stringify(meta, (key, value) => {
      if (typeof value === 'string') {
        return sanitizeMessage(value);
      }
      return value;
    }));
  }

  log(level: string, message: string, meta?: Record<string, any>) {
    const logLevel = level as keyof typeof LOG_LEVELS;
    if (!this.shouldLog(logLevel)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    const sanitizedMeta = this.sanitizeMeta(meta);

    // Use appropriate console method with color coding in development
    switch (level) {
      case 'debug':
        if (isDevelopment) {
          console.debug(`%c${formattedMessage}`, 'color: #888', sanitizedMeta);
        } else {
          console.debug(formattedMessage, sanitizedMeta);
        }
        break;
      case 'info':
        if (isDevelopment) {
          console.info(`%c${formattedMessage}`, 'color: #2196F3', sanitizedMeta);
        } else {
          console.info(formattedMessage, sanitizedMeta);
        }
        break;
      case 'warn':
        if (isDevelopment) {
          console.warn(`%c${formattedMessage}`, 'color: #FF9800', sanitizedMeta);
        } else {
          console.warn(formattedMessage, sanitizedMeta);
        }
        break;
      case 'error':
        if (isDevelopment) {
          console.error(`%c${formattedMessage}`, 'color: #f44336', sanitizedMeta);
        } else {
          console.error(formattedMessage, sanitizedMeta);
        }
        break;
      default:
        console.log(formattedMessage, sanitizedMeta);
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }
}

// Singleton logger instance
const browserLogger = new BrowserLogger();

// Logging utility class with context management
export class Logger {
  private context: string;
  private metadata: Record<string, any>;

  constructor(context: string, metadata: Record<string, any> = {}) {
    this.context = context;
    this.metadata = metadata;
  }

  private log(level: string, message: string, meta?: Record<string, any>) {
    const logMeta = {
      ...this.metadata,
      ...meta,
      context: this.context,
      service: 'genthrust-repairs',
      environment: isProduction ? 'production' : 'development'
    };

    browserLogger.log(level, message, logMeta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | unknown, meta?: Record<string, any>) {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };

    this.log('error', message, errorMeta);
  }

  // Create a child logger with additional context
  child(additionalContext: string, additionalMeta?: Record<string, any>): Logger {
    return new Logger(
      `${this.context}:${additionalContext}`,
      { ...this.metadata, ...additionalMeta }
    );
  }
}

// Convenience function to create a logger for a specific context
export const createLogger = (context: string, metadata?: Record<string, any>): Logger => {
  return new Logger(context, metadata);
};

// Performance timing utility
export class PerformanceLogger {
  private logger: Logger;
  private startTime: number;
  private operation: string;

  constructor(logger: Logger, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = performance.now();

    this.logger.debug(`${operation} started`);
  }

  end(success: boolean = true, meta?: Record<string, any>) {
    const duration = performance.now() - this.startTime;
    const message = `${this.operation} ${success ? 'completed' : 'failed'}`;

    const perfMeta = {
      ...meta,
      duration: `${duration.toFixed(2)}ms`,
      durationMs: duration,
      success
    };

    if (success) {
      this.logger.info(message, perfMeta);
    } else {
      this.logger.warn(message, perfMeta);
    }

    return duration;
  }
}

// Export singleton logger instance for backward compatibility
export default browserLogger;

// Helper to measure async operations
export const measureAsync = async <T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const perfLogger = new PerformanceLogger(logger, operation);

  try {
    const result = await fn();
    perfLogger.end(true);
    return result;
  } catch (error) {
    perfLogger.end(false, { error });
    throw error;
  }
};

// React hook for component logging
export const useLogger = (componentName: string, props?: Record<string, any>) => {
  const logger = createLogger(`Component:${componentName}`, props);

  // Log component mount (in development only)
  if (isDevelopment) {
    logger.debug('Component mounted');
  }

  return logger;
};

// Example usage patterns:
/*
// Basic usage:
const logger = createLogger('MyService');
logger.info('Service initialized');
logger.error('Operation failed', error);

// With metadata:
const logger = createLogger('API', { userId: 'user123' });
logger.info('API call started', { endpoint: '/api/data' });

// Child logger:
const parentLogger = createLogger('ParentService');
const childLogger = parentLogger.child('ChildOperation');
childLogger.debug('Processing item', { itemId: 123 });

// Performance tracking:
const perfLogger = new PerformanceLogger(logger, 'fetchData');
const data = await fetchData();
perfLogger.end(true, { recordCount: data.length });

// Async measurement:
const data = await measureAsync(logger, 'fetchData', async () => {
  return await fetchData();
});

// React component:
const MyComponent = () => {
  const logger = useLogger('MyComponent', { userId: user.id });

  useEffect(() => {
    logger.info('Data loaded', { count: items.length });
  }, [items]);
};
*/
