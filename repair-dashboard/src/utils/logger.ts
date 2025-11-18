// Browser-compatible logger (replaces winston which is Node.js only)

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  /sk-ant-[a-zA-Z0-9-]+/gi, // Anthropic API keys
  /Bearer\s+[a-zA-Z0-9-_.]+/gi, // Bearer tokens
  /password["\s:=]+[^"\s,}]+/gi, // Password fields
  /apikey["\s:=]+[^"\s,}]+/gi, // API key fields
  /token["\s:=]+[^"\s,}]+/gi, // Token fields
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g // Email addresses (PII)
];

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

// Format timestamp
const getTimestamp = (): string => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
};

// Determine environment
const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

// Browser-compatible logger implementation
class BrowserLogger {
  private level: LogLevel;
  private defaultMeta: Record<string, any>;

  constructor() {
    this.level = isProduction ? 'warn' : 'debug';
    this.defaultMeta = {
      service: 'genthrust-repairs',
      environment: isProduction ? 'production' : 'development'
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, any>): string {
    const correlationId = getCorrelationId();
    const timestamp = getTimestamp();
    const { service, ...otherMeta } = { ...this.defaultMeta, ...meta };

    // Sanitize message
    const sanitizedMessage = typeof message === 'string'
      ? sanitizeMessage(message)
      : sanitizeMessage(JSON.stringify(message));

    // Build log string
    let logString = `[${timestamp}] [${level.toUpperCase()}]`;

    if (service) {
      logString += ` [${service}]`;
    }

    logString += ` [${correlationId}]`;
    logString += ` ${sanitizedMessage}`;

    // Add metadata if present
    if (Object.keys(otherMeta).length > 0) {
      // Sanitize metadata
      const sanitizedMeta = JSON.stringify(otherMeta, (key, value) => {
        if (typeof value === 'string') {
          return sanitizeMessage(value);
        }
        return value;
      }, 2);

      logString += `\n${sanitizedMeta}`;
    }

    return logString;
  }

  log(level: LogLevel, message: string, meta?: Record<string, any>) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);

    // Use appropriate console method
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
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

// Create singleton logger instance
const logger = new BrowserLogger();

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
      context: this.context
    };

    logger.log(level, message, logMeta);
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
export default logger;

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
