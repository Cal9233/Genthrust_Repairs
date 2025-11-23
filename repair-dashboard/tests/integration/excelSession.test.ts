import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExcelSessionManager, GraphAPIError } from '../../src/lib/excelSession';

describe('ExcelSessionManager', () => {
  let sessionManager: ExcelSessionManager;
  let mockCallGraphAPI: ReturnType<typeof vi.fn>;

  const mockDriveId = 'test-drive-id';
  const mockFileId = 'test-file-id';
  const mockSessionId = 'test-session-id';

  beforeEach(() => {
    // Create mock callGraphAPI function
    mockCallGraphAPI = vi.fn();

    // Create session manager with test configuration
    sessionManager = new ExcelSessionManager(
      mockDriveId,
      mockFileId,
      mockCallGraphAPI,
      {
        maxRetries: 3,
        retryDelayMs: 100, // Short delay for tests
        sessionTimeoutMs: 5000, // 5 seconds for tests
        persistChanges: true,
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Lifecycle', () => {
    it('creates a session when using withSession', async () => {
      // Mock createSession response
      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId });

      // Mock closeSession response
      mockCallGraphAPI.mockResolvedValueOnce(null);

      await sessionManager.withSession(async (sessionId) => {
        expect(sessionId).toBe(mockSessionId);
      });

      // Verify createSession was called
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        expect.stringContaining('/createSession'),
        'POST',
        { persistChanges: true }
      );

      // Verify closeSession was called
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        expect.stringContaining('/closeSession'),
        'POST',
        {},
        mockSessionId
      );
    });

    it('closes session even if operation fails', async () => {
      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId }); // createSession
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      const testError = new Error('Test operation failed');

      await expect(
        sessionManager.withSession(async () => {
          throw testError;
        })
      ).rejects.toThrow('Test operation failed');

      // Verify closeSession was still called
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        expect.stringContaining('/closeSession'),
        'POST',
        {},
        mockSessionId
      );
    });

    it('closes session even if close fails', async () => {
      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId }); // createSession
      mockCallGraphAPI.mockRejectedValueOnce(new Error('Close failed')); // closeSession

      // Should not throw even if close fails
      await expect(
        sessionManager.withSession(async () => {
          return 'success';
        })
      ).resolves.toBe('success');
    });
  });

  describe('Retry Logic', () => {
    it('retries on retryable errors (429 Too Many Requests)', async () => {
      const retryableError = new Error('Rate limited');
      (retryableError as any).status = 429;

      // Fail twice, succeed on third attempt
      mockCallGraphAPI
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ id: mockSessionId });

      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await sessionManager.withSession(async (sessionId) => {
        expect(sessionId).toBe(mockSessionId);
      });

      // Should have been called 3 times for createSession + 1 for closeSession
      expect(mockCallGraphAPI).toHaveBeenCalledTimes(4);
    });

    it('retries on retryable errors (500 Internal Server Error)', async () => {
      const retryableError = new Error('Server error');
      (retryableError as any).status = 500;

      mockCallGraphAPI
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ id: mockSessionId });

      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await sessionManager.withSession(async (sessionId) => {
        expect(sessionId).toBe(mockSessionId);
      });

      // Should have retried once
      expect(mockCallGraphAPI).toHaveBeenCalledTimes(3); // 2 createSession attempts + 1 closeSession
    });

    it('retries on network errors', async () => {
      const networkError = new Error('network timeout');

      mockCallGraphAPI
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ id: mockSessionId });

      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await sessionManager.withSession(async (sessionId) => {
        expect(sessionId).toBe(mockSessionId);
      });

      expect(mockCallGraphAPI).toHaveBeenCalledTimes(3);
    });

    it('does not retry on non-retryable errors (400 Bad Request)', async () => {
      const nonRetryableError = new Error('Bad request');
      (nonRetryableError as any).status = 400;

      mockCallGraphAPI.mockRejectedValueOnce(nonRetryableError);

      await expect(
        sessionManager.withSession(async () => {
          // Should not reach here
        })
      ).rejects.toThrow(GraphAPIError);

      // Should only attempt once (no retries)
      expect(mockCallGraphAPI).toHaveBeenCalledTimes(1);
    });

    it('throws GraphAPIError after max retries exceeded', async () => {
      const retryableError = new Error('Server error');
      (retryableError as any).status = 500;

      // Fail all 3 attempts
      mockCallGraphAPI
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError);

      await expect(
        sessionManager.withSession(async () => {
          // Should not reach here
        })
      ).rejects.toThrow(GraphAPIError);

      // Should have attempted 3 times
      expect(mockCallGraphAPI).toHaveBeenCalledTimes(3);
    });
  });

  describe('Exponential Backoff', () => {
    it('applies exponential backoff between retries', async () => {
      const retryableError = new Error('Server error');
      (retryableError as any).status = 500;

      const startTime = Date.now();

      mockCallGraphAPI
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ id: mockSessionId });

      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await sessionManager.withSession(async () => {});

      const duration = Date.now() - startTime;

      // Should have delayed at least:
      // - First retry: ~100ms (base delay)
      // - Second retry: ~200ms (base delay * 2)
      // Total: ~300ms minimum (accounting for jitter and execution time)
      expect(duration).toBeGreaterThanOrEqual(250);
    });
  });

  describe('Concurrent Operations', () => {
    it('queues concurrent operations', async () => {
      let operationOrder: number[] = [];

      // First session
      mockCallGraphAPI.mockResolvedValueOnce({ id: 'session-1' }); // createSession
      mockCallGraphAPI.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            operationOrder.push(1);
            resolve(null);
          }, 100);
        });
      }); // closeSession

      // Second session
      mockCallGraphAPI.mockResolvedValueOnce({ id: 'session-2' }); // createSession
      mockCallGraphAPI.mockImplementationOnce(() => {
        operationOrder.push(2);
        return Promise.resolve(null);
      }); // closeSession

      // Start both operations concurrently
      const operation1 = sessionManager.withSession(async () => {});
      const operation2 = sessionManager.withSession(async () => {});

      await Promise.all([operation1, operation2]);

      // Second operation should wait for first to complete
      expect(operationOrder).toEqual([1, 2]);
    });
  });

  describe('executeWithSession', () => {
    it('executes single API call with session', async () => {
      const mockResponse = { data: 'test' };

      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId }); // createSession
      mockCallGraphAPI.mockResolvedValueOnce(mockResponse); // user's API call
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      const result = await sessionManager.executeWithSession(
        'https://example.com/api/test',
        'GET'
      );

      expect(result).toEqual(mockResponse);

      // Verify API call was made with session ID
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        'https://example.com/api/test',
        'GET',
        undefined,
        mockSessionId
      );
    });
  });

  describe('Health Check', () => {
    it('returns true when connection is healthy', async () => {
      mockCallGraphAPI.mockResolvedValueOnce({ id: 'test-file' });

      const isHealthy = await sessionManager.checkHealth();

      expect(isHealthy).toBe(true);

      // Verify health check endpoint was called
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        expect.stringContaining(`/drives/${mockDriveId}/items/${mockFileId}`),
        'GET'
      );
    });

    it('returns false when connection fails', async () => {
      mockCallGraphAPI.mockRejectedValueOnce(new Error('Connection failed'));

      const isHealthy = await sessionManager.checkHealth();

      expect(isHealthy).toBe(false);
    });

    it('retries health check on retryable errors', async () => {
      const retryableError = new Error('Temporary error');
      (retryableError as any).status = 503;

      mockCallGraphAPI
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce({ id: 'test-file' });

      const isHealthy = await sessionManager.checkHealth();

      expect(isHealthy).toBe(true);
      expect(mockCallGraphAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('Session Info', () => {
    it('returns no session info initially', () => {
      const info = sessionManager.getSessionInfo();

      expect(info.hasSession).toBe(false);
      expect(info.sessionId).toBeUndefined();
    });

    it('returns session info during active session', async () => {
      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId }); // createSession
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      // Hold the session open
      await sessionManager.withSession(async () => {
        const info = sessionManager.getSessionInfo();

        expect(info.hasSession).toBe(true);
        expect(info.sessionId).toBe(mockSessionId);
        expect(info.inUse).toBe(true);
        // Note: isValid might be false because the session is marked as inUse
        expect(info.createdAt).toBeInstanceOf(Date);
        expect(info.expiresAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Force Close', () => {
    it('can force close an active session', async () => {
      mockCallGraphAPI.mockResolvedValueOnce({ id: mockSessionId }); // createSession
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession from forceClose
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession from withSession

      await sessionManager.withSession(async () => {
        await sessionManager.forceClose();

        const info = sessionManager.getSessionInfo();
        expect(info.hasSession).toBe(false);
      });
    });
  });

  describe('GraphAPIError', () => {
    it('creates GraphAPIError with correct properties', () => {
      const error = new GraphAPIError(
        'Test error',
        404,
        false,
        { detail: 'Not found' }
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
      expect(error.isRetryable).toBe(false);
      expect(error.response).toEqual({ detail: 'Not found' });
      expect(error.name).toBe('GraphAPIError');
    });
  });

  describe('Error Classification', () => {
    it('correctly identifies retryable status codes', async () => {
      const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

      for (const statusCode of retryableStatusCodes) {
        vi.clearAllMocks();

        const error = new Error(`Error ${statusCode}`);
        (error as any).status = statusCode;

        mockCallGraphAPI
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ id: mockSessionId });

        mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

        // Should retry and succeed
        await sessionManager.withSession(async () => {});

        // Verify retry happened (2 createSession attempts + 1 closeSession)
        expect(mockCallGraphAPI).toHaveBeenCalledTimes(3);
      }
    });

    it('correctly identifies non-retryable status codes', async () => {
      const nonRetryableStatusCodes = [400, 401, 403, 404];

      for (const statusCode of nonRetryableStatusCodes) {
        vi.clearAllMocks();

        const error = new Error(`Error ${statusCode}`);
        (error as any).status = statusCode;

        mockCallGraphAPI.mockRejectedValueOnce(error);

        // Should not retry
        await expect(
          sessionManager.withSession(async () => {})
        ).rejects.toThrow(GraphAPIError);

        // Verify no retry (only 1 call)
        expect(mockCallGraphAPI).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Session Timeout', () => {
    it('creates new session if previous session expired', async () => {
      // Create session manager with very short timeout
      const shortTimeoutManager = new ExcelSessionManager(
        mockDriveId,
        mockFileId,
        mockCallGraphAPI,
        {
          maxRetries: 3,
          retryDelayMs: 100,
          sessionTimeoutMs: 100, // 100ms timeout
          persistChanges: true,
        }
      );

      // First session
      mockCallGraphAPI.mockResolvedValueOnce({ id: 'session-1' });
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await shortTimeoutManager.withSession(async () => {});

      // Wait for session to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second session (should create new session since first expired)
      mockCallGraphAPI.mockResolvedValueOnce({ id: 'session-2' });
      mockCallGraphAPI.mockResolvedValueOnce(null); // closeSession

      await shortTimeoutManager.withSession(async (sessionId) => {
        expect(sessionId).toBe('session-2');
      });

      // Verify createSession was called twice (once for each session)
      expect(mockCallGraphAPI).toHaveBeenCalledWith(
        expect.stringContaining('/createSession'),
        'POST',
        expect.anything()
      );
    });
  });
});
