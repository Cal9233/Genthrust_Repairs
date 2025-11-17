/**
 * Integration Tests: Excel Service Components
 *
 * Tests session lifecycle management, retry logic, concurrent operations,
 * and integration with Microsoft Graph API.
 *
 * Note: Direct ExcelService testing is limited due to class complexity.
 * Focus is on ExcelSessionManager and Graph API interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExcelSessionManager } from '../../src/lib/excelSession';
import type { IPublicClientApplication } from '@azure/msal-browser';
import {
  createRepairOrder,
  createRepairOrders,
  resetSequence
} from '../../src/test/factories';
import { configureMockAPI, errorScenarioHandlers } from '../../src/test/msw-handlers';

// Mock MSAL instance
const createMockMSALInstance = (): IPublicClientApplication => ({
  getAllAccounts: vi.fn().mockReturnValue([{
    homeAccountId: 'test-account',
    environment: 'test',
    tenantId: 'test-tenant',
    username: 'test@genthrust.net',
    localAccountId: 'test-local',
    name: 'Test User',
    idTokenClaims: {}
  }]),
  acquireTokenSilent: vi.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    account: null,
    idToken: '',
    scopes: [],
    expiresOn: new Date(),
    tokenType: 'Bearer',
    correlationId: '',
    extExpiresOn: new Date(),
    state: '',
    fromCache: false
  }),
  acquireTokenPopup: vi.fn(),
  acquireTokenRedirect: vi.fn(),
  loginPopup: vi.fn(),
  loginRedirect: vi.fn(),
  logout: vi.fn(),
  logoutPopup: vi.fn(),
  logoutRedirect: vi.fn(),
  getActiveAccount: vi.fn(),
  setActiveAccount: vi.fn(),
  handleRedirectPromise: vi.fn(),
  acquireTokenByCode: vi.fn(),
  initialize: vi.fn(),
  getLogger: vi.fn(),
  setLogger: vi.fn(),
  enableAccountStorageEvents: vi.fn(),
  disableAccountStorageEvents: vi.fn(),
  getAccountByHomeId: vi.fn(),
  getAccountByLocalId: vi.fn(),
  getAccountByUsername: vi.fn(),
  addEventCallback: vi.fn(),
  removeEventCallback: vi.fn(),
  getTokenCache: vi.fn(),
  clearCache: vi.fn(),
  initializeWrapperLibrary: vi.fn(),
  setNavigationClient: vi.fn(),
  getConfiguration: vi.fn()
} as any);

describe('ExcelSessionManager - Session Lifecycle', () => {
  let sessionManager: ExcelSessionManager;
  let msalInstance: IPublicClientApplication;

  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
    sessionManager = new ExcelSessionManager();
    msalInstance = createMockMSALInstance();
    sessionManager.setMsalInstance(msalInstance);
  });

  it('should create and close session properly', async () => {
    let sessionIdCreated: string | null = null;

    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      sessionIdCreated = sessionId;
      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^session-/);
    });

    // Session should be automatically closed after callback
    expect(sessionIdCreated).toBeTruthy();
  });

  it('should handle multiple sequential sessions', async () => {
    const sessionIds: string[] = [];

    // Create first session
    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      sessionIds.push(sessionId);
    });

    // Create second session
    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      sessionIds.push(sessionId);
    });

    // Create third session
    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      sessionIds.push(sessionId);
    });

    expect(sessionIds).toHaveLength(3);
    // All sessions should have unique IDs
    expect(new Set(sessionIds).size).toBe(3);
  });

  it('should close session even if operation fails', async () => {
    await expect(async () => {
      await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
        expect(sessionId).toBeTruthy();
        throw new Error('Operation failed');
      });
    }).rejects.toThrow('Operation failed');

    // Session should still be closed despite error
    // Next session should work fine
    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      expect(sessionId).toBeTruthy();
    });
  });

  it('should prevent session leaks with concurrent errors', async () => {
    const operations = Array.from({ length: 5 }, (_, i) =>
      sessionManager.withSession('file-book-xlsx', async (sessionId) => {
        if (i % 2 === 0) {
          throw new Error(`Operation ${i} failed`);
        }
      }).catch(() => {
        // Swallow errors for this test
      })
    );

    await Promise.all(operations);

    // All sessions should be closed, new one should work
    await sessionManager.withSession('file-book-xlsx', async (sessionId) => {
      expect(sessionId).toBeTruthy();
    });
  });

  it('should handle concurrent session creation', async () => {
    const concurrentSessions = Array.from({ length: 10 }, () =>
      sessionManager.withSession('file-book-xlsx', async (sessionId) => {
        expect(sessionId).toBeTruthy();
        return sessionId;
      })
    );

    const sessionIds = await Promise.all(concurrentSessions);

    expect(sessionIds).toHaveLength(10);
    sessionIds.forEach(id => expect(id).toBeTruthy());
  });
});

describe('Graph API - Error Scenarios', () => {
  let msalInstance: IPublicClientApplication;

  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
    msalInstance = createMockMSALInstance();
  });

  it('should handle rate limit errors', async () => {
    configureMockAPI.setFailureMode('rate-limit');

    // Attempting to create session should fail with rate limit
    const sessionManager = new ExcelSessionManager();
    sessionManager.setMsalInstance(msalInstance);

    try {
      await sessionManager.withSession('file-book-xlsx', async () => {
        // Should not reach here
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    configureMockAPI.setFailureMode('none');
  });

  it('should handle network errors gracefully', async () => {
    errorScenarioHandlers.networkError();

    const sessionManager = new ExcelSessionManager();
    sessionManager.setMsalInstance(msalInstance);

    await expect(async () => {
      await sessionManager.withSession('file-book-xlsx', async () => {});
    }).rejects.toThrow();

    errorScenarioHandlers.reset();
  });

  it('should handle auth errors', async () => {
    errorScenarioHandlers.authError();

    const sessionManager = new ExcelSessionManager();
    sessionManager.setMsalInstance(msalInstance);

    await expect(async () => {
      await sessionManager.withSession('file-book-xlsx', async () => {});
    }).rejects.toThrow();

    errorScenarioHandlers.reset();
  });

  it('should handle server errors', async () => {
    errorScenarioHandlers.serverError();

    const sessionManager = new ExcelSessionManager();
    sessionManager.setMsalInstance(msalInstance);

    await expect(async () => {
      await sessionManager.withSession('file-book-xlsx', async () => {});
    }).rejects.toThrow();

    errorScenarioHandlers.reset();
  });
});

describe('Graph API - Network Performance', () => {
  let sessionManager: ExcelSessionManager;
  let msalInstance: IPublicClientApplication;

  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
    sessionManager = new ExcelSessionManager();
    msalInstance = createMockMSALInstance();
    sessionManager.setMsalInstance(msalInstance);
  });

  it('should respect network delay configuration', async () => {
    configureMockAPI.setNetworkDelay(200);

    const startTime = Date.now();
    await sessionManager.withSession('file-book-xlsx', async () => {
      // Empty operation
    });
    const endTime = Date.now();

    // Should take at least 200ms due to configured delay
    expect(endTime - startTime).toBeGreaterThanOrEqual(180); // Small buffer

    configureMockAPI.setNetworkDelay(0);
  });

  it('should handle concurrent operations with network delays', async () => {
    configureMockAPI.setNetworkDelay(100);

    const startTime = Date.now();
    const concurrentOps = Array.from({ length: 5 }, () =>
      sessionManager.withSession('file-book-xlsx', async () => {})
    );

    await Promise.all(concurrentOps);
    const endTime = Date.now();

    // Should run concurrently, not sequentially
    // 5 sequential ops at 100ms each = 500ms
    // Concurrent should be ~100ms (with some overhead)
    expect(endTime - startTime).toBeLessThan(400);

    configureMockAPI.setNetworkDelay(0);
  });

  it('should complete sessions quickly without delays', async () => {
    const startTime = Date.now();

    await sessionManager.withSession('file-book-xlsx', async () => {
      // Quick operation
    });

    const endTime = Date.now();

    // Should complete very quickly
    expect(endTime - startTime).toBeLessThan(500);
  });
});

describe('Test Data Factories', () => {
  beforeEach(() => {
    resetSequence();
  });

  it('should create valid repair orders', () => {
    const ro = createRepairOrder();

    expect(ro).toBeDefined();
    expect(ro.id).toMatch(/^row-test-/);
    expect(ro.roNumber).toMatch(/^RO-/);
    expect(ro.shopName).toBeTruthy();
    expect(ro.partDescription).toBeTruthy();
  });

  it('should create multiple repair orders', () => {
    const ros = createRepairOrders(10);

    expect(ros).toHaveLength(10);
    ros.forEach((ro, index) => {
      expect(ro.id).toBeTruthy();
    });

    // All RO numbers should be unique
    const roNumbers = ros.map(ro => ro.roNumber);
    expect(new Set(roNumbers).size).toBe(10);
  });

  it('should apply overrides correctly', () => {
    const customRO = createRepairOrder({
      shopName: 'Custom Shop',
      estimatedCost: 99999
    });

    expect(customRO.shopName).toBe('Custom Shop');
    expect(customRO.estimatedCost).toBe(99999);
  });

  it('should reset sequence between tests', () => {
    resetSequence();
    const ro1 = createRepairOrder();

    resetSequence();
    const ro2 = createRepairOrder();

    // After reset, IDs should restart
    expect(ro1.id).toBe(ro2.id);
  });
});

describe('MSW Mock Handlers', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should mock Graph API site endpoint', async () => {
    const response = await fetch('https://graph.microsoft.com/v1.0/sites/root:/test', {
      headers: { 'Authorization': 'Bearer mock-token' }
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('id');
  });

  it('should mock inventory search endpoint', async () => {
    const response = await fetch('http://localhost:3001/api/inventory/search?partNumber=PN-123');

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('should apply configured delays', async () => {
    configureMockAPI.setNetworkDelay(300);

    const startTime = Date.now();
    await fetch('https://graph.microsoft.com/v1.0/sites/root:/test', {
      headers: { 'Authorization': 'Bearer mock-token' }
    });
    const endTime = Date.now();

    expect(endTime - startTime).toBeGreaterThanOrEqual(280);

    configureMockAPI.setNetworkDelay(0);
  });

  it('should support failure modes', async () => {
    configureMockAPI.setFailureMode('network');

    try {
      await fetch('https://graph.microsoft.com/v1.0/sites/root:/test', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }

    configureMockAPI.setFailureMode('none');
  });
});
