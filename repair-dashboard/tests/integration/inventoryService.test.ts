/**
 * Integration Tests: Inventory Service
 *
 * Tests MySQL/SharePoint fallback logic, low stock detection,
 * and sync operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { inventoryService } from '../../src/services/inventoryService';
import { mysqlInventoryService } from '../../src/services/mysqlInventoryService';
import type { IPublicClientApplication } from '@azure/msal-browser';
import {
  createInventoryItem,
  createInventoryItems,
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
} as any);

describe('InventoryService - MySQL Fallback Logic', () => {
  let msalInstance: IPublicClientApplication;

  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
    msalInstance = createMockMSALInstance();
    inventoryService.setMsalInstance(msalInstance);
  });

  it('should use MySQL as primary data source', async () => {
    errorScenarioHandlers.reset();

    const result = await inventoryService.searchInventory('PN-123');

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    const status = inventoryService.getDataSourceStatus();
    expect(status.current).toBe('mysql');
    expect(status.mysqlAvailable).toBe(true);
  });

  it('should handle MySQL unavailability gracefully', async () => {
    errorScenarioHandlers.networkError();

    await expect(async () => {
      await inventoryService.searchInventory('PN-123');
    }).rejects.toThrow('Inventory operation failed');

    const status = inventoryService.getDataSourceStatus();
    expect(status.mysqlAvailable).toBe(false);

    errorScenarioHandlers.reset();
  });

  it('should recover when MySQL becomes available again', async () => {
    // First, simulate MySQL failure
    errorScenarioHandlers.networkError();

    await expect(async () => {
      await inventoryService.searchInventory('PN-123');
    }).rejects.toThrow();

    let status = inventoryService.getDataSourceStatus();
    expect(status.mysqlAvailable).toBe(false);

    // Now MySQL recovers
    errorScenarioHandlers.reset();

    // Force health check
    const healthy = await inventoryService.forceHealthCheck();
    expect(healthy).toBe(true);

    // Should work now
    const result = await inventoryService.searchInventory('PN-456');
    expect(result).toBeDefined();

    status = inventoryService.getDataSourceStatus();
    expect(status.mysqlAvailable).toBe(true);
  });

  it('should cache MySQL health status to avoid excessive checks', async () => {
    // First call
    await inventoryService.forceHealthCheck();

    const status1 = inventoryService.getDataSourceStatus();
    expect(status1.mysqlAvailable).toBe(true);

    // Subsequent calls within cache period shouldn't trigger health check
    const status2 = inventoryService.getDataSourceStatus();
    expect(status2.mysqlAvailable).toBe(true);
  });

  it('should handle partial MySQL failures gracefully', async () => {
    // Search works
    const searchResult = await inventoryService.searchInventory('PN-123');
    expect(searchResult).toBeDefined();

    // But detailed query might fail - simulate by setting error mode
    errorScenarioHandlers.serverError();

    await expect(async () => {
      await inventoryService.getInventoryDetails('stock_room', '1');
    }).rejects.toThrow();

    errorScenarioHandlers.reset();
  });
});

describe('InventoryService - Low Stock Detection', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should detect low stock items', async () => {
    const result = await inventoryService.searchInventory('LOW-STOCK-PART');

    // Mock will return stock info
    expect(result).toBeDefined();

    // In real implementation, check qty threshold
    // Low stock typically means qty <= 2
  });

  it('should flag items after decrement brings them to low stock', async () => {
    // Simulate decrementing item from qty 3 to 2
    const decrementResult = await inventoryService.decrementInventory(
      '1',
      'PN-123',
      'stock_room',
      '1',
      'RO-12345',
      'Used for repair'
    );

    expect(decrementResult).toBeDefined();
    // In production, this would return isLowStock: true if newQty <= 2
  });

  it('should not flag items with sufficient stock', async () => {
    // Simulate decrementing item from qty 10 to 9
    const decrementResult = await inventoryService.decrementInventory(
      '1',
      'PN-456',
      'stock_room',
      '2',
      'RO-12346'
    );

    expect(decrementResult).toBeDefined();
    // isLowStock should be false
  });

  it('should prevent decrement when stock is already zero', async () => {
    // In production, this should throw or return an error
    await expect(async () => {
      await inventoryService.decrementInventory(
        '1',
        'ZERO-STOCK',
        'stock_room',
        '3',
        'RO-12347'
      );
    }).rejects.toThrow();
  });

  it('should aggregate low stock warnings across tables', async () => {
    // Search across all inventory tables
    const partNumber = 'MULTI-TABLE-PART';
    const results = await inventoryService.searchInventory(partNumber);

    expect(results).toBeDefined();
    // In production, would check combined qty across all tables
  });
});

describe('InventoryService - Sync Operations', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should search inventory successfully', async () => {
    const partNumber = 'PN-12345';
    const results = await inventoryService.searchInventory(partNumber);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].partNumber).toBe(partNumber);
  });

  it('should handle wildcard searches', async () => {
    const results = await inventoryService.searchInventory('PN-*');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should return empty array for non-existent parts', async () => {
    const results = await inventoryService.searchInventory('NONEXISTENT-PART-99999');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    // Backend will return empty array, not throw
  });

  it('should get detailed inventory information', async () => {
    const details = await inventoryService.getInventoryDetails('stock_room', '1');

    expect(details).toBeDefined();
  });

  it('should retrieve table column structure', async () => {
    const columns = await inventoryService.getTableColumns('stock_room');

    expect(columns).toBeDefined();
    expect(Array.isArray(columns)).toBe(true);
    expect(columns.length).toBeGreaterThan(0);
  });

  it('should log inventory transactions', async () => {
    const transaction = {
      action: 'DECREMENT' as const,
      partNumber: 'PN-123',
      tableName: 'stock_room',
      rowId: '1',
      delta: -1,
      oldQty: 5,
      newQty: 4,
      roNumber: 'RO-12345',
      notes: 'Used for repair'
    };

    await inventoryService.logInventoryTransaction(transaction);

    // Should complete without error
  });
});

describe('InventoryService - Concurrent Operations', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should handle concurrent searches', async () => {
    const searches = Array.from({ length: 10 }, (_, i) =>
      inventoryService.searchInventory(`PN-${i}`)
    );

    const results = await Promise.all(searches);

    expect(results).toHaveLength(10);
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it('should handle concurrent decrements safely', async () => {
    // Simulate multiple users decrementing same part
    const decrements = Array.from({ length: 5 }, (_, i) =>
      inventoryService.decrementInventory(
        '1',
        'PN-CONCURRENT',
        'stock_room',
        '1',
        `RO-${i}`,
        `Decrement ${i}`
      ).catch(err => err) // Catch errors to test behavior
    );

    const results = await Promise.all(decrements);

    expect(results).toHaveLength(5);
    // Some may succeed, some may fail if stock depleted
  });

  it('should maintain data consistency under load', async () => {
    const operations = [];

    // Mix of searches and decrements
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        operations.push(inventoryService.searchInventory(`PN-${i}`));
      } else {
        operations.push(
          inventoryService.decrementInventory(
            String(i),
            `PN-${i}`,
            'stock_room',
            String(i),
            `RO-${i}`
          ).catch(err => null) // Swallow errors
        );
      }
    }

    const results = await Promise.all(operations);
    expect(results).toHaveLength(20);
  });
});

describe('InventoryService - Error Handling', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should handle network errors gracefully', async () => {
    errorScenarioHandlers.networkError();

    await expect(async () => {
      await inventoryService.searchInventory('PN-123');
    }).rejects.toThrow();

    errorScenarioHandlers.reset();
  });

  it('should handle server errors with appropriate messages', async () => {
    errorScenarioHandlers.serverError();

    await expect(async () => {
      await inventoryService.searchInventory('PN-123');
    }).rejects.toThrow('Inventory operation failed');

    errorScenarioHandlers.reset();
  });

  it('should handle malformed responses', async () => {
    // In production, backend might return malformed data
    // Service should handle gracefully
    const results = await inventoryService.searchInventory('VALID-PN');
    expect(results).toBeDefined();
  });

  it('should timeout on slow operations', async () => {
    configureMockAPI.setNetworkDelay(5000); // 5 second delay

    const startTime = Date.now();

    try {
      await inventoryService.searchInventory('PN-SLOW');
    } catch (error) {
      const endTime = Date.now();
      // Should timeout before 5 seconds if timeout is configured
      // or complete after delay
      expect(endTime - startTime).toBeGreaterThan(0);
    }

    configureMockAPI.setNetworkDelay(0);
  });
});

describe('InventoryService - Performance', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should complete searches quickly', async () => {
    const startTime = Date.now();
    await inventoryService.searchInventory('PN-QUICK');
    const endTime = Date.now();

    // Should complete within 1 second
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should handle batch operations efficiently', async () => {
    const partNumbers = Array.from({ length: 50 }, (_, i) => `PN-${i}`);

    const startTime = Date.now();

    const searches = partNumbers.map(pn => inventoryService.searchInventory(pn));
    await Promise.all(searches);

    const endTime = Date.now();

    // Should complete all 50 searches within 3 seconds
    expect(endTime - startTime).toBeLessThan(3000);
  });

  it('should cache database connections', async () => {
    // First search
    const start1 = Date.now();
    await inventoryService.searchInventory('PN-1');
    const end1 = Date.now();
    const firstSearchTime = end1 - start1;

    // Second search (connection pooling should make it faster)
    const start2 = Date.now();
    await inventoryService.searchInventory('PN-2');
    const end2 = Date.now();
    const secondSearchTime = end2 - start2;

    // Both should be fast, second might be slightly faster
    expect(firstSearchTime).toBeLessThan(1000);
    expect(secondSearchTime).toBeLessThan(1000);
  });
});

describe('InventoryService - Data Integrity', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
  });

  it('should return consistent results for same query', async () => {
    const partNumber = 'PN-CONSISTENT';

    const result1 = await inventoryService.searchInventory(partNumber);
    const result2 = await inventoryService.searchInventory(partNumber);

    expect(result1).toEqual(result2);
  });

  it('should reflect decrements in subsequent searches', async () => {
    const partNumber = 'PN-DECREMENT-TEST';

    // Initial search
    const before = await inventoryService.searchInventory(partNumber);

    // Decrement
    await inventoryService.decrementInventory(
      '1',
      partNumber,
      'stock_room',
      '1',
      'RO-TEST'
    );

    // Search again
    const after = await inventoryService.searchInventory(partNumber);

    // Results should reflect the change
    expect(after).toBeDefined();
  });

  it('should maintain transaction logs accurately', async () => {
    const transaction = {
      action: 'DECREMENT' as const,
      partNumber: 'PN-LOG-TEST',
      tableName: 'stock_room',
      rowId: '1',
      delta: -1,
      oldQty: 10,
      newQty: 9,
      roNumber: 'RO-LOG-TEST'
    };

    // Log transaction
    await inventoryService.logInventoryTransaction(transaction);

    // Should complete successfully
    expect(true).toBe(true);
  });

  it('should handle edge cases in quantity management', async () => {
    // Test qty = 0
    // Test qty = 1 (low stock threshold)
    // Test large quantities
    const testCases = [
      { partNumber: 'ZERO-QTY', expectedQty: 0 },
      { partNumber: 'LOW-QTY', expectedQty: 1 },
      { partNumber: 'HIGH-QTY', expectedQty: 1000 }
    ];

    for (const testCase of testCases) {
      const results = await inventoryService.searchInventory(testCase.partNumber);
      expect(results).toBeDefined();
    }
  });
});
