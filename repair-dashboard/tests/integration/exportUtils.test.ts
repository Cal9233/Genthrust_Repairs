import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV } from '../../src/lib/exportUtils';
import { mockRepairOrders } from '../../src/test/mocks';

// Mock URL.createObjectURL and related DOM APIs
globalThis.URL.createObjectURL = vi.fn(() => 'mock-url');
globalThis.URL.revokeObjectURL = vi.fn();

describe('exportUtils', () => {
  let mockLink: any;

  beforeEach(() => {
    // Mock document.createElement and link element
    mockLink = {
      click: vi.fn(),
      setAttribute: vi.fn(),
      href: '',
      download: '',
      style: {},
      remove: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink);
  });

  describe('exportToCSV', () => {
    it('should create a CSV file with correct headers', () => {
      exportToCSV(mockRepairOrders, 'test.csv');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should include all repair order data', () => {
      exportToCSV(mockRepairOrders, 'test.csv');

      const createObjectURLCall = vi.mocked(globalThis.URL.createObjectURL).mock.calls[0][0] as Blob;
      expect(createObjectURLCall.type).toBe('text/csv;charset=utf-8;');
    });

    it('should handle empty repair orders array', () => {
      exportToCSV([], 'empty.csv');

      // Empty array returns early, so click is not called
      expect(mockLink.click).not.toHaveBeenCalled();
    });

    it('should use default filename if not provided', () => {
      exportToCSV(mockRepairOrders, 'repair_orders.csv');

      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'repair_orders.csv');
    });

    it('should clean up after download', () => {
      exportToCSV(mockRepairOrders, 'test.csv');

      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });
  });
});
