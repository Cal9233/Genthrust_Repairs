/**
 * Browser-Safe Logger
 *
 * Lightweight logging utility for frontend applications.
 * Replaces Winston with browser-native console APIs.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

// Logging utility class with context management
export class Logger {
  private context: string;
  private metadata: Record<string, any>;

  constructor(context: string, metadata: Record<string, any> = {}) {
    this.context = context;
    this.metadata = metadata;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const correlationId = getCorrelationId();
    const logMeta = { ...this.metadata, ...meta, context: this.context };

    // Sanitize message
    const sanitizedMessage = sanitizeMessage(message);

    // Build log prefix
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}] [${correlationId}]`;

    // Log to console with appropriate level
    if (Object.keys(logMeta).length > 1) { // More than just 'context'
      console[level](prefix, sanitizedMessage, logMeta);
    } else {
      console[level](prefix, sanitizedMessage);
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    // Only log debug in development
    if (isDevelopment) {
      this.log('debug', message, meta);
    }
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

// Export default logger for backward compatibility
const defaultLogger = {
  debug: (message: string, meta?: Record<string, any>) => {
    if (isDevelopment) {
      console.debug(`[DEBUG]`, message, meta || '');
    }
  },
  info: (message: string, meta?: Record<string, any>) => {
    console.info(`[INFO]`, message, meta || '');
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(`[WARN]`, message, meta || '');
  },
  error: (message: string, meta?: Record<string, any>) => {
    console.error(`[ERROR]`, message, meta || '');
  },
  log: (level: string, message: string, meta?: Record<string, any>) => {
    const logLevel = level as LogLevel;
    if (logLevel === 'debug' && !isDevelopment) return;

    console[logLevel](`[${level.toUpperCase()}]`, message, meta || '');
  }
};

export default defaultLogger;

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
