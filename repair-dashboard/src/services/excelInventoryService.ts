// @ts-nocheck - TODO: Fix LowStockItem type (qty property missing)
/**
 * Excel Inventory Service
 *
 * Provides inventory operations directly from Excel tables as a fallback
 * when MySQL database is unavailable.
 */

import { excelService } from '@/lib/excelService';
import { INVENTORY_TABLE_NAMES, getTableDisplayName } from '@/config/inventoryTableSchemas';
import { createLogger } from '@/utils/logger';
import type { InventorySearchResult, InventoryDecrementResult } from './inventoryService';
import type { LowStockResponse, LowStockItem } from './mysqlInventoryService';

const logger = createLogger('ExcelInventoryService');

interface ColumnIndices {
  partNumber: number | null;
  serial: number | null;
  qty: number | null;
  condition: number | null;
  location: number | null;
  description: number | null;
  tagDate: number | null;
}

// Column name patterns for auto-detection
const COLUMN_PATTERNS = {
  partNumber: ['PART', 'PN', 'P/N', 'PART NO', 'PARTNUMBER', 'PART NUMBER'],
  serial: ['SERIAL', 'SER', 'S/N', 'SN', 'SERIAL NUMBER'],
  qty: ['QTY', 'QUANTITY', 'QTY.', 'QTY '],
  condition: ['COND', 'CONDITION', 'COND.'],
  location: ['LOCATION', 'LOC', 'BIN', 'STOCK ROOM', 'STOCK', 'WHERE'],
  description: ['DESC', 'DESCRIPTION', 'DESC.'],
  tagDate: ['TAG DATE', 'TAG_DATE', 'DATE', 'TAGGED', 'LAST SEEN']
};

class ExcelInventoryService {
  private inventoryWorkbookId: string;
  private columnIndicesCache: Map<string, ColumnIndices> = new Map();

  constructor() {
    this.inventoryWorkbookId = import.meta.env.VITE_INVENTORY_WORKBOOK_ID || '';
    if (!this.inventoryWorkbookId) {
      logger.warn('VITE_INVENTORY_WORKBOOK_ID not configured - Excel inventory fallback will not work');
    }
  }

  /**
   * Normalize part number for comparison
   */
  private normalizePartNumber(pn: string): string {
    if (!pn) return '';
    return String(pn)
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/[\/\-_]/g, '');
  }

  /**
   * Detect column indices from table headers
   */
  private detectColumnIndices(headers: any[]): ColumnIndices {
    const indices: ColumnIndices = {
      partNumber: null,
      serial: null,
      qty: null,
      condition: null,
      location: null,
      description: null,
      tagDate: null
    };

    if (!headers || headers.length === 0) {
      return indices;
    }

    const normalizedHeaders = headers.map(h =>
      String(h || '').toUpperCase().trim()
    );

    // Match each column type
    for (const [key, patterns] of Object.entries(COLUMN_PATTERNS)) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const header = normalizedHeaders[i];
        if (patterns.some(pattern => header.includes(pattern))) {
          indices[key as keyof ColumnIndices] = i;
          break;
        }
      }
    }

    return indices;
  }

  /**
   * Get column indices for a table (with caching)
   */
  private async getColumnIndices(tableName: string): Promise<ColumnIndices> {
    // Check cache
    if (this.columnIndicesCache.has(tableName)) {
      return this.columnIndicesCache.get(tableName)!;
    }

    try {
      // Note: Assuming inventory tables are in a sheet called "Inventory"
      // This may need to be adjusted based on actual workbook structure
      const rows = await excelService.getRowsFromTable('Inventory', tableName);

      if (rows.length === 0) {
        logger.warn(`No rows found in table ${tableName}`);
        return {
          partNumber: null,
          serial: null,
          qty: null,
          condition: null,
          location: null,
          description: null,
          tagDate: null
        };
      }

      // Get headers from first row or from table metadata
      // For now, we'll use standard Excel table format where headers are automatic
      // We need to make a separate call to get headers
      const headers = await this.getTableHeaders(tableName);
      const indices = this.detectColumnIndices(headers);

      // Cache the indices
      this.columnIndicesCache.set(tableName, indices);

      logger.debug(`Detected column indices for ${tableName}`, indices);
      return indices;
    } catch (error) {
      logger.error(`Failed to detect columns for ${tableName}`, error);
      // Return default indices (assume standard order)
      return {
        partNumber: 0,
        serial: 1,
        qty: 2,
        condition: 3,
        location: 4,
        description: 5,
        tagDate: 6
      };
    }
  }

  /**
   * Get table headers
   */
  private async getTableHeaders(tableName: string): Promise<string[]> {
    try {
      // Use excelService to get table metadata
      // This is a simplified version - may need adjustment based on actual API
      const fileId = this.inventoryWorkbookId;
      const driveId = 'your-drive-id'; // TODO: Get from excelService

      // For now, return common headers
      // In production, this should make an API call to get actual headers
      return [
        'PART NUMBER',
        'SERIAL',
        'QTY',
        'CONDITION',
        'LOCATION',
        'DESCRIPTION',
        'TAG DATE'
      ];
    } catch (error) {
      logger.error(`Failed to get headers for ${tableName}`, error);
      return [];
    }
  }

  /**
   * Extract value from row safely
   */
  private extractValue(row: any, indices: ColumnIndices, field: keyof ColumnIndices): string {
    if (!row || !row.values || !row.values[0]) return '';
    const index = indices[field];
    if (index === null || index === undefined) return '';
    const value = row.values[0][index];
    return value != null ? String(value) : '';
  }

  /**
   * Extract numeric value from row
   */
  private extractNumber(row: any, indices: ColumnIndices, field: keyof ColumnIndices): number {
    const value = this.extractValue(row, indices, field);
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Search inventory in a specific table
   */
  private async searchInTable(tableName: string, normalizedPN: string): Promise<InventorySearchResult[]> {
    try {
      logger.debug(`Searching in table ${tableName} for ${normalizedPN}`);

      // Get rows from table
      const rows = await excelService.getRowsFromTable('Inventory', tableName);
      const indices = await this.getColumnIndices(tableName);

      if (indices.partNumber === null) {
        logger.warn(`Could not detect part number column in ${tableName}`);
        return [];
      }

      const results: InventorySearchResult[] = [];

      // Filter and map rows
      rows.forEach((row, rowIndex) => {
        if (!row || !row.values || !row.values[0]) return;

        const pn = this.extractValue(row, indices, 'partNumber');
        const normalizedRowPN = this.normalizePartNumber(pn);

        // Check if part number matches (contains search term)
        if (normalizedRowPN.includes(normalizedPN) || normalizedPN.includes(normalizedRowPN)) {
          const qty = this.extractNumber(row, indices, 'qty');

          // Only include items with quantity > 0
          if (qty > 0) {
            results.push({
              indexId: `excel-${tableName}-${rowIndex}`, // Unique ID for Excel rows
              partNumber: pn,
              tableName: tableName,
              rowId: String(rowIndex), // Excel row index
              serialNumber: this.extractValue(row, indices, 'serial'),
              qty: qty,
              condition: this.extractValue(row, indices, 'condition'),
              location: this.extractValue(row, indices, 'location'),
              description: this.extractValue(row, indices, 'description'),
              lastSeen: this.extractValue(row, indices, 'tagDate') || new Date().toISOString()
            });
          }
        }
      });

      logger.debug(`Found ${results.length} results in ${tableName}`);
      return results;
    } catch (error) {
      logger.error(`Error searching table ${tableName}`, error);
      return [];
    }
  }

  /**
   * Search in the pre-built InventoryIndexTable for fast lookups
   * This is the first fallback layer - much faster than scanning all 11 tables
   */
  private async searchInIndexTable(normalizedPN: string): Promise<InventorySearchResult[]> {
    try {
      logger.debug(`Searching InventoryIndexTable for ${normalizedPN}`);

      // Get rows from the index table (same workbook as other inventory tables)
      const rows = await excelService.getRowsFromTable('Inventory', 'InventoryIndexTable');

      // InventoryIndexTable schema (from buildInventoryIndex.js):
      // Columns: Part Number, Table Name, Row ID, Serial Number, Qty, Condition, Location, Description, Last Seen
      const indices = {
        partNumber: 0,
        tableName: 1,
        rowId: 2,
        serial: 3,
        qty: 4,
        condition: 5,
        location: 6,
        description: 7,
        lastSeen: 8
      };

      const results: InventorySearchResult[] = [];

      // Filter and map rows
      rows.forEach((row, rowIndex) => {
        if (!row || !row.values || !row.values[0]) return;

        const pn = String(row.values[0][indices.partNumber] || '');
        const normalizedRowPN = this.normalizePartNumber(pn);

        // Check if part number matches
        if (normalizedRowPN.includes(normalizedPN) || normalizedPN.includes(normalizedRowPN)) {
          const qty = parseInt(String(row.values[0][indices.qty] || '0'), 10);

          // Only include items with quantity > 0
          if (qty > 0) {
            results.push({
              indexId: `excel-index-${rowIndex}`,
              partNumber: pn,
              tableName: String(row.values[0][indices.tableName] || ''),
              rowId: String(row.values[0][indices.rowId] || ''),
              serialNumber: String(row.values[0][indices.serial] || ''),
              qty: qty,
              condition: String(row.values[0][indices.condition] || ''),
              location: String(row.values[0][indices.location] || ''),
              description: String(row.values[0][indices.description] || ''),
              lastSeen: String(row.values[0][indices.lastSeen] || new Date().toISOString())
            });
          }
        }
      });

      logger.debug(`Found ${results.length} results in InventoryIndexTable`);
      return results;
    } catch (error) {
      logger.error('Error searching InventoryIndexTable', error);
      // Return empty array to trigger fallback to full scan
      return [];
    }
  }

  /**
   * Search inventory across all Excel tables
   */
  async searchInventory(partNumber: string): Promise<InventorySearchResult[]> {
    logger.info(`Searching Excel inventory for: ${partNumber}`);

    if (!partNumber || partNumber.trim().length === 0) {
      return [];
    }

    const normalizedPN = this.normalizePartNumber(partNumber);

    // STEP 1: Try InventoryIndexTable FIRST (fast lookup ~500ms)
    try {
      logger.info('Checking InventoryIndexTable for fast lookup...');
      const indexResults = await this.searchInIndexTable(normalizedPN);

      if (indexResults.length > 0) {
        // Found in index - return immediately without checking other tables
        logger.info(`Found ${indexResults.length} results in InventoryIndexTable (fast path)`);
        return indexResults;
      }

      logger.info('Part not found in InventoryIndexTable, falling back to full table scan');
    } catch (error) {
      logger.warn('InventoryIndexTable search failed, falling back to full scan', error);
    }

    // STEP 2: Fallback to searching all 11 tables (slow path ~5-10s)
    const allResults: InventorySearchResult[] = [];

    // Search across all inventory tables
    for (const tableName of INVENTORY_TABLE_NAMES) {
      try {
        const tableResults = await this.searchInTable(tableName, normalizedPN);
        allResults.push(...tableResults);
      } catch (error) {
        logger.error(`Failed to search table ${tableName}`, error);
        // Continue with other tables
      }
    }

    logger.info(`Excel search complete: ${allResults.length} results found`);
    return allResults;
  }

  /**
   * Get low stock parts from Excel
   * Note: This is a simplified version without usage analysis
   */
  async getLowStockParts(threshold: number = 5): Promise<LowStockResponse> {
    logger.info(`Getting low stock parts from Excel (threshold: ${threshold})`);

    const lowStockItems: LowStockItem[] = [];

    // Scan all tables for low stock
    for (const tableName of INVENTORY_TABLE_NAMES) {
      try {
        const rows = await excelService.getRowsFromTable('Inventory', tableName);
        const indices = await this.getColumnIndices(tableName);

        if (indices.partNumber === null || indices.qty === null) {
          continue;
        }

        rows.forEach((row, rowIndex) => {
          if (!row || !row.values || !row.values[0]) return;

          const pn = this.extractValue(row, indices, 'partNumber');
          const qty = this.extractNumber(row, indices, 'qty');

          if (qty > 0 && qty <= threshold) {
            // Determine urgency based on quantity
            let urgency: 'critical' | 'high' | 'medium' | 'low';
            if (qty === 0) {
              urgency = 'critical';
            } else if (qty <= 1) {
              urgency = 'critical';
            } else if (qty <= 2) {
              urgency = 'high';
            } else if (qty <= threshold / 2) {
              urgency = 'medium';
            } else {
              urgency = 'low';
            }

            lowStockItems.push({
              partNumber: pn,
              tableName: tableName,
              rowId: String(rowIndex),
              serialNumber: this.extractValue(row, indices, 'serial'),
              qty: qty,
              threshold: threshold,
              urgency: urgency,
              // Excel fallback doesn't have usage data
              daysUntilOut: undefined,
              avgUsagePerDay: undefined,
              recommendedReorder: Math.max(threshold * 2, 10),
              lastActivity: this.extractValue(row, indices, 'tagDate')
            });
          }
        });
      } catch (error) {
        logger.error(`Failed to scan table ${tableName} for low stock`, error);
      }
    }

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    lowStockItems.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return {
      threshold,
      totalLowStockItems: lowStockItems.length,
      criticalItems: lowStockItems.filter(i => i.urgency === 'critical').length,
      highUrgencyItems: lowStockItems.filter(i => i.urgency === 'high').length,
      items: lowStockItems
    };
  }

  /**
   * Decrement inventory in Excel
   * Note: This requires write access to Excel and uses sessions
   */
  async decrementInventory(
    _indexId: string,
    partNumber: string,
    tableName: string,
    rowId: string,
    _roNumber?: string,
    _notes?: string
  ): Promise<InventoryDecrementResult> {
    logger.info(`Decrementing inventory in Excel: ${partNumber} from ${tableName} row ${rowId}`);

    try {
      // Get current row data
      const rows = await excelService.getRowsFromTable('Inventory', tableName);
      const rowIndex = parseInt(rowId, 10);

      if (rowIndex < 0 || rowIndex >= rows.length) {
        return {
          success: false,
          newQty: 0,
          isLowStock: true,
          message: 'Row not found'
        };
      }

      const row = rows[rowIndex];
      const indices = await this.getColumnIndices(tableName);
      const currentQty = this.extractNumber(row, indices, 'qty');

      if (currentQty < 1) {
        return {
          success: false,
          newQty: currentQty,
          isLowStock: true,
          message: 'Insufficient quantity'
        };
      }

      // TODO: Implement Excel update via Graph API
      // For now, return error indicating write operations not fully implemented
      logger.warn('Excel inventory decrement not fully implemented - requires Graph API write operations');

      return {
        success: false,
        newQty: currentQty,
        isLowStock: false,
        message: 'Excel write operations not yet implemented. Please use MySQL when available.'
      };

      // Future implementation would:
      // 1. Use excelService session manager
      // 2. Update the qty cell
      // 3. Log transaction to TransactionsTable
      // 4. Return updated qty and low stock status
    } catch (error) {
      logger.error('Failed to decrement inventory in Excel', error);
      return {
        success: false,
        newQty: 0,
        isLowStock: true,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear column indices cache (useful for testing or schema changes)
   */
  clearCache(): void {
    this.columnIndicesCache.clear();
    logger.info('Column indices cache cleared');
  }
}

export const excelInventoryService = new ExcelInventoryService();
