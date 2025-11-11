import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useROs,
  useUpdateROStatus,
  useAddRepairOrder,
  useUpdateRepairOrder,
  useDeleteRepairOrder,
  useBulkUpdateStatus,
  useDashboardStats,
} from './useROs';
import { excelService } from '../lib/excelService';
import { mockRepairOrders } from '../test/mocks';
import { toast } from 'sonner';

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock dependencies
vi.mock('../lib/excelService', () => ({
  excelService: {
    getRepairOrders: vi.fn(),
    updateROStatus: vi.fn(),
    addRepairOrder: vi.fn(),
    updateRepairOrder: vi.fn(),
    deleteRepairOrder: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useROs hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useROs', () => {
    it('fetches repair orders successfully', async () => {
      vi.mocked(excelService.getRepairOrders).mockResolvedValue(mockRepairOrders);

      const { result } = renderHook(() => useROs(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRepairOrders);
      expect(excelService.getRepairOrders).toHaveBeenCalledTimes(1);
    });

    it('handles fetch error', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(excelService.getRepairOrders).mockRejectedValue(error);

      const { result } = renderHook(() => useROs(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('starts in loading state', () => {
      vi.mocked(excelService.getRepairOrders).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useROs(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useUpdateROStatus', () => {
    it('updates RO status successfully', async () => {
      vi.mocked(excelService.updateROStatus).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateROStatus(), { wrapper: createWrapper() });

      result.current.mutate({
        rowIndex: 1,
        status: 'IN PROGRESS',
        notes: 'Test note',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.updateROStatus).toHaveBeenCalledWith(
        1,
        'IN PROGRESS',
        'Test note',
        undefined,
        undefined
      );
      expect(toast.success).toHaveBeenCalledWith('Status updated successfully');
    });

    it('updates status with cost and delivery date', async () => {
      vi.mocked(excelService.updateROStatus).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateROStatus(), { wrapper: createWrapper() });

      const deliveryDate = new Date('2024-02-01');
      result.current.mutate({
        rowIndex: 1,
        status: 'APPROVED',
        notes: 'Approved',
        cost: 1500,
        deliveryDate,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.updateROStatus).toHaveBeenCalledWith(
        1,
        'APPROVED',
        'Approved',
        1500,
        deliveryDate
      );
    });

    it('handles update error', async () => {
      const error = new Error('Update failed');
      vi.mocked(excelService.updateROStatus).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateROStatus(), { wrapper: createWrapper() });

      result.current.mutate({
        rowIndex: 1,
        status: 'IN PROGRESS',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update status');
    });
  });

  describe('useAddRepairOrder', () => {
    it('adds repair order successfully', async () => {
      vi.mocked(excelService.addRepairOrder).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAddRepairOrder(), { wrapper: createWrapper() });

      const newRO = {
        roNumber: 'RO-003',
        shopName: 'Test Shop',
        partNumber: 'PART-123',
        serialNumber: 'SN-123',
        partDescription: 'Test Part',
        requiredWork: 'Repair',
      };

      result.current.mutate(newRO);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.addRepairOrder).toHaveBeenCalledWith(newRO);
      expect(toast.success).toHaveBeenCalledWith('Repair order created successfully');
    });

    it('adds repair order with optional fields', async () => {
      vi.mocked(excelService.addRepairOrder).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAddRepairOrder(), { wrapper: createWrapper() });

      const newRO = {
        roNumber: 'RO-003',
        shopName: 'Test Shop',
        partNumber: 'PART-123',
        serialNumber: 'SN-123',
        partDescription: 'Test Part',
        requiredWork: 'Repair',
        estimatedCost: 2000,
        terms: 'NET 30',
        shopReferenceNumber: 'SHOP-REF-123',
      };

      result.current.mutate(newRO);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.addRepairOrder).toHaveBeenCalledWith(newRO);
    });

    it('handles add error', async () => {
      const error = new Error('Add failed');
      vi.mocked(excelService.addRepairOrder).mockRejectedValue(error);

      const { result } = renderHook(() => useAddRepairOrder(), { wrapper: createWrapper() });

      result.current.mutate({
        roNumber: 'RO-003',
        shopName: 'Test Shop',
        partNumber: 'PART-123',
        serialNumber: 'SN-123',
        partDescription: 'Test Part',
        requiredWork: 'Repair',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to create repair order');
    });
  });

  describe('useUpdateRepairOrder', () => {
    it('updates repair order successfully', async () => {
      vi.mocked(excelService.updateRepairOrder).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateRepairOrder(), { wrapper: createWrapper() });

      const updateData = {
        rowIndex: 1,
        data: {
          roNumber: 'RO-001',
          shopName: 'Updated Shop',
          partNumber: 'PART-123',
          serialNumber: 'SN-123',
          partDescription: 'Updated Part',
          requiredWork: 'Updated work',
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.updateRepairOrder).toHaveBeenCalledWith(1, updateData.data);
      expect(toast.success).toHaveBeenCalledWith('Repair order updated successfully');
    });

    it('handles update error', async () => {
      const error = new Error('Update failed');
      vi.mocked(excelService.updateRepairOrder).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateRepairOrder(), { wrapper: createWrapper() });

      result.current.mutate({
        rowIndex: 1,
        data: {
          roNumber: 'RO-001',
          shopName: 'Shop',
          partNumber: 'PART-123',
          serialNumber: 'SN-123',
          partDescription: 'Part',
          requiredWork: 'Work',
        },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update repair order');
    });
  });

  describe('useDeleteRepairOrder', () => {
    it('deletes repair order successfully', async () => {
      vi.mocked(excelService.deleteRepairOrder).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteRepairOrder(), { wrapper: createWrapper() });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.deleteRepairOrder).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Repair order deleted successfully');
    });

    it('handles delete error', async () => {
      const error = new Error('Delete failed');
      vi.mocked(excelService.deleteRepairOrder).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteRepairOrder(), { wrapper: createWrapper() });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete repair order');
    });
  });

  describe('useBulkUpdateStatus', () => {
    it('updates multiple ROs successfully', async () => {
      vi.mocked(excelService.getRepairOrders).mockResolvedValue(mockRepairOrders);
      vi.mocked(excelService.updateROStatus).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkUpdateStatus(), { wrapper: createWrapper() });

      result.current.mutate({
        roNumbers: ['RO-001', 'RO-002'],
        newStatus: 'TO SEND',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(excelService.updateROStatus).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('Successfully updated 2 repair orders');
    });

    it('handles singular form for one RO', async () => {
      vi.mocked(excelService.getRepairOrders).mockResolvedValue(mockRepairOrders);
      vi.mocked(excelService.updateROStatus).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkUpdateStatus(), { wrapper: createWrapper() });

      result.current.mutate({
        roNumbers: ['RO-001'],
        newStatus: 'TO SEND',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(toast.success).toHaveBeenCalledWith('Successfully updated 1 repair order');
    });

    it('handles RO not found error', async () => {
      vi.mocked(excelService.getRepairOrders).mockResolvedValue(mockRepairOrders);

      const { result } = renderHook(() => useBulkUpdateStatus(), { wrapper: createWrapper() });

      result.current.mutate({
        roNumbers: ['RO-999'],
        newStatus: 'TO SEND',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update repair orders');
    });
  });

  describe('useDashboardStats', () => {
    it('calculates dashboard stats correctly', async () => {
      vi.mocked(excelService.getRepairOrders).mockResolvedValue(mockRepairOrders);

      const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const stats = result.current.data!;

      expect(stats).toBeDefined();
      expect(stats.totalActive).toBe(2); // Both test ROs are active
      expect(stats.overdue).toBe(1); // RO-002 is overdue
      expect(stats.waitingQuote).toBe(1); // RO-002 is waiting quote
      expect(typeof stats.totalValue).toBe('number');
    });

    it('filters out completed ROs from active count', async () => {
      const rosWithCompleted = [
        ...mockRepairOrders,
        {
          ...mockRepairOrders[0],
          id: 'row-3',
          roNumber: 'RO-003',
          currentStatus: 'PAID',
        },
        {
          ...mockRepairOrders[0],
          id: 'row-4',
          roNumber: 'RO-004',
          currentStatus: 'PAYMENT SENT',
        },
      ];

      vi.mocked(excelService.getRepairOrders).mockResolvedValue(rosWithCompleted);

      const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should only count the 2 active ROs, not the PAID or PAYMENT SENT ones
      expect(result.current.data!.totalActive).toBe(2);
    });

    it('calculates total value correctly', async () => {
      const rosWithCosts = [
        { ...mockRepairOrders[0], finalCost: 1000 },
        { ...mockRepairOrders[1], finalCost: 2000 },
      ];

      vi.mocked(excelService.getRepairOrders).mockResolvedValue(rosWithCosts);

      const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data!.totalValue).toBe(3000);
    });

    it('handles null costs in total value calculation', async () => {
      const rosWithNullCosts = [
        { ...mockRepairOrders[0], finalCost: 1000 },
        { ...mockRepairOrders[1], finalCost: null },
      ];

      vi.mocked(excelService.getRepairOrders).mockResolvedValue(rosWithNullCosts);

      const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data!.totalValue).toBe(1000);
    });

    it('handles fetch error', async () => {
      const error = new Error('Failed to fetch');
      vi.mocked(excelService.getRepairOrders).mockRejectedValue(error);

      const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });
});
