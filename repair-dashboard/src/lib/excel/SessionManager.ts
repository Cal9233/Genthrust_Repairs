import { createLogger } from '../../utils/logger';
import type { GraphClient } from './GraphClient';

const logger = createLogger('SessionManager');

/**
 * Session configuration options
 */
export interface SessionOptions {
  maxRetries?: number; // Default: 3
  retryDelayMs?: number; // Base delay for exponential backoff, default: 1000ms
  sessionTimeoutMs?: number; // Session timeout, default: 30 minutes
  persistChanges?: boolean; // Default: true
}

/**
 * Session state
 */
interface SessionState {
  id: string;
  createdAt: number;
  expiresAt: number;
  inUse: boolean;
}

/**
 * Graph API error with retry information
 */
export class GraphAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean,
    public response?: any
  ) {
    super(message);
    this.name = 'GraphAPIError';
  }
}

/**
 * Excel Session Manager
 *
 * Manages SharePoint Excel workbook sessions with:
 * - Automatic session creation/cleanup
 * - Retry logic with exponential backoff
 * - Concurrent operation safety
 * - Connection health checks
 *
 * Usage:
 * ```typescript
 * await sessionManager.withSession(async (sessionId) => {
 *   // Perform operations with sessionId
 *   await graphClient.callGraphAPI(endpoint, 'GET', undefined, sessionId);
 * });
 * ```
 */
export class SessionManager {
  private session: SessionState | null = null;
  private sessionLock: Promise<void> | null = null;
  private options: Required<SessionOptions>;

  constructor(
    private driveId: string,
    private fileId: string,
    private graphClient: GraphClient,
    options: SessionOptions = {}
  ) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      sessionTimeoutMs: options.sessionTimeoutMs ?? 30 * 60 * 1000, // 30 minutes
      persistChanges: options.persistChanges ?? true,
    };

    logger.debug('SessionManager initialized', {
      driveId,
      fileId,
      options: this.options,
    });
  }

  /**
   * Check if current session is valid
   */
  private isSessionValid(): boolean {
    if (!this.session) {
      return false;
    }

    const now = Date.now();
    const isValid = now < this.session.expiresAt && !this.session.inUse;

    if (!isValid) {
      logger.debug('Session validation failed', {
        sessionId: this.session.id,
        expired: now >= this.session.expiresAt,
        inUse: this.session.inUse,
      });
    }

    return isValid;
  }

  /**
   * Create a new workbook session with retry logic
   */
  private async createSession(): Promise<string> {
    logger.info('Creating Excel session', {
      driveId: this.driveId,
      fileId: this.fileId,
    });

    const response = await this.retryOperation(async () => {
      return await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/createSession`,
        'POST',
        {
          persistChanges: this.options.persistChanges,
        }
      );
    }, 'createSession');

    const sessionId = response.id;
    const now = Date.now();

    this.session = {
      id: sessionId,
      createdAt: now,
      expiresAt: now + this.options.sessionTimeoutMs,
      inUse: false,
    };

    logger.info('Excel session created', {
      sessionId,
      expiresAt: new Date(this.session.expiresAt).toISOString(),
    });

    return sessionId;
  }

  /**
   * Close the current session
   */
  private async closeSession(): Promise<void> {
    if (!this.session) {
      logger.debug('No session to close');
      return;
    }

    const sessionId = this.session.id;

    try {
      logger.info('Closing Excel session', { sessionId });

      await this.retryOperation(async () => {
        return await this.graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/closeSession`,
          'POST',
          {},
          sessionId
        );
      }, 'closeSession');

      logger.info('Excel session closed', { sessionId });
    } catch (error) {
      // Log error but don't throw - session cleanup is best-effort
      logger.error('Failed to close Excel session', error, { sessionId });
    } finally {
      this.session = null;
    }
  }

  /**
   * Execute an operation with retry logic and exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.debug(`Executing operation: ${operationName}`, {
          attempt,
          maxRetries: this.options.maxRetries,
        });

        const result = await operation();

        if (attempt > 1) {
          logger.info(`Operation succeeded after retry`, {
            operationName,
            attempt,
          });
        }

        return result;
      } catch (error: any) {
        lastError = error;

        // Parse Graph API error
        const isRetryable = this.isRetryableError(error);
        const statusCode = error.status || error.statusCode || 0;

        logger.warn(`Operation failed`, {
          operationName,
          attempt,
          maxRetries: this.options.maxRetries,
          statusCode,
          isRetryable,
          error: error.message,
        });

        // Don't retry if error is not retryable
        if (!isRetryable) {
          logger.error(`Non-retryable error, aborting`, error, {
            operationName,
            attempt,
          });
          throw new GraphAPIError(
            error.message,
            statusCode,
            false,
            error.response
          );
        }

        // Don't retry if this was the last attempt
        if (attempt >= this.options.maxRetries) {
          logger.error(`Max retries exceeded`, error, {
            operationName,
            attempts: attempt,
          });
          throw new GraphAPIError(
            `Operation failed after ${attempt} attempts: ${error.message}`,
            statusCode,
            true,
            error.response
          );
        }

        // Calculate exponential backoff delay
        const delay = this.calculateBackoffDelay(attempt);
        logger.debug(`Retrying after delay`, {
          operationName,
          attempt,
          delayMs: delay,
        });

        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript doesn't know that
    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Retryable status codes
    const retryableStatusCodes = [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ];

    const statusCode = error.status || error.statusCode || 0;

    // Check if status code is retryable
    if (retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    // Network errors are retryable
    if (error.message?.includes('network') || error.message?.includes('ECONNRESET')) {
      return true;
    }

    // Session-related errors are retryable
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^(attempt - 1)
    // attempt 1: 1000ms
    // attempt 2: 2000ms
    // attempt 3: 4000ms
    const delay = this.options.retryDelayMs * Math.pow(2, attempt - 1);

    // Add jitter (random 0-20% variation) to prevent thundering herd
    const jitter = delay * 0.2 * Math.random();

    return Math.floor(delay + jitter);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute operations within a session context with automatic cleanup
   *
   * This is the main entry point for using sessions. It ensures:
   * - Session is created before operation
   * - Session is closed after operation (even if it fails)
   * - Concurrent operations are queued safely
   * - Retry logic is applied automatically
   *
   * @param operation - Function to execute with the session ID
   * @returns Result of the operation
   *
   * @example
   * ```typescript
   * const result = await sessionManager.withSession(async (sessionId) => {
   *   return await updateRow(sessionId, data);
   * });
   * ```
   */
  async withSession<T>(
    operation: (sessionId: string) => Promise<T>
  ): Promise<T> {
    // Wait for any ongoing session operation to complete
    if (this.sessionLock) {
      logger.debug('Waiting for session lock');
      await this.sessionLock;
    }

    // Create a new lock for this operation
    let releaseLock: () => void;
    this.sessionLock = new Promise((resolve) => {
      releaseLock = resolve as () => void;
    });

    try {
      // Check if we need a new session
      if (!this.isSessionValid()) {
        // Close old session if it exists
        if (this.session) {
          await this.closeSession();
        }

        // Create new session
        await this.createSession();
      }

      // Mark session as in use
      this.session!.inUse = true;

      // Execute operation with retry logic
      const result = await this.retryOperation(
        () => operation(this.session!.id),
        'userOperation'
      );

      return result;
    } finally {
      // Mark session as not in use
      if (this.session) {
        this.session.inUse = false;
      }

      // Always close the session after operation
      await this.closeSession();

      // Release the lock
      releaseLock!();
      this.sessionLock = null;
    }
  }

  /**
   * Execute a Graph API call with automatic session handling
   *
   * This wraps callGraphAPI with session management. Use this for
   * single API calls that need session handling.
   *
   * @param endpoint - Graph API endpoint
   * @param method - HTTP method
   * @param body - Request body
   * @returns API response
   */
  async executeWithSession<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any
  ): Promise<T> {
    return await this.withSession(async (sessionId) => {
      return await this.graphClient.callGraphAPI(endpoint, method, body, sessionId);
    });
  }

  /**
   * Check connection health by attempting to get file info
   *
   * @returns true if connection is healthy, false otherwise
   */
  async checkHealth(): Promise<boolean> {
    try {
      logger.debug('Checking connection health', {
        driveId: this.driveId,
        fileId: this.fileId,
      });

      await this.retryOperation(async () => {
        return await this.graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}`,
          'GET'
        );
      }, 'healthCheck');

      logger.info('Connection health check passed', {
        driveId: this.driveId,
        fileId: this.fileId,
      });

      return true;
    } catch (error) {
      logger.error('Connection health check failed', error, {
        driveId: this.driveId,
        fileId: this.fileId,
      });

      return false;
    }
  }

  /**
   * Get current session info (for debugging)
   */
  getSessionInfo(): {
    hasSession: boolean;
    sessionId?: string;
    createdAt?: Date;
    expiresAt?: Date;
    inUse?: boolean;
    isValid?: boolean;
  } {
    if (!this.session) {
      return { hasSession: false };
    }

    return {
      hasSession: true,
      sessionId: this.session.id,
      createdAt: new Date(this.session.createdAt),
      expiresAt: new Date(this.session.expiresAt),
      inUse: this.session.inUse,
      isValid: this.isSessionValid(),
    };
  }

  /**
   * Force close current session (for cleanup/testing)
   */
  async forceClose(): Promise<void> {
    logger.info('Force closing session');
    await this.closeSession();
  }
}
