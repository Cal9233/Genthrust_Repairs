import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useShops,
  useAddShop,
  useUpdateShop,
  useDeleteShop,
} from '../../src/hooks/useShops';
import { shopService } from '../../src/lib/shopService';
import { mockShops } from '../../src/test/mocks';
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
vi.mock('../lib/shopService', () => ({
  shopService: {
    getShops: vi.fn(),
    addShop: vi.fn(),
    updateShop: vi.fn(),
    deleteShop: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useShops hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useShops', () => {
    it('fetches shops successfully', async () => {
      vi.mocked(shopService.getShops).mockResolvedValue(mockShops);

      const { result } = renderHook(() => useShops(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockShops);
      expect(shopService.getShops).toHaveBeenCalledTimes(1);
    });

    it('handles fetch error', async () => {
      const error = new Error('Failed to fetch shops');
      vi.mocked(shopService.getShops).mockRejectedValue(error);

      const { result } = renderHook(() => useShops(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });

    it('starts in loading state', () => {
      vi.mocked(shopService.getShops).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useShops(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('returns empty array when no shops exist', async () => {
      vi.mocked(shopService.getShops).mockResolvedValue([]);

      const { result } = renderHook(() => useShops(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useAddShop', () => {
    it('adds shop successfully with all fields', async () => {
      vi.mocked(shopService.addShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAddShop(), { wrapper: createWrapper() });

      const newShop = {
        customerNumber: 'CUST003',
        businessName: 'New Test Shop',
        addressLine1: '789 Oak St',
        addressLine2: 'Suite 100',
        addressLine3: '',
        addressLine4: '',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
        phone: '555-0103',
        tollFree: '800-555-0103',
        fax: '555-0104',
        email: 'info@newtestshop.com',
        website: 'www.newtestshop.com',
        contact: 'Bob Johnson',
        paymentTerms: 'NET 30',
        ilsCode: 'ILS003',
      };

      result.current.mutate(newShop);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.addShop).toHaveBeenCalledWith(newShop);
      expect(toast.success).toHaveBeenCalledWith('Vendor added successfully');
    });

    it('adds shop with minimal required fields', async () => {
      vi.mocked(shopService.addShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAddShop(), { wrapper: createWrapper() });

      const newShop = {
        businessName: 'Minimal Shop',
      };

      result.current.mutate(newShop);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.addShop).toHaveBeenCalledWith(newShop);
      expect(toast.success).toHaveBeenCalledWith('Vendor added successfully');
    });

    it('handles add error', async () => {
      const error = new Error('Add failed');
      vi.mocked(shopService.addShop).mockRejectedValue(error);

      const { result } = renderHook(() => useAddShop(), { wrapper: createWrapper() });

      result.current.mutate({
        businessName: 'Test Shop',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to add vendor');
    });

    it('handles duplicate shop error', async () => {
      const error = new Error('Shop already exists');
      vi.mocked(shopService.addShop).mockRejectedValue(error);

      const { result } = renderHook(() => useAddShop(), { wrapper: createWrapper() });

      result.current.mutate({
        businessName: 'Existing Shop',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to add vendor');
    });
  });

  describe('useUpdateShop', () => {
    it('updates shop successfully', async () => {
      vi.mocked(shopService.updateShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateShop(), { wrapper: createWrapper() });

      const updateData = {
        rowIndex: 1,
        data: {
          customerNumber: 'CUST001',
          businessName: 'Updated Test Shop',
          addressLine1: '123 Main St',
          addressLine2: 'Suite 200',
          addressLine3: '',
          addressLine4: '',
          city: 'Updated City',
          state: 'CA',
          zip: '90001',
          country: 'USA',
          phone: '555-9999',
          tollFree: '800-555-9999',
          fax: '555-9998',
          email: 'updated@testshop.com',
          website: 'www.updatedshop.com',
          contact: 'Updated Contact',
          paymentTerms: 'NET 45',
          ilsCode: 'ILS001',
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.updateShop).toHaveBeenCalledWith(1, updateData.data);
      expect(toast.success).toHaveBeenCalledWith('Vendor updated successfully');
    });

    it('updates shop with changed email', async () => {
      vi.mocked(shopService.updateShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdateShop(), { wrapper: createWrapper() });

      const updateData = {
        rowIndex: 1,
        data: {
          customerNumber: 'CUST001',
          businessName: 'Test Shop',
          addressLine1: '',
          addressLine2: '',
          addressLine3: '',
          addressLine4: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          phone: '',
          tollFree: '',
          fax: '',
          email: 'newemail@testshop.com', // Changed email
          website: '',
          contact: '',
          paymentTerms: '',
          ilsCode: '',
        },
      };

      result.current.mutate(updateData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.updateShop).toHaveBeenCalledWith(1, updateData.data);
    });

    it('handles update error', async () => {
      const error = new Error('Update failed');
      vi.mocked(shopService.updateShop).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateShop(), { wrapper: createWrapper() });

      result.current.mutate({
        rowIndex: 1,
        data: {
          customerNumber: '',
          businessName: 'Test',
          addressLine1: '',
          addressLine2: '',
          addressLine3: '',
          addressLine4: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          phone: '',
          tollFree: '',
          fax: '',
          email: '',
          website: '',
          contact: '',
          paymentTerms: '',
          ilsCode: '',
        },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update vendor');
    });

    it('handles invalid row index error', async () => {
      const error = new Error('Row not found');
      vi.mocked(shopService.updateShop).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateShop(), { wrapper: createWrapper() });

      result.current.mutate({
        rowIndex: 999,
        data: {
          customerNumber: '',
          businessName: 'Test',
          addressLine1: '',
          addressLine2: '',
          addressLine3: '',
          addressLine4: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          phone: '',
          tollFree: '',
          fax: '',
          email: '',
          website: '',
          contact: '',
          paymentTerms: '',
          ilsCode: '',
        },
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update vendor');
    });
  });

  describe('useDeleteShop', () => {
    it('deletes shop successfully', async () => {
      vi.mocked(shopService.deleteShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteShop(), { wrapper: createWrapper() });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.deleteShop).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith('Vendor deleted successfully');
    });

    it('deletes shop at different row index', async () => {
      vi.mocked(shopService.deleteShop).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteShop(), { wrapper: createWrapper() });

      result.current.mutate(5);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(shopService.deleteShop).toHaveBeenCalledWith(5);
    });

    it('handles delete error', async () => {
      const error = new Error('Delete failed');
      vi.mocked(shopService.deleteShop).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteShop(), { wrapper: createWrapper() });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete vendor');
    });

    it('handles invalid row index error', async () => {
      const error = new Error('Row not found');
      vi.mocked(shopService.deleteShop).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteShop(), { wrapper: createWrapper() });

      result.current.mutate(999);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete vendor');
    });

    it('handles permission error', async () => {
      const error = new Error('Permission denied');
      vi.mocked(shopService.deleteShop).mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteShop(), { wrapper: createWrapper() });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to delete vendor');
    });
  });
});
