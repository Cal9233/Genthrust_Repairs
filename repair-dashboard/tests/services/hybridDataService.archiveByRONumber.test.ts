/**
 * TDD Test Suite: Archive Repair Order by RO Number
 *
 * v2.6.0 - Update/Archive RO by RO Number Refactor
 *
 * Problem: Archive operation fails because of ID system mismatch
 * - MySQL uses auto-increment IDs (e.g., "123")
 * - Excel uses array indices (e.g., "row-87")
 * - Type-checking in hybridDataService causes routing failures
 *
 * Solution: Use roNumber as universal identifier
 * - roNumber (e.g., "RO-38462") is stable and unique across both sources
 * - MySQL: Uses transaction to move row between tables (INSERT + DELETE)
 * - Excel: Find index by roNumber, then update archiveStatus field
 *
 * Test Strategy:
 * 1. Mock both MySQL and Excel services accurately
 * 2. Test MySQL primary path (success)
 * 3. Test Excel fallback path (MySQL fails, Excel succeeds)
 * 4. Test both sources fail scenario
 * 5. Test RO not found scenarios
 * 6. Test different archive destinations (PAID, NET, RETURNED)
 * 7. Test backward compatibility with old ID-based archive
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
    id: String(id),
    roNumber: `RO-${String(id).padStart(5, '0')}`,
    dateMade: new Date('2024-01-15'),
    shopName: 'Duncan Aviation',
    partNumber: `PN-${id}`,
    serialNumber: `SN-${id}`,
    partDescription: 'Hydraulic Pump Assembly',
    requiredWork: 'Overhaul and test',
    dateDroppedOff: new Date('2024-01-16'),
    estimatedCost: 5000,
    finalCost: 4500,
    terms: 'NET 30',
    shopReferenceNumber: `SHOP-REF-${id}`,
    estimatedDeliveryDate: new Date('2024-02-15'),
    currentStatus: 'PAID',
    currentStatusDate: new Date('2024-01-16'),
    genThrustStatus: 'Active',
    shopStatus: '',
    trackingNumber: 'UPS123456',
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
    id: `row-${index}`,
    roNumber: `RO-${String(index + 1000).padStart(5, '0')}`,
    dateMade: new Date('2024-01-15'),
    shopName: 'Duncan Aviation',
    partNumber: `PN-${index}`,
    serialNumber: `SN-${index}`,
    partDescription: 'Hydraulic Pump Assembly',
    requiredWork: 'Overhaul and test',
    dateDroppedOff: new Date('2024-01-16'),
    estimatedCost: 5000,
    finalCost: 4500,
    terms: 'NET 30',
    shopReferenceNumber: `SHOP-REF-${index}`,
    estimatedDeliveryDate: new Date('2024-02-15'),
    currentStatus: 'PAID',
    currentStatusDate: new Date('2024-01-16'),
    genThrustStatus: 'Active',
    shopStatus: '',
    trackingNumber: 'UPS123456',
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

type ArchiveStatus = 'ACTIVE' | 'PAID' | 'NET' | 'RETURNED';

/**
 * Mock MySQL Backend Service (via Netlify Functions)
 * Simulates: /.netlify/functions/api/ros/*
 */
class MockMySQLService {
  private database: Map<string, RepairOrder[]> = new Map();
  private shouldFail: boolean = false;
  private failureType: 'network' | 'server' | 'notfound' | 'transaction' = 'network';

  constructor() {
    this.reset();
  }

  reset() {
    this.shouldFail = false;
    this.failureType = 'network';
    // Initialize with test data across 4 tables
    this.database.set('active', [
      createMySQLRepairOrder({ id: '1', roNumber: 'RO-38462', archiveStatus: 'ACTIVE', currentStatus: 'PAID' }),
      createMySQLRepairOrder({ id: '2', roNumber: 'RO-38463', archiveStatus: 'ACTIVE', currentStatus: 'PAID', terms: 'NET 30' }),
      createMySQLRepairOrder({ id: '3', roNumber: 'RO-38464', archiveStatus: 'ACTIVE', currentStatus: 'BER' }),
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

  setFailure(shouldFail: boolean, type: 'network' | 'server' | 'notfound' | 'transaction' = 'network') {
    this.shouldFail = shouldFail;
    this.failureType = type;
  }

  private getTableForStatus(status: ArchiveStatus): string {
    const tableMap: Record<ArchiveStatus, string> = {
      'ACTIVE': 'active',
      'PAID': 'paid',
      'NET': 'net',
      'RETURNED': 'returns'
    };
    return tableMap[status];
  }

  /**
   * POST /ros/by-number/:roNumber/archive
   * Archive operation: Move RO from current table to target table
   * Uses transaction: BEGIN -> INSERT into target -> DELETE from source -> COMMIT
   */
  async archiveByRONumber(roNumber: string, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
    if (this.shouldFail) {
      if (this.failureType === 'network') {
        throw new Error('Network error: Failed to fetch');
      } else if (this.failureType === 'server') {
        throw new Error('HTTP 500: Internal server error');
      } else if (this.failureType === 'transaction') {
        throw new Error('HTTP 500: Transaction failed - database locked');
      }
    }

    // Search all 4 tables for the RO
    const tables: ArchiveStatus[] = ['ACTIVE', 'PAID', 'NET', 'RETURNED'];
    let sourceTable: string | null = null;
    let sourceIndex: number = -1;
    let foundRO: RepairOrder | null = null;

    for (const tableStatus of tables) {
      const tableName = this.getTableForStatus(tableStatus);
      const table = this.database.get(tableName) || [];
      const index = table.findIndex(ro => ro.roNumber === roNumber);

      if (index !== -1) {
        sourceTable = tableName;
        sourceIndex = index;
        foundRO = table[index];
        break;
      }
    }

    if (!foundRO || !sourceTable) {
      throw new Error(`HTTP 404: Repair order ${roNumber} not found`);
    }

    // If already in target table, just return it
    const targetTable = this.getTableForStatus(archiveStatus);
    if (sourceTable === targetTable) {
      return { ...foundRO, archiveStatus };
    }

    // Simulate transaction: Move from source to target
    const sourceData = this.database.get(sourceTable) || [];
    const targetData = this.database.get(targetTable) || [];

    // Create archived version with new status
    const archivedRO: RepairOrder = {
      ...foundRO,
      archiveStatus,
      lastDateUpdated: new Date(),
    };

    // Insert into target table
    targetData.push(archivedRO);
    this.database.set(targetTable, targetData);

    // Delete from source table
    sourceData.splice(sourceIndex, 1);
    this.database.set(sourceTable, sourceData);

    return archivedRO;
  }

  /**
   * Legacy archive by ID
   */
  async archiveById(id: string, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
    if (this.shouldFail) {
      throw new Error('HTTP 500: Internal server error');
    }

    // Find the RO by ID
    const tables: ArchiveStatus[] = ['ACTIVE', 'PAID', 'NET', 'RETURNED'];
    for (const tableStatus of tables) {
      const tableName = this.getTableForStatus(tableStatus);
      const table = this.database.get(tableName) || [];
      const ro = table.find(r => r.id === id);

      if (ro) {
        return this.archiveByRONumber(ro.roNumber, archiveStatus);
      }
    }

    throw new Error(`HTTP 404: Repair order with id ${id} not found`);
  }

  // Helper methods
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

  getTableContaining(roNumber: string): string | undefined {
    const tables = ['active', 'paid', 'net', 'returns'];
    for (const tableName of tables) {
      const table = this.database.get(tableName) || [];
      if (table.some(ro => ro.roNumber === roNumber)) {
        return tableName;
      }
    }
    return undefined;
  }

  getCount(tableName?: string): number {
    if (tableName) {
      return (this.database.get(tableName) || []).length;
    }
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
      createExcelRepairOrder(0, { roNumber: 'RO-38462', currentStatus: 'PAID' }),
      createExcelRepairOrder(1, { roNumber: 'RO-38463', currentStatus: 'PAID', terms: 'NET 30' }),
      createExcelRepairOrder(2, { roNumber: 'RO-38464', currentStatus: 'BER' }),
      createExcelRepairOrder(3, { roNumber: 'RO-38465', currentStatus: 'RAI' }),
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
   * Archive repair order by updating archiveStatus field
   * In Excel, we just update the archiveStatus column - no row movement
   */
  async moveROToArchive(rowIndex: number, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
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

    // Update the archiveStatus field
    const existing = this.data[rowIndex];
    const updated: RepairOrder = {
      ...existing,
      archiveStatus,
      lastDateUpdated: new Date(),
    };
    this.data[rowIndex] = updated;

    return updated;
  }

  /**
   * NEW: Archive repair order by roNumber
   * 1. Fetch all ROs
   * 2. Find index where roNumber matches
   * 3. Update archiveStatus by index
   */
  async archiveRepairOrderByRONumber(roNumber: string, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
    const currentData = await this.getRepairOrders();
    const targetIndex = currentData.findIndex(ro => ro.roNumber === roNumber);

    if (targetIndex === -1) {
      throw new Error(`Repair order ${roNumber} not found in Excel`);
    }

    return this.moveROToArchive(targetIndex, archiveStatus);
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
   * NEW METHOD: Archive repair order by RO Number
   * Primary: MySQL (use transaction to move between tables)
   * Fallback: Excel (update archiveStatus field)
   */
  async archiveRepairOrderByNumber(roNumber: string, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
    this.lastError = {};

    // Validate roNumber
    if (!roNumber || roNumber.trim() === '') {
      throw new Error('RO number is required');
    }

    // Validate archiveStatus
    const validStatuses: ArchiveStatus[] = ['PAID', 'NET', 'RETURNED'];
    if (!validStatuses.includes(archiveStatus)) {
      throw new Error(`Invalid archive status: ${archiveStatus}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // TRY MYSQL FIRST
    try {
      this.metrics.mysqlAttempts++;
      const result = await this.mysql.archiveByRONumber(roNumber, archiveStatus);
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
      const result = await this.excel.archiveRepairOrderByRONumber(roNumber, archiveStatus);
      this.metrics.excelSuccesses++;
      this.fallbackMode = true;
      return result;
    } catch (excelError) {
      this.metrics.excelFailures++;
      this.lastError.excel = excelError as Error;
    }

    // BOTH FAILED
    throw new Error(
      `Both MySQL and Excel failed for archiveRepairOrder.\n` +
      `MySQL error: ${this.lastError.mysql?.message || 'Unknown'}\n` +
      `Excel error: ${this.lastError.excel?.message || 'Unknown'}`
    );
  }

  /**
   * LEGACY: Archive repair order by ID (for backward compatibility)
   */
  async archiveRepairOrder(idOrRowIndex: string | number, archiveStatus: ArchiveStatus): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';
    this.lastError = {};

    // TRY MYSQL FIRST (if it's a string ID)
    if (!isExcelRowIndex) {
      try {
        this.metrics.mysqlAttempts++;
        const result = await this.mysql.archiveById(idOrRowIndex as string, archiveStatus);
        this.metrics.mysqlSuccesses++;
        return result;
      } catch (mysqlError) {
        this.metrics.mysqlFailures++;
        this.lastError.mysql = mysqlError as Error;
        throw new Error(`Cannot archive MySQL record via Excel. MySQL error: ${(mysqlError as Error).message}`);
      }
    }

    // TRY EXCEL (if it's a number index)
    if (isExcelRowIndex) {
      try {
        this.metrics.excelAttempts++;
        const result = await this.excel.moveROToArchive(idOrRowIndex as number, archiveStatus);
        this.metrics.excelSuccesses++;
        return result;
      } catch (excelError) {
        this.metrics.excelFailures++;
        this.lastError.excel = excelError as Error;
        throw new Error(`Excel archive failed: ${(excelError as Error).message}`);
      }
    }

    throw new Error('Invalid id or row index');
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('HybridDataService - Archive by RO Number', () => {
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
  // TEST GROUP 1: archiveRepairOrderByNumber - MySQL Primary Path
  // ==========================================================================
  describe('Test 1: archiveRepairOrderByNumber - MySQL Primary Path', () => {
    it('1.1 - should archive RO to PAID table by roNumber', async () => {
      const roNumber = 'RO-38462';
      expect(mysqlService.getTableContaining(roNumber)).toBe('active');

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(mysqlService.getTableContaining(roNumber)).toBe('paid');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });

    it('1.2 - should archive RO to NET table by roNumber', async () => {
      const roNumber = 'RO-38463';
      expect(mysqlService.getTableContaining(roNumber)).toBe('active');

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'NET');

      expect(result.archiveStatus).toBe('NET');
      expect(mysqlService.getTableContaining(roNumber)).toBe('net');
    });

    it('1.3 - should archive RO to RETURNED table by roNumber', async () => {
      const roNumber = 'RO-38464';
      expect(mysqlService.getTableContaining(roNumber)).toBe('active');

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'RETURNED');

      expect(result.archiveStatus).toBe('RETURNED');
      expect(mysqlService.getTableContaining(roNumber)).toBe('returns');
    });

    it('1.4 - should not enter fallback mode when MySQL succeeds', async () => {
      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');

      expect(hybridService.isInFallbackMode()).toBe(false);
      expect(hybridService.metrics.fallbacksTriggered).toBe(0);
    });

    it('1.5 - should preserve all RO data during archive', async () => {
      const roNumber = 'RO-38462';
      const original = mysqlService.getByRONumber(roNumber);

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'PAID');

      expect(result.roNumber).toBe(original?.roNumber);
      expect(result.shopName).toBe(original?.shopName);
      expect(result.partDescription).toBe(original?.partDescription);
      expect(result.finalCost).toBe(original?.finalCost);
    });

    it('1.6 - should remove RO from source table after archive', async () => {
      const roNumber = 'RO-38462';
      const initialActiveCount = mysqlService.getCount('active');
      const initialPaidCount = mysqlService.getCount('paid');

      await hybridService.archiveRepairOrderByNumber(roNumber, 'PAID');

      expect(mysqlService.getCount('active')).toBe(initialActiveCount - 1);
      expect(mysqlService.getCount('paid')).toBe(initialPaidCount + 1);
    });
  });

  // ==========================================================================
  // TEST GROUP 2: archiveRepairOrderByNumber - Excel Fallback Path
  // ==========================================================================
  describe('Test 2: archiveRepairOrderByNumber - Excel Fallback Path', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
    });

    it('2.1 - should fallback to Excel when MySQL network fails', async () => {
      const roNumber = 'RO-38462';

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('2.2 - should enter fallback mode after MySQL failure', async () => {
      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');

      expect(hybridService.isInFallbackMode()).toBe(true);
      expect(hybridService.metrics.fallbacksTriggered).toBe(1);
    });

    it('2.3 - should update archiveStatus in Excel correctly', async () => {
      const roNumber = 'RO-38463';

      await hybridService.archiveRepairOrderByNumber(roNumber, 'NET');

      const updated = excelService.getByRONumber(roNumber);
      expect(updated?.archiveStatus).toBe('NET');
    });

    it('2.4 - should fallback on MySQL transaction error', async () => {
      mysqlService.setFailure(true, 'transaction');
      const roNumber = 'RO-38464';

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'RETURNED');

      expect(result.archiveStatus).toBe('RETURNED');
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });
  });

  // ==========================================================================
  // TEST GROUP 3: archiveRepairOrderByNumber - Both Sources Fail
  // ==========================================================================
  describe('Test 3: archiveRepairOrderByNumber - Both Sources Fail', () => {
    beforeEach(() => {
      mysqlService.setFailure(true, 'network');
      excelService.setFailure(true, 'network');
    });

    it('3.1 - should throw error when both MySQL and Excel fail', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID')
      ).rejects.toThrow('Both MySQL and Excel failed');
    });

    it('3.2 - should include both error messages in thrown error', async () => {
      try {
        await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
        expect.fail('Should have thrown');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('MySQL error:');
        expect(message).toContain('Excel error:');
      }
    });

    it('3.3 - should track failures in both services', async () => {
      try {
        await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
      } catch {
        // Expected to fail
      }

      expect(hybridService.metrics.mysqlFailures).toBe(1);
      expect(hybridService.metrics.excelFailures).toBe(1);
    });
  });

  // ==========================================================================
  // TEST GROUP 4: archiveRepairOrderByNumber - Validation
  // ==========================================================================
  describe('Test 4: archiveRepairOrderByNumber - Validation', () => {
    it('4.1 - should throw error for empty roNumber', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('', 'PAID')
      ).rejects.toThrow('RO number is required');
    });

    it('4.2 - should throw error for whitespace-only roNumber', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('   ', 'PAID')
      ).rejects.toThrow('RO number is required');
    });

    it('4.3 - should throw error for invalid archiveStatus', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('RO-38462', 'INVALID' as ArchiveStatus)
      ).rejects.toThrow('Invalid archive status');
    });

    it('4.4 - should throw error when RO does not exist', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('RO-99999', 'PAID')
      ).rejects.toThrow();
    });

    it('4.5 - should not allow archiving to ACTIVE status', async () => {
      await expect(
        hybridService.archiveRepairOrderByNumber('RO-38462', 'ACTIVE' as ArchiveStatus)
      ).rejects.toThrow('Invalid archive status');
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Archive to Different Destinations
  // ==========================================================================
  describe('Test 5: Archive to Different Destinations', () => {
    it('5.1 - should archive PAID status RO to PAID table', async () => {
      const roNumber = 'RO-38462'; // Has PAID status

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(mysqlService.getTableContaining(roNumber)).toBe('paid');
    });

    it('5.2 - should archive NET terms RO to NET table', async () => {
      const roNumber = 'RO-38463'; // Has NET 30 terms

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'NET');

      expect(result.archiveStatus).toBe('NET');
      expect(mysqlService.getTableContaining(roNumber)).toBe('net');
    });

    it('5.3 - should archive BER status RO to RETURNED table', async () => {
      const roNumber = 'RO-38464'; // Has BER status

      const result = await hybridService.archiveRepairOrderByNumber(roNumber, 'RETURNED');

      expect(result.archiveStatus).toBe('RETURNED');
      expect(mysqlService.getTableContaining(roNumber)).toBe('returns');
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Backward Compatibility (Legacy ID-based archive)
  // ==========================================================================
  describe('Test 6: Backward Compatibility (Legacy)', () => {
    it('6.1 - legacy archive with MySQL string ID should work', async () => {
      const result = await hybridService.archiveRepairOrder('1', 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('6.2 - legacy archive with number (Excel index) should work', async () => {
      const result = await hybridService.archiveRepairOrder(0, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(hybridService.metrics.excelSuccesses).toBe(1);
    });

    it('6.3 - legacy archive should fail for invalid string ID', async () => {
      await expect(
        hybridService.archiveRepairOrder('invalid-id-99999', 'PAID')
      ).rejects.toThrow();
    });

    it('6.4 - legacy archive should fail for out-of-bounds index', async () => {
      await expect(
        hybridService.archiveRepairOrder(999, 'PAID')
      ).rejects.toThrow(/out of bounds|400/i);
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Metrics and Monitoring
  // ==========================================================================
  describe('Test 7: Metrics and Monitoring', () => {
    it('7.1 - should track MySQL attempts correctly', async () => {
      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
      await hybridService.archiveRepairOrderByNumber('RO-38463', 'NET');

      expect(hybridService.metrics.mysqlAttempts).toBe(2);
      expect(hybridService.metrics.mysqlSuccesses).toBe(2);
    });

    it('7.2 - should track fallback triggers', async () => {
      mysqlService.setFailure(true, 'network');

      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
      await hybridService.archiveRepairOrderByNumber('RO-38463', 'NET');

      expect(hybridService.metrics.fallbacksTriggered).toBe(2);
    });

    it('7.3 - should reset metrics properly', async () => {
      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
      hybridService.resetMetrics();

      expect(hybridService.metrics.mysqlAttempts).toBe(0);
      expect(hybridService.metrics.excelAttempts).toBe(0);
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Full Integration Simulation
  // ==========================================================================
  describe('Test 8: Full Integration Simulation', () => {
    it('8.1 - should simulate production archive flow (MySQL success)', async () => {
      const roToArchive = { roNumber: 'RO-38462' };

      const result = await hybridService.archiveRepairOrderByNumber(roToArchive.roNumber, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(hybridService.isInFallbackMode()).toBe(false);
      expect(mysqlService.getTableContaining(roToArchive.roNumber)).toBe('paid');
    });

    it('8.2 - should simulate production archive flow (fallback to Excel)', async () => {
      mysqlService.setFailure(true, 'server');
      const roToArchive = { roNumber: 'RO-38462' };

      const result = await hybridService.archiveRepairOrderByNumber(roToArchive.roNumber, 'PAID');

      expect(result.archiveStatus).toBe('PAID');
      expect(hybridService.isInFallbackMode()).toBe(true);
    });

    it('8.3 - should handle multiple archives with intermittent MySQL failures', async () => {
      // Archive first RO - MySQL works
      await hybridService.archiveRepairOrderByNumber('RO-38462', 'PAID');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);

      // MySQL goes down
      mysqlService.setFailure(true, 'network');

      // Archive second RO - falls back to Excel
      await hybridService.archiveRepairOrderByNumber('RO-38463', 'NET');
      expect(hybridService.metrics.excelSuccesses).toBe(1);

      // MySQL comes back
      mysqlService.setFailure(false);
      hybridService.resetMetrics();

      // Archive third RO - MySQL works again
      await hybridService.archiveRepairOrderByNumber('RO-38464', 'RETURNED');
      expect(hybridService.metrics.mysqlSuccesses).toBe(1);
    });

    it('8.4 - should simulate batch archive workflow', async () => {
      const rosToArchive = [
        { roNumber: 'RO-38462', destination: 'PAID' as ArchiveStatus },
        { roNumber: 'RO-38463', destination: 'NET' as ArchiveStatus },
        { roNumber: 'RO-38464', destination: 'RETURNED' as ArchiveStatus },
      ];

      for (const ro of rosToArchive) {
        await hybridService.archiveRepairOrderByNumber(ro.roNumber, ro.destination);
      }

      expect(hybridService.metrics.mysqlSuccesses).toBe(3);
      expect(mysqlService.getCount('active')).toBe(0); // All moved out
      expect(mysqlService.getCount('paid')).toBe(2); // 1 original + 1 archived
      expect(mysqlService.getCount('net')).toBe(2); // 1 original + 1 archived
      expect(mysqlService.getCount('returns')).toBe(2); // 1 original + 1 archived
    });
  });
});

/**
 * TEST RESULTS SUMMARY
 *
 * Expected results when running this test file:
 *
 * Group 1: MySQL Primary Path tests - All should PASS
 * Group 2: Excel Fallback Path tests - All should PASS
 * Group 3: Both Sources Fail tests - All should PASS
 * Group 4: Validation tests - All should PASS
 * Group 5: Different Destinations tests - All should PASS
 * Group 6: Backward Compatibility tests - All should PASS
 * Group 7: Metrics tests - All should PASS
 * Group 8: Integration tests - All should PASS
 *
 * These tests validate the mock implementation.
 *
 * NEXT STEP: Implement the actual code in:
 * - repair-orders.js: Add POST /ros/by-number/:roNumber/archive endpoint
 * - repairOrderService.ts: Add archiveByRONumber() method
 * - hybridDataService.ts: Add archiveRepairOrderByNumber() method
 * - RepairOrderRepository.ts: Add archiveRepairOrderByRONumber() method
 * - useROs.ts: Update useArchiveRO hook
 * - ROTable/index.tsx and dialogs: Pass roNumber instead of parsed index
 */
