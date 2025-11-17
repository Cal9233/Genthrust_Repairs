import { describe, it, expect } from 'vitest';
import {
  updateRepairOrderSchema,
  queryRepairOrdersSchema,
  searchInventorySchema,
  createROFromInventorySchema,
  checkLowStockSchema,
  validateInput,
} from './aiToolSchemas';

describe('AI Tool Validation', () => {
  describe('RO Number Validation', () => {
    it('accepts valid RO numbers', () => {
      const validNumbers = ['38462', 'G38462', 'RO38462', 'RO-38462'];

      validNumbers.forEach(roNum => {
        const result = validateInput(updateRepairOrderSchema, {
          ro_number: roNum,
          updates: { status: 'PAID' }
        });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid RO numbers', () => {
      const invalidNumbers = ['', 'ABC', 'RO-ABC-123', '12345678901234567890X'];

      invalidNumbers.forEach(roNum => {
        const result = validateInput(updateRepairOrderSchema, {
          ro_number: roNum,
          updates: { status: 'PAID' }
        });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Status Validation', () => {
    it('accepts valid statuses', () => {
      const validStatuses = ['TO SEND', 'WAITING QUOTE', 'APPROVED', 'PAID', 'RAI', 'BER'];

      validStatuses.forEach(status => {
        const result = validateInput(updateRepairOrderSchema, {
          ro_number: '38462',
          updates: { status }
        });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid statuses', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: '38462',
        updates: { status: 'INVALID_STATUS' }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid status');
    });
  });

  describe('Cost Validation', () => {
    it('accepts valid costs', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: '38462',
        updates: { cost: 1234.56 }
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative costs', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: '38462',
        updates: { cost: -100 }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('positive');
    });

    it('rejects excessive costs', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: '38462',
        updates: { cost: 2000000 }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('exceeds maximum');
    });
  });

  describe('Query Filters Validation', () => {
    it('validates date range order', () => {
      const result = validateInput(queryRepairOrdersSchema, {
        filters: {
          date_range: {
            start: '2025-12-31',
            end: '2025-01-01'
          }
        }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('before or equal');
    });

    it('validates min/max cost relationship', () => {
      const result = validateInput(queryRepairOrdersSchema, {
        filters: {
          min_cost: 1000,
          max_cost: 500
        }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('less than or equal');
    });
  });

  describe('Part Number Validation', () => {
    it('accepts valid part numbers with dashes', () => {
      const result = validateInput(searchInventorySchema, {
        part_number: 'MS20470AD4-6'
      });

      expect(result.success).toBe(true);
    });

    it('rejects part numbers with invalid characters', () => {
      const result = validateInput(searchInventorySchema, {
        part_number: 'MS20470@AD4-6'
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('letters, numbers, and dashes');
    });
  });

  describe('Inventory RO Creation Validation', () => {
    it('requires minimum required work description length', () => {
      const result = validateInput(createROFromInventorySchema, {
        part_number: 'MS20470AD4-6',
        shop_name: 'Duncan Aviation',
        ro_number: 'RO-12345',
        serial_number: 'SN123',
        required_work: 'Fix' // Too short
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('too short');
    });

    it('accepts valid RO creation data', () => {
      const result = validateInput(createROFromInventorySchema, {
        part_number: 'MS20470AD4-6',
        shop_name: 'Duncan Aviation',
        ro_number: 'RO-12345',
        serial_number: 'SN123',
        required_work: 'Overhaul and inspection required',
        estimated_cost: 5000
      });

      expect(result.success).toBe(true);
    });
  });
});
