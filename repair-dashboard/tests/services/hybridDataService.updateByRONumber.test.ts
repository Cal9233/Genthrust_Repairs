/**
 * TDD Test Suite: Update Repair Order by RO Number
 *
 * v2.6.0 - Update/Archive RO by RO Number Refactor
 *
 * Problem: Update operation fails because of ID system mismatch
 * - MySQL uses auto-increment IDs (e.g., "123")
 * - Excel uses array indices (e.g., "row-87")
 * - Type-checking in hybridDataService causes routing failures
 *
 * Solution: Use roNumber as universal identifier
 * - roNumber (e.g., "RO-38462") is stable and unique across both sources
 * - MySQL: UPDATE table SET ... WHERE RO = ?
 * - Excel: Find index by roNumber, then UPDATE rows/itemAt(index=X)
 *
 * Test Strategy:
 * 1. Mock both MySQL and Excel services accurately
 * 2. Test MySQL primary path (success)
 * 3. Test Excel fallback path (MySQL fails, Excel succeeds)
 * 4. Test both sources fail scenario
 * 5. Test RO not found scenarios
 * 6. Test partial updates
 * 7. Test backward compatibility with old ID-based update
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
   * PATCH /ros/by-number/:roNumber
   * New endpoint that searches all 4 tables by roNumber and updates
   */
  async updateByRONumber(roNumber: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
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
        // Found! Update it
        const existing = table[index];
        const updated: RepairOrder = {
          ...existing,
          ...data,
          lastDateUpdated: new Date(),
        };
        table[index] = updated;
        this.database.set(tableName, table);
        return updated;
      }
    }

    // Not found in any table
    throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
  }

  /**
   * PATCH /ros/by-number/:roNumber/status
   * Update status with business logic
   */
  async updateStatusByRONumber(
    roNumber: string,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
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
        // Found! Update status
        const existing = table[index];
        const updated: RepairOrder = {
          ...existing,
          currentStatus: status,
          currentStatusDate: new Date(),
          lastDateUpdated: new Date(),
          ...(notes && { notes: `${existing.notes}\n${notes}`.trim() }),
          ...(cost !== undefined && { finalCost: cost }),
          ...(deliveryDate && { estimatedDeliveryDate: deliveryDate }),
        };
        table[index] = updated;
        this.database.set(tableName, table);
        return updated;
      }
    }

    // Not found in any table
    throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
  }

  /**
   * PATCH /ros/:id (legacy - by MySQL ID)
   */
  async updateById(id: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
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
        const existing = table[index];
        const updated: RepairOrder = {
          ...existing,
          ...data,
          lastDateUpdated: new Date(),
        };
        table[index] = updated;
        this.database.set(tableName, table);
        return updated;
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

  getByRONumber(roNumber: string): RepairOrder | undefined {
    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      const ro = table.find(r => r.roNumber === roNumber);
      if (ro) return ro;
    }
    return undefined;
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
   * Update repair order by row index
   * PATCH /workbook/tables/RepairTable/rows/itemAt(index=X)
   */
  async updateRepairOrder(rowIndex: number, data: Partial<RepairOrder>): Promise<RepairOrder> {
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

    // Update the row
    const existing = this.data[rowIndex];
    const updated: RepairOrder = {
      ...existing,
      ...data,
      lastDateUpdated: new Date(),
    };
    this.data[rowIndex] = updated;

    return updated;
  }

  /**
   * Update RO status by row index
   */
  async updateROStatus(
    rowIndex: number,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
    if (this.shouldFail) {
      if (this.failureType === 'network') {
        throw new Error('Network error: Graph API unreachable');
      } else if (this.failureType === 'auth') {
        throw new Error('MSAL authentication failed: Token expired');
      }
    }

    // Validate index exists
    if (rowIndex < 0 || rowIndex >= this.data.length) {
      throw new Error(`Graph API error: 400 - Row index ${rowIndex} out of bounds`);
    }

    const existing = this.data[rowIndex];
    const updated: RepairOrder = {
      ...existing,
      currentStatus: status,
      currentStatusDate: new Date(),
      lastDateUpdated: new Date(),
      ...(notes && { notes: `${existing.notes}\n${notes}`.trim() }),
      ...(cost !== undefined && { finalCost: cost }),
      ...(deliveryDate && { estimatedDeliveryDate: deliveryDate }),
    };
    this.data[rowIndex] = updated;

    return updated;
  }

  /**
   * NEW: Update repair order by roNumber
   * 1. Fetch all ROs
   * 2. Find index where roNumber matches
   * 3. Update by index
   */
  async updateRepairOrderByRONumber(roNumber: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
    const currentData = await this.getRepairOrders();
    const targetIndex = currentData.findIndex(ro => ro.roNumber === roNumber);

    if (targetIndex === -1) {
      throw new Error(`Repair order ${roNumber} not found in Excel`);
    }

    return this.updateRepairOrder(targetIndex, data);
  }

  /**
   * NEW: Update RO status by roNumber
   */
  async updateROStatusByRONumber(
    roNumber: string,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
    const currentData = await this.getRepairOrders();
    const targetIndex = currentData.findIndex(ro => ro.roNumber === roNumber);

    if (targetIndex === -1) {
      throw new Error(`Repair order ${roNumber} not found in Excel`);
    }

    return this.updateROStatus(targetIndex, status, notes, cost, deliveryDate);
  }

  // Helper methods
  exists(roNumber: string): boolean {
    return this.data.some(ro => ro.roNumber === roNumber);
  }

  getByRONumber(roNumber: string): RepairOrder | undefined {
    return this.data.find(ro => ro.roNumber === roNumber);
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
   * NEW METHOD: Update repair order by RO Number
   * Primary: MySQL (search by roNumber, update)
   * Fallback: Excel (fetch all, find index, update by index)
   */
  async updateRepairOrderByNumber(roNumber: string, data: Partial<RepairOrder>): Promise<RepairOrder> {
    this.lastError = {};

    // Validate roNumber
    if (!roNumber || roNumber.trim() === '') {
      throw new Error('RO number is required');
    }

    // TRY MYSQL FIRST
    try {
      this.metrics.mysqlAttempts++;
      const result = await this.mysql.updateByRONumber(roNumber, data);
      this.metrics.mysqlSuccesses++;
      this.fallbackMode = false;
      return result;
    } catch (mysqlError) {
      this.metrics.mysqlFailures++;
      this.lastError.mysql = mysqlError as Error;

      // Check if it's a "not found" error (don't fallback for not found)
      if (!(mysqlError as Error).message.includes('404')) {
        this.metrics.fallbacksTriggered++;
      }
    }

    // FALLBACK TO EXCEL
    try {
      this.metrics.excelAttempts++;
      const result = await this.excel.updateRepairOrderByRONumber(roNumber, data);
      this.metrics.excelSuccesses++;
      this.fallbackMode = true;
      return result;
    } catch (excelError) {
      this.metrics.excelFailures++;
      this.lastError.excel = excelError as Error;
    }

    // BOTH FAILED
    throw new Error(
      `Both MySQL and Excel failed for updateRepairOrder.\n` +
      `MySQL error: ${this.lastError.mysql?.message || 'Unknown'}\n` +
      `Excel error: ${this.lastError.excel?.message || 'Unknown'}`
    );
  }

  /**
   * NEW METHOD: Update RO Status by RO Number
   * Primary: MySQL (search by roNumber, update status)
   * Fallback: Excel (fetch all, find index, update status by index)
   */
  async updateROStatusByNumber(
    roNumber: string,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
    this.lastError = {};

    // Validate roNumber
    if (!roNumber || roNumber.trim() === '') {
      throw new Error('RO number is required');
    }

    // Validate status
    if (!status || status.trim() === '') {
      throw new Error('Status is required');
    }

    // TRY MYSQL FIRST
    try {
      this.metrics.mysqlAttempts++;
      const result = await this.mysql.updateStatusByRONumber(roNumber, status, notes, cost, deliveryDate);
      this.metrics.mysqlSuccesses++;
      this.fallbackMode = false;
      return result;
    } catch (mysqlError) {
      this.metrics.mysqlFailures++;
      this.lastError.mysql = mysqlError as Error;

      if (!(mysqlError as Error).message.includes('404')) {
        this.metrics.fallbacksTriggered++;
      }
    }

    // FALLBACK TO EXCEL
    try {
      this.metrics.excelAttempts++;
      const result = await this.excel.updateROStatusByRONumber(roNumber, status, notes, cost, deliveryDate);
      this.metrics.excelSuccesses++;
      this.fallbackMode = true;
      return result;
    } catch (excelError) {
      this.metrics.excelFailures++;
      this.lastError.excel = excelError as Error;
    }

    // BOTH FAILED
    throw new Error(
      `Both MySQL and Excel failed for updateROStatus.\n` +
      `MySQL error: ${this.lastError.mysql?.message || 'Unknown'}\n` +
      `Excel error: ${this.lastError.excel?.message || 'Unknown'}`
    );
  }

  /**
   * LEGACY: Update repair order by ID (for backward compatibility)
   */
  async updateRepairOrder(idOrRowIndex: string | number, data: Partial<RepairOrder>): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    this.lastError = {};

    // TRY MYSQL FIRST (if it's a string ID)
    if (!isExcelRowIndex) {
      try {
        this.metrics.mysqlAttempts++;
        const result = await this.mysql.updateById(idOrRowIndex as string, data);
        this.metrics.mysqlSuccesses++;
        return result;
      } catch (mysqlError) {
        this.metrics.mysqlFailures++;
        this.lastError.mysql = mysqlError as Error;
        throw new Error(`Cannot update MySQL record via Excel. MySQL error: ${(mysqlError as Error).message}`);
      }
    }

    // TRY EXCEL (if it's a number index)
    if (isExcelRowIndex) {
      try {
        this.metrics.excelAttempts++;
        const result = await this.excel.updateRepairOrder(idOrRowIndex as number, data);
        this.metrics.excelSuccesses++;
        return result;
      } catch (excelError) {
        this.metrics.excelFailures++;
        this.lastError.excel = excelError as Error;
        throw new Error(`Excel update failed: ${(excelError as Error).message}`);
      }
    }

    throw new Error('Invalid id or row index');
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('HybridDataService - Update by RO Number', () => {
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
  // TEST GROUP 1: updateRepairOrderByNumber - MySQL Primary Path
  // ==========================================================================
  describe('Test 1: updateRepairOrderByNumber - MySQL Primary Path', () => {
    it('1.1 - should update RO in MySQL active table by roNumber', async () => {
      const roNumber = 'RO-38462';
      const updates = { notes: 'Updated via test' };

      const result = await hybridService.updateRepairOrderByNumber(roNumber, updates);

      expect(result.roNumber).toBe(roNumber);
      expect(result.notes).toBe('Updated via test');
      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });

    it('1.2 - should update RO in MySQL paid archive by roNumber', async () => {
      const roNumber = 'RO-30001';
      const updates = { notes: 'Paid update' };

      const result = await hybridService.updateRepairOrderByNumber(roNumber, updates);

      expect(result.roNumber).toBe(roNumber);
      expect(result.notes).toBe('Paid update');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('1.3 - should not enter fallback mode when MySQL succeeds', async () => {
      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' });

      expect(hybridService.isInFallbackMode()).toBe(false);
      expect(hybridService.metrics.fallbacksTriggered).toBe(0);
    });

    it('1.4 - should preserve existing fields when updating', async () => {
      const roNumber = 'RO-38462';
      const original = mysqlService.getByRONumber(roNumber);
      const originalShopName = original?.shopName;

      await hybridService.updateRepairOrderByNumber(roNumber, { notes: 'new note' });

      const updated = mysqlService.getByRONumber(roNumber);
      expect(updated?.shopName).toBe(originalShopName); // Preserved
      expect(updated?.notes).toBe('new note'); // Updated
    });

    it('1.5 - should update multiple fields at once', async () => {
      const roNumber = 'RO-38462';
      const updates = {
        notes: 'Multi-field update',
        estimatedCost: 7500,
        terms: 'NET 60'
      };

      const result = await hybridService.updateRepairOrderByNumber(roNumber, updates);

      expect(result.notes).toBe('Multi-field update');
      expect(result.estimatedCost).toBe(7500);
      expect(result.terms).toBe('NET 60');
    });
  });

  // ==========================================================================
  // TEST GROUP 2: updateRepairOrderByNumber - Excel Fallback Path
  // ==========================================================================
  describe('Test 2: updateRepairOrderByNumber - Excel Fallback Path', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
    });

    it('2.1 - should fallback to Excel when MySQL network fails', async () => {
      const roNumber = 'RO-38462';
      const updates = { notes: 'Fallback update' };

      const result = await hybridService.updateRepairOrderByNumber(roNumber, updates);

      expect(result.notes).toBe('Fallback update');
      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(1);
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('2.2 - should enter fallback mode after MySQL failure', async () => {
      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' });

      expect(hybridService.isInFallbackMode()).toBe(true);
      expect(hybridService.metrics.fallbacksTriggered).toBe(1);
    });

    it('2.3 - should fallback on MySQL server error (500)', async () => {
      mysqlService.setFailure(true, 'server');
      const roNumber = 'RO-38463';

      const result = await hybridService.updateRepairOrderByNumber(roNumber, { notes: 'Server error fallback' });

      expect(result.notes).toBe('Server error fallback');
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('2.4 - should correctly find and update by roNumber in Excel', async () => {
      const roNumber = 'RO-38464';
      const initialIndex = excelService.findIndexByRONumber(roNumber);
      expect(initialIndex).toBe(2);

      await hybridService.updateRepairOrderByNumber(roNumber, { notes: 'Excel update' });

      const updated = excelService.getByRONumber(roNumber);
      expect(updated?.notes).toBe('Excel update');
    });
  });

  // ==========================================================================
  // TEST GROUP 3: updateRepairOrderByNumber - Both Sources Fail
  // ==========================================================================
  describe('Test 3: updateRepairOrderByNumber - Both Sources Fail', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
      excelService.setFailure(true, 'network');
    });

    it('3.1 - should throw error when both MySQL and Excel fail', async () => {
      await expect(
        hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' })
      ).rejects.toThrow('Both MySQL and Excel failed');
    });

    it('3.2 - should include both error messages in thrown error', async () => {
      try {
        await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' });
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('MySQL error:');
        expect(message).toContain('Excel error:');
      }
    });

    it('3.3 - should track failures in both services', async () => {
      try {
        await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' });
      } catch {
        // Expected to fail
      }

      expect(hybridService.metrics.mysqlAttempts).toBe(1);
      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(1);
      expect(hybridService.metrics.excelFailures).toBe(1);
    });
  });

  // ==========================================================================
  // TEST GROUP 4: updateRepairOrderByNumber - Edge Cases
  // ==========================================================================
  describe('Test 4: updateRepairOrderByNumber - Edge Cases', () => {
    it('4.1 - should throw error for empty roNumber', async () => {
      await expect(
        hybridService.updateRepairOrderByNumber('', { notes: 'test' })
      ).rejects.toThrow('RO number is required');
    });

    it('4.2 - should throw error for whitespace-only roNumber', async () => {
      await expect(
        hybridService.updateRepairOrderByNumber('   ', { notes: 'test' })
      ).rejects.toThrow('RO number is required');
    });

    it('4.3 - should throw error when RO does not exist', async () => {
      await expect(
        hybridService.updateRepairOrderByNumber('RO-99999', { notes: 'test' })
      ).rejects.toThrow();
    });

    it('4.4 - should handle empty updates object', async () => {
      const roNumber = 'RO-38462';
      const result = await hybridService.updateRepairOrderByNumber(roNumber, {});

      expect(result.roNumber).toBe(roNumber);
      expect(result.lastDateUpdated).toBeDefined();
    });
  });

  // ==========================================================================
  // TEST GROUP 5: updateROStatusByNumber - MySQL Primary Path
  // ==========================================================================
  describe('Test 5: updateROStatusByNumber - MySQL Primary Path', () => {
    it('5.1 - should update status in MySQL by roNumber', async () => {
      const roNumber = 'RO-38462';
      const newStatus = 'APPROVED';

      const result = await hybridService.updateROStatusByNumber(roNumber, newStatus);

      expect(result.currentStatus).toBe('APPROVED');
      expect(result.currentStatusDate).toBeDefined();
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('5.2 - should update status with notes', async () => {
      const roNumber = 'RO-38462';

      const result = await hybridService.updateROStatusByNumber(roNumber, 'BEING REPAIRED', 'Started work');

      expect(result.currentStatus).toBe('BEING REPAIRED');
      expect(result.notes).toContain('Started work');
    });

    it('5.3 - should update status with cost', async () => {
      const roNumber = 'RO-38462';

      const result = await hybridService.updateROStatusByNumber(roNumber, 'SHIPPING', undefined, 4500);

      expect(result.currentStatus).toBe('SHIPPING');
      expect(result.finalCost).toBe(4500);
    });

    it('5.4 - should update status with delivery date', async () => {
      const roNumber = 'RO-38462';
      const deliveryDate = new Date('2024-03-15');

      const result = await hybridService.updateROStatusByNumber(roNumber, 'APPROVED', undefined, undefined, deliveryDate);

      expect(result.currentStatus).toBe('APPROVED');
      expect(result.estimatedDeliveryDate).toEqual(deliveryDate);
    });

    it('5.5 - should update status with all optional params', async () => {
      const roNumber = 'RO-38462';
      const deliveryDate = new Date('2024-03-15');

      const result = await hybridService.updateROStatusByNumber(
        roNumber,
        'PAID',
        'Invoice processed',
        5500,
        deliveryDate
      );

      expect(result.currentStatus).toBe('PAID');
      expect(result.notes).toContain('Invoice processed');
      expect(result.finalCost).toBe(5500);
      expect(result.estimatedDeliveryDate).toEqual(deliveryDate);
    });
  });

  // ==========================================================================
  // TEST GROUP 6: updateROStatusByNumber - Excel Fallback Path
  // ==========================================================================
  describe('Test 6: updateROStatusByNumber - Excel Fallback Path', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
    });

    it('6.1 - should fallback to Excel for status update when MySQL fails', async () => {
      const roNumber = 'RO-38462';

      const result = await hybridService.updateROStatusByNumber(roNumber, 'APPROVED');

      expect(result.currentStatus).toBe('APPROVED');
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('6.2 - should update status with optional params via Excel fallback', async () => {
      const roNumber = 'RO-38463';
      const deliveryDate = new Date('2024-03-20');

      const result = await hybridService.updateROStatusByNumber(
        roNumber,
        'SHIPPING',
        'Shipped via UPS',
        3500,
        deliveryDate
      );

      expect(result.currentStatus).toBe('SHIPPING');
      expect(result.finalCost).toBe(3500);
    });
  });

  // ==========================================================================
  // TEST GROUP 7: updateROStatusByNumber - Validation
  // ==========================================================================
  describe('Test 7: updateROStatusByNumber - Validation', () => {
    it('7.1 - should throw error for empty status', async () => {
      await expect(
        hybridService.updateROStatusByNumber('RO-38462', '')
      ).rejects.toThrow('Status is required');
    });

    it('7.2 - should throw error for empty roNumber', async () => {
      await expect(
        hybridService.updateROStatusByNumber('', 'APPROVED')
      ).rejects.toThrow('RO number is required');
    });

    it('7.3 - should handle RO not found', async () => {
      await expect(
        hybridService.updateROStatusByNumber('RO-99999', 'APPROVED')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Backward Compatibility (Legacy ID-based update)
  // ==========================================================================
  describe('Test 8: Backward Compatibility (Legacy)', () => {
    it('8.1 - legacy update with MySQL string ID should work', async () => {
      const result = await hybridService.updateRepairOrder('1', { notes: 'Legacy update' });

      expect(result.notes).toBe('Legacy update');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('8.2 - legacy update with number (Excel index) should work', async () => {
      const result = await hybridService.updateRepairOrder(0, { notes: 'Excel update' });

      expect(result.notes).toBe('Excel update');
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('8.3 - legacy update should fail for invalid string ID', async () => {
      await expect(
        hybridService.updateRepairOrder('invalid-id-99999', { notes: 'test' })
      ).rejects.toThrow();
    });

    it('8.4 - legacy update should fail for out-of-bounds index', async () => {
      await expect(
        hybridService.updateRepairOrder(999, { notes: 'test' })
      ).rejects.toThrow(/out of bounds|400/i);
    });
  });

  // ==========================================================================
  // TEST GROUP 9: Metrics and Monitoring
  // ==========================================================================
  describe('Test 9: Metrics and Monitoring', () => {
    it('9.1 - should track MySQL attempts correctly', async () => {
      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test1' });
      await hybridService.updateRepairOrderByNumber('RO-38463', { notes: 'test2' });

      expect(hybridService.metrics.mysqlAttempts).toBe(2);
      expect(hybridService.metrics.mysqlSuccesses).toBe(2);
    });

    it('9.2 - should track fallback triggers', async () => {
      mysqlService.setFailure(true, 'network');

      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test1' });
      await hybridService.updateRepairOrderByNumber('RO-38463', { notes: 'test2' });

      expect(hybridService.metrics.fallbacksTriggered).toBe(2);
    });

    it('9.3 - should reset metrics properly', async () => {
      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'test' });
      hybridService.resetMetrics();

      expect(hybridService.metrics.mysqlAttempts).toBe(0);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });
  });

  // ==========================================================================
  // TEST GROUP 10: Full Integration Simulation
  // ==========================================================================
  describe('Test 10: Full Integration Simulation', () => {
    it('10.1 - should simulate production update flow (MySQL success)', async () => {
      const roToUpdate = { roNumber: 'RO-38462' };
      const updates = { notes: 'Production update test', estimatedCost: 6000 };

      const result = await hybridService.updateRepairOrderByNumber(roToUpdate.roNumber, updates);

      expect(result.notes).toBe('Production update test');
      expect(result.estimatedCost).toBe(6000);
      expect(hybridService.isInFallbackMode()).toBe(false);
    });

    it('10.2 - should simulate production status update flow (MySQL success)', async () => {
      const roNumber = 'RO-38462';

      const result = await hybridService.updateROStatusByNumber(roNumber, 'APPROVED', 'Quote approved by customer');

      expect(result.currentStatus).toBe('APPROVED');
      expect(result.notes).toContain('Quote approved');
    });

    it('10.3 - should handle intermittent MySQL failures', async () => {
      // Update first RO - MySQL works
      await hybridService.updateRepairOrderByNumber('RO-38462', { notes: 'update1' });
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);

      // MySQL goes down
      mysqlService.setFailure(true, 'network');

      // Update second RO - falls back to Excel
      await hybridService.updateRepairOrderByNumber('RO-38463', { notes: 'update2' });
      expect(hybridService.metrics.excelSuccesses).toBe(1);

      // MySQL comes back
      mysqlService.setFailure(false);
      hybridService.resetMetrics();

      // Update third RO - MySQL works again
      await hybridService.updateRepairOrderByNumber('RO-38464', { notes: 'update3' });
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });
  });
});

/**
 * TEST RESULTS SUMMARY
 *
 * Expected results when running this test file:
 *
 * Group 1-4: updateRepairOrderByNumber tests - All should PASS
 * Group 5-7: updateROStatusByNumber tests - All should PASS
 * Group 8: Backward Compatibility tests - All should PASS
 * Group 9: Metrics tests - All should PASS
 * Group 10: Integration tests - All should PASS
 *
 * These tests validate the mock implementation.
 *
 * NEXT STEP: Implement the actual code in:
 * - repair-orders.js: Add PATCH /ros/by-number/:roNumber endpoints
 * - repairOrderService.ts: Add updateByRONumber() and updateStatusByRONumber() methods
 * - hybridDataService.ts: Add updateRepairOrderByNumber() and updateROStatusByNumber() methods
 * - RepairOrderRepository.ts: Add updateRepairOrderByRONumber() and updateROStatusByRONumber() methods
 * - useROs.ts: Update useUpdateRepairOrder and useUpdateROStatus hooks
 * - ROTable/index.tsx and dialogs: Pass roNumber instead of parsed index
 */
