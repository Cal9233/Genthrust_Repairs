/**
 * TDD Test Suite: Delete Repair Order by RO Number
 *
 * v2.5.0 - Delete RO by RO Number Refactor
 *
 * Problem: Delete operation fails because of ID system mismatch
 * - MySQL uses auto-increment IDs (e.g., "123")
 * - Excel uses array indices (e.g., "row-87")
 * - UI passes wrong format to backend causing 400 errors
 *
 * Solution: Use roNumber as universal identifier
 * - roNumber (e.g., "RO-38462") is stable and unique across both sources
 * - MySQL: DELETE FROM table WHERE RO = ?
 * - Excel: Find index by roNumber, then DELETE rows/itemAt(index=X)
 *
 * Test Strategy:
 * 1. Mock both MySQL and Excel services accurately
 * 2. Test MySQL primary path (success)
 * 3. Test Excel fallback path (MySQL fails, Excel succeeds)
 * 4. Test both sources fail scenario
 * 5. Test RO not found scenarios
 * 6. Test backward compatibility with old ID-based delete
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { RepairOrder } from '../../src/types';

// ============================================================================
// MOCK DATA FACTORIES (Production-accurate)
// ============================================================================

let sequenceId = 1;
const resetSequence = () => { sequenceId = 1; };

/**
 * Create a RepairOrder with MySQL-style ID (auto-increment)
 */
const createMySQLRepairOrder = (overrides?: Partial<RepairOrder>): RepairOrder => {
  const id = sequenceId++;
  return {
    id: String(id), // MySQL: "123", "456"
    roNumber: `RO-${String(id).padStart(5, '0')}`,
    dateMade: new Date('2024-01-15'),
    shopName: 'Duncan Aviation',
    partNumber: `PN-${id}`,
    serialNumber: `SN-${id}`,
    partDescription: 'Hydraulic Pump Assembly',
    requiredWork: 'Overhaul and test',
    dateDroppedOff: new Date('2024-01-16'),
    estimatedCost: 5000,
    finalCost: null,
    terms: 'NET 30',
    shopReferenceNumber: `SHOP-REF-${id}`,
    estimatedDeliveryDate: new Date('2024-02-15'),
    currentStatus: 'WAITING QUOTE',
    currentStatusDate: new Date('2024-01-16'),
    genThrustStatus: 'Active',
    shopStatus: '',
    trackingNumber: '',
    notes: '',
    lastDateUpdated: new Date('2024-01-16'),
    nextDateToUpdate: new Date('2024-01-30'),
    statusHistory: [],
    archiveStatus: 'ACTIVE',
    isOverdue: false,
    daysOverdue: 0,
    ...overrides
  };
};

/**
 * Create a RepairOrder with Excel-style ID (row-index)
 */
const createExcelRepairOrder = (index: number, overrides?: Partial<RepairOrder>): RepairOrder => {
  return {
    id: `row-${index}`, // Excel: "row-0", "row-87"
    roNumber: `RO-${String(index + 1000).padStart(5, '0')}`,
    dateMade: new Date('2024-01-15'),
    shopName: 'Duncan Aviation',
    partNumber: `PN-${index}`,
    serialNumber: `SN-${index}`,
    partDescription: 'Hydraulic Pump Assembly',
    requiredWork: 'Overhaul and test',
    dateDroppedOff: new Date('2024-01-16'),
    estimatedCost: 5000,
    finalCost: null,
    terms: 'NET 30',
    shopReferenceNumber: `SHOP-REF-${index}`,
    estimatedDeliveryDate: new Date('2024-02-15'),
    currentStatus: 'WAITING QUOTE',
    currentStatusDate: new Date('2024-01-16'),
    genThrustStatus: 'Active',
    shopStatus: '',
    trackingNumber: '',
    notes: '',
    lastDateUpdated: new Date('2024-01-16'),
    nextDateToUpdate: new Date('2024-01-30'),
    statusHistory: [],
    archiveStatus: 'ACTIVE',
    isOverdue: false,
    daysOverdue: 0,
    ...overrides
  };
};

// ============================================================================
// MOCK SERVICES (Production-accurate behavior simulation)
// ============================================================================

/**
 * Mock MySQL Backend Service (via Netlify Functions)
 * Simulates: /.netlify/functions/api/ros/*
 */
class MockMySQLService {
  private database: Map<string, RepairOrder[]> = new Map();
  private shouldFail: boolean = false;
  private failureType: 'network' | 'server' | 'notfound' = 'network';

  constructor() {
    this.reset();
  }

  reset() {
    this.shouldFail = false;
    this.failureType = 'network';
    // Initialize with test data across 4 tables
    this.database.set('active', [
      createMySQLRepairOrder({ id: '1', roNumber: 'RO-38462', archiveStatus: 'ACTIVE' }),
      createMySQLRepairOrder({ id: '2', roNumber: 'RO-38463', archiveStatus: 'ACTIVE' }),
      createMySQLRepairOrder({ id: '3', roNumber: 'RO-38464', archiveStatus: 'ACTIVE' }),
    ]);
    this.database.set('paid', [
      createMySQLRepairOrder({ id: '100', roNumber: 'RO-30001', archiveStatus: 'PAID' }),
    ]);
    this.database.set('net', [
      createMySQLRepairOrder({ id: '200', roNumber: 'RO-20001', archiveStatus: 'NET' }),
    ]);
    this.database.set('returns', [
      createMySQLRepairOrder({ id: '300', roNumber: 'RO-10001', archiveStatus: 'RETURNED' }),
    ]);
  }

  setFailure(shouldFail: boolean, type: 'network' | 'server' | 'notfound' = 'network') {
    this.shouldFail = shouldFail;
    this.failureType = type;
  }

  /**
   * DELETE /ros/by-number/:roNumber
   * New endpoint that searches all 4 tables by roNumber
   */
  async deleteByRONumber(roNumber: string): Promise<{ success: boolean; message: string }> {
    if (this.shouldFail) {
      if (this.failureType === 'network') {
        throw new Error('Network error: Failed to fetch');
      } else if (this.failureType === 'server') {
        throw new Error('HTTP 500: Internal server error');
      }
    }

    // Search all 4 tables for the RO
    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      const index = table.findIndex(ro => ro.roNumber === roNumber);

      if (index !== -1) {
        // Found! Delete it
        table.splice(index, 1);
        this.database.set(tableName, table);
        return { success: true, message: `Repair order ${roNumber} deleted from ${tableName}` };
      }
    }

    // Not found in any table
    if (this.failureType === 'notfound') {
      throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
    }
    throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
  }

  /**
   * DELETE /ros/:id (legacy - by MySQL ID)
   */
  async deleteById(id: string): Promise<{ success: boolean; message: string }> {
    if (this.shouldFail) {
      if (this.failureType === 'network') {
        throw new Error('Network error: Failed to fetch');
      } else if (this.failureType === 'server') {
        throw new Error('HTTP 500: Internal server error');
      }
    }

    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      const index = table.findIndex(ro => ro.id === id);

      if (index !== -1) {
        const roNumber = table[index].roNumber;
        table.splice(index, 1);
        this.database.set(tableName, table);
        return { success: true, message: `Repair order ${roNumber} deleted` };
      }
    }

    throw new Error(`HTTP 404: Repair order with id ${id} not found`);
  }

  // Helper to check if RO exists
  exists(roNumber: string): boolean {
    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      if (table.some(ro => ro.roNumber === roNumber)) {
        return true;
      }
    }
    return false;
  }

  getCount(): number {
    let count = 0;
    this.database.forEach(table => count += table.length);
    return count;
  }
}

/**
 * Mock Excel Service (via Graph API)
 * Simulates: RepairOrderRepository operations
 */
class MockExcelService {
  private data: RepairOrder[] = [];
  private shouldFail: boolean = false;
  private failureType: 'network' | 'auth' | 'badindex' = 'network';

  constructor() {
    this.reset();
  }

  reset() {
    this.shouldFail = false;
    this.failureType = 'network';
    // Initialize with Excel-style indexed data
    this.data = [
      createExcelRepairOrder(0, { roNumber: 'RO-38462' }),
      createExcelRepairOrder(1, { roNumber: 'RO-38463' }),
      createExcelRepairOrder(2, { roNumber: 'RO-38464' }),
      createExcelRepairOrder(3, { roNumber: 'RO-38465' }),
    ];
  }

  setFailure(shouldFail: boolean, type: 'network' | 'auth' | 'badindex' = 'network') {
    this.shouldFail = shouldFail;
    this.failureType = type;
  }

  /**
   * Get all repair orders from Excel table
   */
  async getRepairOrders(): Promise<RepairOrder[]> {
    if (this.shouldFail && this.failureType === 'auth') {
      throw new Error('MSAL authentication failed: Token expired');
    }
    if (this.shouldFail && this.failureType === 'network') {
      throw new Error('Network error: Graph API unreachable');
    }
    return [...this.data];
  }

  /**
   * Delete repair order by row index
   * DELETE /workbook/tables/RepairTable/rows/itemAt(index=X)
   */
  async deleteRepairOrder(rowIndex: number): Promise<void> {
    if (this.shouldFail) {
      if (this.failureType === 'network') {
        throw new Error('Network error: Graph API unreachable');
      } else if (this.failureType === 'auth') {
        throw new Error('MSAL authentication failed: Token expired');
      } else if (this.failureType === 'badindex') {
        throw new Error('Graph API error: 400 - Invalid row index');
      }
    }

    // Validate index exists
    if (rowIndex < 0 || rowIndex >= this.data.length) {
      throw new Error(`Graph API error: 400 - Row index ${rowIndex} out of bounds (table has ${this.data.length} rows)`);
    }

    // Delete the row
    this.data.splice(rowIndex, 1);

    // Re-index remaining rows (this is what happens in real Excel)
    this.data = this.data.map((ro, idx) => ({
      ...ro,
      id: `row-${idx}`
    }));
  }

  /**
   * NEW: Delete repair order by roNumber
   * 1. Fetch all ROs
   * 2. Find index where roNumber matches
   * 3. Delete by index
   */
  async deleteRepairOrderByRONumber(roNumber: string): Promise<void> {
    // First, get current data to find the index
    const currentData = await this.getRepairOrders();
    const targetIndex = currentData.findIndex(ro => ro.roNumber === roNumber);

    if (targetIndex === -1) {
      throw new Error(`Repair order ${roNumber} not found in Excel`);
    }

    // Now delete by the found index
    await this.deleteRepairOrder(targetIndex);
  }

  // Helper methods
  exists(roNumber: string): boolean {
    return this.data.some(ro => ro.roNumber === roNumber);
  }

  getCount(): number {
    return this.data.length;
  }

  findIndexByRONumber(roNumber: string): number {
    return this.data.findIndex(ro => ro.roNumber === roNumber);
  }
}

/**
 * Mock Hybrid Data Service
 * This is what we're building - MySQL first, Excel fallback
 */
class MockHybridDataService {
  private mysql: MockMySQLService;
  private excel: MockExcelService;
  private fallbackMode: boolean = false;
  private lastError: { mysql?: Error; excel?: Error } = {};

  // Metrics for testing
  public metrics = {
    mysqlAttempts: 0,
    mysqlSuccesses: 0,
    mysqlFailures: 0,
    excelAttempts: 0,
    excelSuccesses: 0,
    excelFailures: 0,
    fallbacksTriggered: 0
  };

  constructor(mysql: MockMySQLService, excel: MockExcelService) {
    this.mysql = mysql;
    this.excel = excel;
  }

  resetMetrics() {
    this.metrics = {
      mysqlAttempts: 0,
      mysqlSuccesses: 0,
      mysqlFailures: 0,
      excelAttempts: 0,
      excelSuccesses: 0,
      excelFailures: 0,
      fallbacksTriggered: 0
    };
    this.lastError = {};
    this.fallbackMode = false;
  }

  isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  getLastError(): { mysql?: Error; excel?: Error } {
    return this.lastError;
  }

  /**
   * NEW METHOD: Delete repair order by RO Number
   * Primary: MySQL (search by roNumber, delete)
   * Fallback: Excel (fetch all, find index, delete by index)
   */
  async deleteRepairOrderByNumber(roNumber: string): Promise<void> {
    this.lastError = {};

    // TRY MYSQL FIRST
    try {
      this.metrics.mysqlAttempts++;
      await this.mysql.deleteByRONumber(roNumber);
      this.metrics.mysqlSuccesses++;
      this.fallbackMode = false;
      return; // Success!
    } catch (mysqlError) {
      this.metrics.mysqlFailures++;
      this.lastError.mysql = mysqlError as Error;

      // Check if it's a "not found" error (don't fallback for not found)
      if ((mysqlError as Error).message.includes('404')) {
        // RO not found in MySQL - try Excel
      } else {
        // Network/server error - trigger fallback
        this.metrics.fallbacksTriggered++;
      }
    }

    // FALLBACK TO EXCEL
    try {
      this.metrics.excelAttempts++;
      await this.excel.deleteRepairOrderByRONumber(roNumber);
      this.metrics.excelSuccesses++;
      this.fallbackMode = true;
      return; // Success via fallback!
    } catch (excelError) {
      this.metrics.excelFailures++;
      this.lastError.excel = excelError as Error;
    }

    // BOTH FAILED
    throw new Error(
      `Both MySQL and Excel failed for deleteRepairOrder.\n` +
      `MySQL error: ${this.lastError.mysql?.message || 'Unknown'}\n` +
      `Excel error: ${this.lastError.excel?.message || 'Unknown'}`
    );
  }

  /**
   * LEGACY: Delete repair order by ID (for backward compatibility)
   * Uses the old logic that caused the bug
   */
  async deleteRepairOrder(idOrRowIndex: string | number): Promise<void> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    this.lastError = {};

    // TRY MYSQL FIRST (if it's a string ID)
    if (!isExcelRowIndex) {
      try {
        this.metrics.mysqlAttempts++;
        await this.mysql.deleteById(idOrRowIndex as string);
        this.metrics.mysqlSuccesses++;
        return;
      } catch (mysqlError) {
        this.metrics.mysqlFailures++;
        this.lastError.mysql = mysqlError as Error;
        // Cannot fallback to Excel with string ID
        throw new Error(`Cannot delete MySQL record via Excel. MySQL error: ${(mysqlError as Error).message}`);
      }
    }

    // TRY EXCEL (if it's a number index)
    if (isExcelRowIndex) {
      try {
        this.metrics.excelAttempts++;
        await this.excel.deleteRepairOrder(idOrRowIndex as number);
        this.metrics.excelSuccesses++;
        return;
      } catch (excelError) {
        this.metrics.excelFailures++;
        this.lastError.excel = excelError as Error;
        throw new Error(`Excel delete failed: ${(excelError as Error).message}`);
      }
    }
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('HybridDataService - Delete by RO Number', () => {
  let mysqlService: MockMySQLService;
  let excelService: MockExcelService;
  let hybridService: MockHybridDataService;

  beforeEach(() => {
    resetSequence();
    mysqlService = new MockMySQLService();
    excelService = new MockExcelService();
    hybridService = new MockHybridDataService(mysqlService, excelService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // TEST GROUP 1: MySQL Primary Path (Happy Path)
  // ==========================================================================
  describe('Test 1: MySQL Primary Path (Success)', () => {
    it('1.1 - should delete RO from MySQL active table by roNumber', async () => {
      const roNumber = 'RO-38462';
      expect(mysqlService.exists(roNumber)).toBe(true);
      const initialCount = mysqlService.getCount();

      await hybridService.deleteRepairOrderByNumber(roNumber);

      expect(mysqlService.exists(roNumber)).toBe(false);
      expect(mysqlService.getCount()).toBe(initialCount - 1);
      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });

    it('1.2 - should delete RO from MySQL paid archive by roNumber', async () => {
      const roNumber = 'RO-30001';
      expect(mysqlService.exists(roNumber)).toBe(true);

      await hybridService.deleteRepairOrderByNumber(roNumber);

      expect(mysqlService.exists(roNumber)).toBe(false);
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('1.3 - should not enter fallback mode when MySQL succeeds', async () => {
      await hybridService.deleteRepairOrderByNumber('RO-38462');

      expect(hybridService.isInFallbackMode()).toBe(false);
      expect(hybridService.metrics.fallbacksTriggered).toBe(0);
    });

    it('1.4 - should handle multiple deletes correctly', async () => {
      await hybridService.deleteRepairOrderByNumber('RO-38462');
      await hybridService.deleteRepairOrderByNumber('RO-38463');
      await hybridService.deleteRepairOrderByNumber('RO-38464');

      expect(hybridService.metrics.mysqlSuccesses).toBe(3);
      expect(mysqlService.exists('RO-38462')).toBe(false);
      expect(mysqlService.exists('RO-38463')).toBe(false);
      expect(mysqlService.exists('RO-38464')).toBe(false);
    });
  });

  // ==========================================================================
  // TEST GROUP 2: Excel Fallback Path
  // ==========================================================================
  describe('Test 2: Excel Fallback Path (MySQL Fails)', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
    });

    it('2.1 - should fallback to Excel when MySQL network fails', async () => {
      const roNumber = 'RO-38462';
      expect(excelService.exists(roNumber)).toBe(true);

      await hybridService.deleteRepairOrderByNumber(roNumber);

      expect(excelService.exists(roNumber)).toBe(false);
      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(1);
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('2.2 - should enter fallback mode after MySQL failure', async () => {
      await hybridService.deleteRepairOrderByNumber('RO-38462');

      expect(hybridService.isInFallbackMode()).toBe(true);
      expect(hybridService.metrics.fallbacksTriggered).toBe(1);
    });

    it('2.3 - should fallback on MySQL server error (500)', async () => {
      mysqlService.setFailure(true, 'server');
      const roNumber = 'RO-38463';

      await hybridService.deleteRepairOrderByNumber(roNumber);

      expect(excelService.exists(roNumber)).toBe(false);
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('2.4 - should correctly find and delete by roNumber in Excel', async () => {
      // RO-38464 is at index 2 in Excel
      const roNumber = 'RO-38464';
      const initialIndex = excelService.findIndexByRONumber(roNumber);
      expect(initialIndex).toBe(2);

      await hybridService.deleteRepairOrderByNumber(roNumber);

      expect(excelService.exists(roNumber)).toBe(false);
      expect(excelService.getCount()).toBe(3); // 4 - 1 = 3
    });

    it('2.5 - Excel should re-index after delete', async () => {
      // Delete middle item (index 1)
      await hybridService.deleteRepairOrderByNumber('RO-38463');

      // After delete, RO-38464 should move from index 2 to index 1
      const newIndex = excelService.findIndexByRONumber('RO-38464');
      expect(newIndex).toBe(1); // Shifted down
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Both Sources Fail
  // ==========================================================================
  describe('Test 3: Both Sources Fail', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
      excelService.setFailure(true, 'network');
    });

    it('3.1 - should throw error when both MySQL and Excel fail', async () => {
      await expect(
        hybridService.deleteRepairOrderByNumber('RO-38462')
      ).rejects.toThrow('Both MySQL and Excel failed');
    });

    it('3.2 - should include both error messages in thrown error', async () => {
      try {
        await hybridService.deleteRepairOrderByNumber('RO-38462');
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('MySQL error:');
        expect(message).toContain('Excel error:');
      }
    });

    it('3.3 - should track failures in both services', async () => {
      try {
        await hybridService.deleteRepairOrderByNumber('RO-38462');
      } catch {
        // Expected to fail
      }

      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(1);
      expect(hybridService.metrics.excelFailures).toBe(1);
    });

    it('3.4 - should preserve last errors for debugging', async () => {
      try {
        await hybridService.deleteRepairOrderByNumber('RO-38462');
      } catch {
        // Expected
      }

      const errors = hybridService.getLastError();
      expect(errors.mysql).toBeDefined();
      expect(errors.excel).toBeDefined();
      expect(errors.mysql?.message).toContain('Network error');
      expect(errors.excel?.message).toContain('Network error');
    });
  });

  // ==========================================================================
  // TEST GROUP 4: RO Not Found Scenarios
  // ==========================================================================
  describe('Test 4: RO Not Found Scenarios', () => {
    it('4.1 - should throw error when RO does not exist in MySQL or Excel', async () => {
      const nonExistentRO = 'RO-99999';
      expect(mysqlService.exists(nonExistentRO)).toBe(false);
      expect(excelService.exists(nonExistentRO)).toBe(false);

      await expect(
        hybridService.deleteRepairOrderByNumber(nonExistentRO)
      ).rejects.toThrow();
    });

    it('4.2 - should try Excel when RO not found in MySQL', async () => {
      // Add RO only to Excel, not MySQL
      const excelOnlyRO = 'RO-38465'; // Exists in Excel (index 3)
      expect(mysqlService.exists(excelOnlyRO)).toBe(false);
      expect(excelService.exists(excelOnlyRO)).toBe(true);

      await hybridService.deleteRepairOrderByNumber(excelOnlyRO);

      expect(excelService.exists(excelOnlyRO)).toBe(false);
    });

    it('4.3 - should provide meaningful error for not found', async () => {
      await expect(
        hybridService.deleteRepairOrderByNumber('RO-DOES-NOT-EXIST')
      ).rejects.toThrow(/not found/i);
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Edge Cases
  // ==========================================================================
  describe('Test 5: Edge Cases', () => {
    it('5.1 - should handle empty roNumber', async () => {
      await expect(
        hybridService.deleteRepairOrderByNumber('')
      ).rejects.toThrow();
    });

    it('5.2 - should handle special characters in roNumber', async () => {
      // Add RO with special chars to MySQL
      mysqlService.reset();
      // This should work if the RO exists with that name
      await expect(
        hybridService.deleteRepairOrderByNumber('RO-123/456')
      ).rejects.toThrow(/not found/i);
    });

    it('5.3 - should handle concurrent deletes', async () => {
      const promises = [
        hybridService.deleteRepairOrderByNumber('RO-38462'),
        hybridService.deleteRepairOrderByNumber('RO-38463'),
      ];

      await Promise.all(promises);

      expect(mysqlService.exists('RO-38462')).toBe(false);
      expect(mysqlService.exists('RO-38463')).toBe(false);
    });

    it('5.4 - should handle Excel auth failure gracefully', async () => {
      mysqlService.setFailure(true, 'network');
      excelService.setFailure(true, 'auth');

      await expect(
        hybridService.deleteRepairOrderByNumber('RO-38462')
      ).rejects.toThrow(/authentication|auth/i);
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Backward Compatibility (Legacy ID-based delete)
  // ==========================================================================
  describe('Test 6: Backward Compatibility (Legacy)', () => {
    it('6.1 - legacy delete with MySQL string ID should work', async () => {
      await hybridService.deleteRepairOrder('1'); // MySQL ID

      expect(mysqlService.exists('RO-38462')).toBe(false);
    });

    it('6.2 - legacy delete with number (Excel index) should work', async () => {
      await hybridService.deleteRepairOrder(0); // Excel row index

      expect(excelService.exists('RO-38462')).toBe(false);
    });

    it('6.3 - legacy delete should fail for invalid string ID', async () => {
      await expect(
        hybridService.deleteRepairOrder('invalid-id-99999')
      ).rejects.toThrow();
    });

    it('6.4 - legacy delete should fail for out-of-bounds index', async () => {
      await expect(
        hybridService.deleteRepairOrder(999) // Way out of bounds
      ).rejects.toThrow(/out of bounds|400/i);
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Metrics and Monitoring
  // ==========================================================================
  describe('Test 7: Metrics and Monitoring', () => {
    it('7.1 - should track MySQL attempts correctly', async () => {
      await hybridService.deleteRepairOrderByNumber('RO-38462');
      await hybridService.deleteRepairOrderByNumber('RO-38463');

      expect(hybridService.metrics.mysqlAttempts).toBe(2);
    });

    it('7.2 - should track fallback triggers', async () => {
      mysqlService.setFailure(true, 'network');

      await hybridService.deleteRepairOrderByNumber('RO-38462');
      await hybridService.deleteRepairOrderByNumber('RO-38463');

      expect(hybridService.metrics.fallbacksTriggered).toBe(2);
    });

    it('7.3 - should reset metrics properly', async () => {
      await hybridService.deleteRepairOrderByNumber('RO-38462');
      hybridService.resetMetrics();

      expect(hybridService.metrics.mysqlAttempts).toBe(0);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Integration Simulation
  // ==========================================================================
  describe('Test 8: Full Integration Simulation', () => {
    it('8.1 - should simulate production delete flow (MySQL success)', async () => {
      // This simulates what happens when user clicks delete in production
      const roToDelete = { roNumber: 'RO-38462' };

      // Step 1: User clicks delete button
      // Step 2: UI calls hybridService.deleteRepairOrderByNumber(roNumber)
      await hybridService.deleteRepairOrderByNumber(roToDelete.roNumber);

      // Step 3: Verify deletion
      expect(mysqlService.exists(roToDelete.roNumber)).toBe(false);
      expect(hybridService.isInFallbackMode()).toBe(false);
    });

    it('8.2 - should simulate production delete flow (fallback to Excel)', async () => {
      // Simulate MySQL being down
      mysqlService.setFailure(true, 'server');

      const roToDelete = { roNumber: 'RO-38462' };
      await hybridService.deleteRepairOrderByNumber(roToDelete.roNumber);

      // Should have deleted from Excel instead
      expect(excelService.exists(roToDelete.roNumber)).toBe(false);
      expect(hybridService.isInFallbackMode()).toBe(true);
    });

    it('8.3 - should handle real-world scenario: delete multiple ROs with intermittent MySQL', async () => {
      // Delete first RO - MySQL works
      await hybridService.deleteRepairOrderByNumber('RO-38462');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);

      // MySQL goes down
      mysqlService.setFailure(true, 'network');

      // Delete second RO - falls back to Excel
      await hybridService.deleteRepairOrderByNumber('RO-38463');
      expect(hybridService.metrics.excelSuccesses).toBe(1);

      // MySQL comes back
      mysqlService.setFailure(false);
      hybridService.resetMetrics();

      // Delete third RO - MySQL works again
      await hybridService.deleteRepairOrderByNumber('RO-38464');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });
  });
});

/**
 * TEST RESULTS SUMMARY
 *
 * Expected results when running this test file:
 *
 * Group 1 (MySQL Success): All tests should PASS
 * Group 2 (Excel Fallback): All tests should PASS
 * Group 3 (Both Fail): All tests should PASS
 * Group 4 (Not Found): All tests should PASS
 * Group 5 (Edge Cases): All tests should PASS
 * Group 6 (Backward Compat): All tests should PASS
 * Group 7 (Metrics): All tests should PASS
 * Group 8 (Integration): All tests should PASS
 *
 * These tests validate the mock implementation.
 *
 * NEXT STEP: Implement the actual code in:
 * - repair-orders.js: Add DELETE /ros/by-number/:roNumber endpoint
 * - repairOrderService.ts: Add deleteByRONumber() method
 * - hybridDataService.ts: Add deleteRepairOrderByNumber() method
 * - RepairOrderRepository.ts: Add deleteRepairOrderByRONumber() method
 * - useROs.ts: Update useDeleteRepairOrder hook
 * - ROTable/index.tsx: Pass roNumber instead of parsed index
 */
