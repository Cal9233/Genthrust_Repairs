/**
 * Hybrid Data Flow Integration Test
 *
 * End-to-end tests for MySQL → Excel fallback throughout the application:
 * - Full app flow with MySQL available
 * - Graceful degradation when MySQL fails
 * - Recovery when MySQL comes back online
 * - Data consistency across sources
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../src/test/setup';
import { createRepairOrder, createRepairOrders, resetSequence } from '../../src/test/factories';
import { hybridDataService } from '../../src/services/hybridDataService';
import { excelService } from '../../src/lib/excelService';

// Track API calls
let mysqlCallCount = 0;
let excelCallCount = 0;

// Mock handlers for MySQL (can be toggled on/off)
const createMySQLHandlers = (shouldFail: boolean) => {
  return [
    http.get('*/api/ros', async ({ request }) => {
      mysqlCallCount++;

      if (shouldFail) {
        return HttpResponse.error(); // Network error
      }

      const url = new URL(request.url);
      const archiveStatus = url.searchParams.get('archiveStatus') || 'ACTIVE';

      const mockROs = createRepairOrders(10, {
        archiveStatus: archiveStatus as any,
        id: `mysql-${mysqlCallCount}`, // MySQL format
        shopName: 'Duncan Aviation',
        currentStatus: 'WAITING QUOTE',
      });

      return HttpResponse.json(mockROs.map(ro => ({
        ...ro,
        dateMade: ro.dateMade?.toISOString(),
        dateDroppedOff: ro.dateDroppedOff?.toISOString(),
        estimatedDeliveryDate: ro.estimatedDeliveryDate?.toISOString(),
        currentStatusDate: ro.currentStatusDate?.toISOString(),
        lastDateUpdated: ro.lastDateUpdated?.toISOString(),
        nextDateToUpdate: ro.nextDateToUpdate?.toISOString(),
      })));
    }),

    http.get('*/api/ros/stats/dashboard', async () => {
      mysqlCallCount++;

      if (shouldFail) {
        return HttpResponse.error();
      }

      return HttpResponse.json({
        totalActive: 10,
        overdue: 2,
        waitingQuote: 5,
        approved: 3,
        beingRepaired: 2,
        shipping: 0,
        dueToday: 1,
        overdue30Plus: 1,
        onTrack: 7,
        totalValue: 50000,
        totalEstimatedValue: 50000,
        totalFinalValue: 0,
        approvedPaid: 0,
        approvedNet: 0,
        rai: 0,
        ber: 0,
        cancel: 0,
        scrapped: 0,
      });
    }),
  ];
};

// Mock Excel service
const mockExcelService = () => {
  vi.spyOn(excelService, 'getRepairOrders').mockImplementation(async () => {
    excelCallCount++;
    return createRepairOrders(10, {
      id: `row-${excelCallCount}`, // Excel format
      shopName: 'Duncan Aviation',
      currentStatus: 'WAITING QUOTE',
      archiveStatus: 'ACTIVE',
    });
  });

  vi.spyOn(excelService, 'getRepairOrdersFromSheet').mockImplementation(async () => {
    excelCallCount++;
    return createRepairOrders(5, {
      id: `row-${excelCallCount}`,
      archiveStatus: 'PAID',
    });
  });
};

describe('Hybrid Data Flow - Integration Tests', () => {
  beforeEach(() => {
    mysqlCallCount = 0;
    excelCallCount = 0;
    resetSequence();

    // Reset hybrid service state
    hybridDataService.resetFallbackState();
    hybridDataService.resetMetrics();

    // Mock Excel service
    mockExcelService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Scenario 1: MySQL Available (Happy Path)', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should fetch all data from MySQL when available', async () => {
      // Fetch repair orders
      const ros = await hybridDataService.getRepairOrders('ACTIVE');

      expect(ros).toHaveLength(10);
      expect(ros[0].id).toMatch(/^mysql-/); // MySQL ID format
      expect(mysqlCallCount).toBeGreaterThan(0);
      expect(excelCallCount).toBe(0); // Should NOT use Excel
      expect(hybridDataService.isInFallbackMode()).toBe(false);
    });

    it('should fetch dashboard stats from MySQL', async () => {
      const stats = await hybridDataService.getDashboardStats();

      expect(stats).toHaveProperty('totalActive', 10);
      expect(stats).toHaveProperty('overdue', 2);
      expect(mysqlCallCount).toBeGreaterThan(0);
      expect(excelCallCount).toBe(0);
      expect(hybridDataService.isInFallbackMode()).toBe(false);
    });

    it('should track success metrics', async () => {
      await hybridDataService.getRepairOrders('ACTIVE');
      await hybridDataService.getDashboardStats();

      const metrics = hybridDataService.getMetrics();

      expect(metrics.mysqlSuccessCount).toBe(2); // 2 successful calls
      expect(metrics.mysqlFailureCount).toBe(0);
      expect(metrics.excelFallbackCount).toBe(0);
      expect(metrics.lastMySQLSuccess).toBeTruthy();
    });
  });

  describe('Scenario 2: MySQL Fails → Excel Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(true)); // MySQL fails
    });

    it('should fall back to Excel when MySQL fails', async () => {
      const ros = await hybridDataService.getRepairOrders('ACTIVE');

      expect(ros).toHaveLength(10);
      expect(ros[0].id).toMatch(/^row-/); // Excel ID format
      expect(mysqlCallCount).toBeGreaterThan(0); // Tried MySQL first
      expect(excelCallCount).toBeGreaterThan(0); // Fell back to Excel
      expect(hybridDataService.isInFallbackMode()).toBe(true);
    });

    it('should calculate dashboard stats from Excel when MySQL fails', async () => {
      const stats = await hybridDataService.getDashboardStats();

      expect(stats).toHaveProperty('totalActive');
      expect(stats).toHaveProperty('overdue');
      expect(mysqlCallCount).toBeGreaterThan(0); // Tried MySQL
      expect(excelCallCount).toBeGreaterThan(0); // Fell back to Excel (fetched ROs to calculate stats)
      expect(hybridDataService.isInFallbackMode()).toBe(true);
    });

    it('should track fallback metrics', async () => {
      await hybridDataService.getRepairOrders('ACTIVE');

      const metrics = hybridDataService.getMetrics();

      expect(metrics.mysqlSuccessCount).toBe(0);
      expect(metrics.mysqlFailureCount).toBeGreaterThan(0);
      expect(metrics.excelFallbackCount).toBeGreaterThan(0);
      expect(metrics.lastMySQLFailure).toBeTruthy();
      expect(metrics.lastFailureReason).toBeTruthy();
    });

    it('should stay in fallback mode for subsequent requests (caching)', async () => {
      await hybridDataService.getRepairOrders('ACTIVE');
      const firstMySQLCount = mysqlCallCount;

      // Second request should NOT try MySQL again (within retry interval)
      await hybridDataService.getRepairOrders('ACTIVE');

      expect(mysqlCallCount).toBe(firstMySQLCount); // No additional MySQL attempts
      expect(excelCallCount).toBe(2); // Used Excel both times
      expect(hybridDataService.isInFallbackMode()).toBe(true);
    });
  });

  describe('Scenario 3: MySQL Recovery', () => {
    it('should recover when MySQL comes back online after retry interval', async () => {
      // Start with MySQL failing
      server.use(...createMySQLHandlers(true));
      await hybridDataService.getRepairOrders('ACTIVE');

      expect(hybridDataService.isInFallbackMode()).toBe(true);

      // Set a short retry interval for testing
      hybridDataService.setRetryInterval(10); // 10ms

      // Wait for retry interval
      await new Promise(resolve => setTimeout(resolve, 15));

      // Now fix MySQL
      server.use(...createMySQLHandlers(false));

      // Next request should try MySQL again and succeed
      const ros = await hybridDataService.getRepairOrders('ACTIVE');

      expect(ros[0].id).toMatch(/^mysql-/); // MySQL ID format
      expect(hybridDataService.isInFallbackMode()).toBe(false); // Recovered!
    });
  });

  describe('Scenario 4: Both Sources Fail', () => {
    it('should throw detailed error when both MySQL and Excel fail', async () => {
      // MySQL fails
      server.use(...createMySQLHandlers(true));

      // Excel also fails
      vi.spyOn(excelService, 'getRepairOrders').mockRejectedValue(
        new Error('Excel authentication failed')
      );

      await expect(
        hybridDataService.getRepairOrders('ACTIVE')
      ).rejects.toThrow(/both data sources failed/i);
    });

    it('should include both error messages in combined error', async () => {
      server.use(...createMySQLHandlers(true));
      vi.spyOn(excelService, 'getRepairOrders').mockRejectedValue(
        new Error('Excel auth error')
      );

      try {
        await hybridDataService.getRepairOrders('ACTIVE');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('MySQL');
        expect(error.message).toContain('Excel');
      }
    });
  });

  describe('Scenario 5: Data Consistency', () => {
    it('should return data in same format regardless of source', async () => {
      // MySQL data
      server.use(...createMySQLHandlers(false));
      const mysqlROs = await hybridDataService.getRepairOrders('ACTIVE');

      // Excel data
      server.use(...createMySQLHandlers(true));
      const excelROs = await hybridDataService.getRepairOrders('ACTIVE');

      // Both should have same structure
      expect(mysqlROs[0]).toHaveProperty('roNumber');
      expect(mysqlROs[0]).toHaveProperty('shopName');
      expect(mysqlROs[0]).toHaveProperty('currentStatus');

      expect(excelROs[0]).toHaveProperty('roNumber');
      expect(excelROs[0]).toHaveProperty('shopName');
      expect(excelROs[0]).toHaveProperty('currentStatus');

      // Only difference should be ID format
      expect(mysqlROs[0].id).toMatch(/^mysql-/);
      expect(excelROs[0].id).toMatch(/^row-/);
    });
  });

  describe('Scenario 6: Archive Operations', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should fetch archived ROs from MySQL when available', async () => {
      const archivedROs = await hybridDataService.getArchivedROs('Paid');

      expect(archivedROs).toBeDefined();
      expect(mysqlCallCount).toBeGreaterThan(0);
      expect(excelCallCount).toBe(0);
    });

    it('should fall back to Excel for archived ROs when MySQL fails', async () => {
      server.use(...createMySQLHandlers(true));

      const archivedROs = await hybridDataService.getArchivedROs('Paid');

      expect(archivedROs).toBeDefined();
      expect(archivedROs).toHaveLength(5);
      expect(archivedROs[0].id).toMatch(/^row-/);
      expect(excelCallCount).toBeGreaterThan(0);
    });
  });

  describe('Scenario 7: Metrics Reset', () => {
    it('should reset metrics correctly', async () => {
      server.use(...createMySQLHandlers(false));
      await hybridDataService.getRepairOrders('ACTIVE');

      let metrics = hybridDataService.getMetrics();
      expect(metrics.mysqlSuccessCount).toBeGreaterThan(0);

      hybridDataService.resetMetrics();
      metrics = hybridDataService.getMetrics();

      expect(metrics.mysqlSuccessCount).toBe(0);
      expect(metrics.mysqlFailureCount).toBe(0);
      expect(metrics.excelFallbackCount).toBe(0);
    });
  });

  describe('Scenario 8: Fallback State Management', () => {
    it('should be able to manually reset fallback state', async () => {
      server.use(...createMySQLHandlers(true));
      await hybridDataService.getRepairOrders('ACTIVE');

      expect(hybridDataService.isInFallbackMode()).toBe(true);

      hybridDataService.resetFallbackState();

      expect(hybridDataService.isInFallbackMode()).toBe(false);
    });
  });
});

/**
 * Expected Test Results (After Implementation):
 *
 * ✅ All Scenario 1 tests should PASS (MySQL working)
 * ✅ All Scenario 2 tests should PASS (Fallback working)
 * ✅ Scenario 3 should PASS (Recovery working)
 * ✅ Scenario 4 should PASS (Error handling)
 * ✅ Scenario 5 should PASS (Data consistency)
 * ✅ Scenario 6 should PASS (Archive operations)
 * ✅ Scenario 7 should PASS (Metrics management)
 * ✅ Scenario 8 should PASS (State management)
 *
 * Next Steps:
 * 1. Run tests: `npm run test hybrid-data-flow.test.ts`
 * 2. Verify all tests pass (Green phase) ✅
 * 3. Test in real application
 */
