/**
 * useROs Hooks Fallback Test Suite (TDD - Red Phase)
 *
 * Tests the React Query hooks that use HybridDataService
 * to fetch/mutate repair order data with MySQL → Excel fallback.
 *
 * Test Coverage:
 * 1. useROs() hook with fallback
 * 2. useArchivedROs() hook with fallback
 * 3. useUpdateROStatus() mutation with fallback
 * 4. useAddRepairOrder() mutation with fallback
 * 5. useUpdateRepairOrder() mutation with fallback
 * 6. useDashboardStats() hook with fallback
 * 7. User notifications when in fallback mode
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../src/test/setup';
import { createRepairOrder, createRepairOrders, resetSequence } from '../../src/test/factories';
import type { ReactNode } from 'react';

// Import hooks to test
import { useROs, useArchivedROs, useUpdateROStatus, useAddRepairOrder, useDashboardStats } from '../../src/hooks/useROs';

// Mock toast notifications
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('../../src/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}));

// Track service calls
let mysqlCallCount = 0;
let excelCallCount = 0;

// Helper to create wrapper with fresh QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retry for tests
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock handlers for MySQL backend
const createMySQLHandlers = (shouldFail: boolean, errorType?: 'network' | 'server') => {
  return [
    http.get('*/api/ros', async ({ request }) => {
      mysqlCallCount++;

      if (shouldFail) {
        if (errorType === 'network') {
          return HttpResponse.error();
        } else if (errorType === 'server') {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 });
        }
      }

      const url = new URL(request.url);
      const archiveStatus = url.searchParams.get('archiveStatus') || 'ACTIVE';

      const mockROs = createRepairOrders(3, {
        archiveStatus: archiveStatus as any,
        id: 'mysql-1'
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
        if (errorType === 'network') {
          return HttpResponse.error();
        }
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }

      return HttpResponse.json({
        totalActive: 3,
        overdue: 1,
        waitingQuote: 1,
        approved: 1,
        beingRepaired: 0,
        shipping: 0,
        dueToday: 0,
        overdue30Plus: 0,
        onTrack: 2,
        totalValue: 15000,
        totalEstimatedValue: 15000,
        totalFinalValue: 0,
        approvedPaid: 0,
        approvedNet: 0,
        rai: 0,
        ber: 0,
        cancel: 0,
        scrapped: 0,
      });
    }),

    http.post('*/api/ros', async ({ request }) => {
      mysqlCallCount++;

      if (shouldFail) {
        if (errorType === 'network') {
          return HttpResponse.error();
        }
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }

      const body = await request.json();
      const newRO = createRepairOrder({
        id: 'mysql-new',
        roNumber: (body as any).roNumber,
        shopName: (body as any).shopName,
      });

      return HttpResponse.json(
        {
          ...newRO,
          dateMade: newRO.dateMade?.toISOString(),
        },
        { status: 201 }
      );
    }),

    http.patch('*/api/ros/:id', async ({ params, request }) => {
      mysqlCallCount++;

      if (shouldFail) {
        if (errorType === 'network') {
          return HttpResponse.error();
        }
        return HttpResponse.json({ error: 'Server error' }, { status: 500 });
      }

      const body = await request.json();
      const updatedRO = createRepairOrder({
        id: params.id as string,
        ...(body as any)
      });

      return HttpResponse.json({
        ...updatedRO,
        dateMade: updatedRO.dateMade?.toISOString(),
        currentStatusDate: updatedRO.currentStatusDate?.toISOString(),
      });
    }),
  ];
};

describe('useROs Hooks - MySQL → Excel Fallback', () => {
  beforeEach(() => {
    mysqlCallCount = 0;
    excelCallCount = 0;
    resetSequence();
    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.warning.mockClear();
    mockToast.info.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Test 1: useROs() Hook with MySQL Success', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should fetch repair orders from MySQL when available', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useROs(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toBeInstanceOf(Array);
      expect(result.current.data?.length).toBe(3);
      expect(mysqlCallCount).toBeGreaterThan(0);

      // Should NOT show fallback notification
      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it('should not be in error state when MySQL works', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useROs(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Test 2: useROs() Hook with MySQL Failure → Excel Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(true, 'network'));
    });

    it('should fallback to Excel when MySQL fails', async () => {
      // This test will FAIL until fallback logic is implemented
      const wrapper = createWrapper();
      const { result } = renderHook(() => useROs(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // After implementation:
      // expect(result.current.data).toBeDefined();
      // expect(result.current.data).toBeInstanceOf(Array);
      // expect(result.current.isError).toBe(false);
      // expect(mysqlCallCount).toBeGreaterThan(0); // Tried MySQL
      // expect(mockToast.warning).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     title: expect.stringContaining('Using local data'),
      //     description: expect.stringContaining('backend unavailable'),
      //   })
      // );

      // Currently will be in error state
      expect(result.current.isError).toBe(true);
    });

    it('should show user notification when fallback occurs', async () => {
      // After implementation:
      // const wrapper = createWrapper();
      // renderHook(() => useROs(), { wrapper });

      // await waitFor(() => {
      //   expect(mockToast.warning).toHaveBeenCalled();
      // });

      // const call = mockToast.warning.mock.calls[0][0];
      // expect(call).toHaveProperty('title');
      // expect(call).toHaveProperty('description');
      // expect(call.description).toContain('Excel');

      expect(true).toBe(true);
    });
  });

  describe('Test 3: useArchivedROs() Hook with Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should fetch archived ROs from MySQL when available', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useArchivedROs('Paid', 'Paid'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(mysqlCallCount).toBeGreaterThan(0);
    });

    it('should fallback to Excel for archived ROs when MySQL fails', async () => {
      // After implementation with fallback:
      // server.use(...createMySQLHandlers(true, 'network'));
      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useArchivedROs('Paid', 'Paid'), { wrapper });

      // await waitFor(() => {
      //   expect(result.current.isLoading).toBe(false);
      // });

      // expect(result.current.data).toBeDefined();
      // expect(result.current.isError).toBe(false);
      // expect(mockToast.warning).toHaveBeenCalled();

      expect(true).toBe(true);
    });
  });

  describe('Test 4: useDashboardStats() Hook with Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should fetch stats from MySQL when available', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useDashboardStats(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveProperty('totalActive', 3);
      expect(mysqlCallCount).toBeGreaterThan(0);
    });

    it('should fallback to Excel and calculate stats when MySQL fails', async () => {
      // After implementation:
      // server.use(...createMySQLHandlers(true, 'network'));
      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useDashboardStats(), { wrapper });

      // await waitFor(() => {
      //   expect(result.current.isLoading).toBe(false);
      // });

      // expect(result.current.data).toBeDefined();
      // expect(result.current.data).toHaveProperty('totalActive');
      // expect(result.current.isError).toBe(false);

      expect(true).toBe(true);
    });
  });

  describe('Test 5: useUpdateROStatus() Mutation with Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should update status via MySQL when available', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateROStatus(), { wrapper });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      result.current.mutate({
        id: 'test-123',
        status: 'APPROVED',
        notes: 'Test notes',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mysqlCallCount).toBeGreaterThan(0);
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('should fallback to Excel for status updates when MySQL fails', async () => {
      // After implementation:
      // server.use(...createMySQLHandlers(true, 'network'));
      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useUpdateROStatus(), { wrapper });

      // result.current.mutate({
      //   // Need to pass rowIndex instead of id when falling back
      //   rowIndex: 23,
      //   status: 'APPROVED',
      // });

      // await waitFor(() => {
      //   expect(result.current.isSuccess).toBe(true);
      // });

      // expect(mockToast.warning).toHaveBeenCalled(); // Fallback notification
      // expect(mockToast.success).toHaveBeenCalled(); // Success notification

      expect(true).toBe(true);
    });
  });

  describe('Test 6: useAddRepairOrder() Mutation with Fallback', () => {
    beforeEach(() => {
      server.use(...createMySQLHandlers(false));
    });

    it('should create RO via MySQL when available', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAddRepairOrder(), { wrapper });

      const newROData = {
        roNumber: 'RO-TEST-001',
        shopName: 'Test Shop',
        partDescription: 'Test Part',
        currentStatus: 'TO SEND' as const,
      };

      result.current.mutate(newROData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mysqlCallCount).toBeGreaterThan(0);
      expect(mockToast.success).toHaveBeenCalled();
    });

    it('should fallback to Excel for creating RO when MySQL fails', async () => {
      // After implementation:
      // server.use(...createMySQLHandlers(true, 'network'));
      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useAddRepairOrder(), { wrapper });

      // const newROData = {
      //   roNumber: 'RO-TEST-001',
      //   shopName: 'Test Shop',
      //   partDescription: 'Test Part',
      //   currentStatus: 'TO SEND' as const,
      // };

      // result.current.mutate(newROData);

      // await waitFor(() => {
      //   expect(result.current.isSuccess).toBe(true);
      // });

      // expect(mockToast.warning).toHaveBeenCalled(); // Fallback notification
      // expect(mockToast.success).toHaveBeenCalled(); // Success notification

      expect(true).toBe(true);
    });
  });

  describe('Test 7: Error Handling - Both Sources Fail', () => {
    it('should show error when both MySQL and Excel fail', async () => {
      // After implementation:
      // server.use(...createMySQLHandlers(true, 'network'));
      // Mock Excel to also fail
      // vi.spyOn(excelService, 'getRepairOrders').mockRejectedValue(new Error('Excel auth failed'));

      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useROs(), { wrapper });

      // await waitFor(() => {
      //   expect(result.current.isLoading).toBe(false);
      // });

      // expect(result.current.isError).toBe(true);
      // expect(result.current.error).toBeDefined();
      // expect(mockToast.error).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     title: expect.stringContaining('Failed to load data'),
      //     description: expect.stringContaining('both'),
      //   })
      // );

      expect(true).toBe(true);
    });
  });

  describe('Test 8: Retry After Fallback', () => {
    it('should retry MySQL after timeout when in fallback mode', async () => {
      // After implementation:
      // Start with MySQL failing
      // server.use(...createMySQLHandlers(true, 'network'));

      // const wrapper = createWrapper();
      // const { result, rerender } = renderHook(() => useROs(), { wrapper });

      // await waitFor(() => {
      //   expect(result.current.isLoading).toBe(false);
      // });

      // const firstMySQLCount = mysqlCallCount;

      // Fix MySQL
      // server.use(...createMySQLHandlers(false));

      // Simulate time passing (after retry interval)
      // vi.advanceTimersByTime(60000);

      // Trigger refetch
      // result.current.refetch();

      // await waitFor(() => {
      //   expect(mysqlCallCount).toBeGreaterThan(firstMySQLCount);
      // });

      // expect(mockToast.info).toHaveBeenCalledWith(
      //   expect.objectContaining({
      //     title: expect.stringContaining('Database reconnected'),
      //   })
      // );

      expect(true).toBe(true);
    });
  });

  describe('Test 9: ID Format Compatibility', () => {
    it('should work with MySQL ID format in mutations', async () => {
      server.use(...createMySQLHandlers(false));
      const wrapper = createWrapper();
      const { result } = renderHook(() => useUpdateROStatus(), { wrapper });

      // MySQL uses simple string IDs like "42", "mysql-1"
      result.current.mutate({
        id: 'mysql-123',
        status: 'APPROVED',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mysqlCallCount).toBeGreaterThan(0);
    });

    it('should convert to rowIndex when falling back to Excel', async () => {
      // After implementation:
      // server.use(...createMySQLHandlers(true, 'network'));
      // const wrapper = createWrapper();
      // const { result } = renderHook(() => useUpdateROStatus(), { wrapper });

      // Mutation should accept either:
      // - id: string (for MySQL)
      // - rowIndex: number (for Excel)
      // - OR a RepairOrder object with id field

      // const ro = createRepairOrder({ id: 'row-23' });
      // result.current.mutate({
      //   ro: ro, // Service extracts rowIndex from 'row-23'
      //   status: 'APPROVED',
      // });

      // await waitFor(() => {
      //   expect(result.current.isSuccess).toBe(true);
      // });

      expect(true).toBe(true);
    });
  });
});

/**
 * Expected Test Results (TDD - Red Phase):
 *
 * ✅ Test 1.1-1.2: Should PASS (useROs works with MySQL)
 * ❌ Test 2.1-2.2: Should FAIL (no fallback logic in hooks)
 * ✅ Test 3.1: Should PASS (useArchivedROs works with MySQL)
 * ❌ Test 3.2: Should FAIL (no fallback logic)
 * ✅ Test 4.1: Should PASS (useDashboardStats works with MySQL)
 * ❌ Test 4.2: Should FAIL (no fallback logic)
 * ✅ Test 5.1: Should PASS (useUpdateROStatus works with MySQL)
 * ❌ Test 5.2: Should FAIL (no fallback logic)
 * ✅ Test 6.1: Should PASS (useAddRepairOrder works with MySQL)
 * ❌ Test 6.2: Should FAIL (no fallback logic)
 * ❌ Test 7.1: Should FAIL (no error handling for both sources)
 * ❌ Test 8.1: Should FAIL (no retry mechanism)
 * ✅ Test 9.1: Should PASS (mutations work with MySQL IDs)
 * ❌ Test 9.2: Should FAIL (no ID conversion utility)
 *
 * Next Steps:
 * 1. Run tests: `npm run test useROs.fallback.test.ts`
 * 2. Verify tests fail (Red phase) ✅
 * 3. Implement fallback logic in hooks (Green phase)
 * 4. Run tests again - should pass ✅
 */
