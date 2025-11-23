/**
 * Data Source Helpers
 *
 * Utilities for managing hybrid MySQL/Excel data sources including:
 * - ID format conversion (MySQL "42" ↔ Excel "row-23")
 * - Data source detection
 * - RO lookup and matching
 */

import type { RepairOrder } from '@/types';
import { createLogger } from './logger';

const logger = createLogger('DataSourceHelpers');

/**
 * Detect which data source an RO ID belongs to
 */
export function detectDataSource(id: string): 'mysql' | 'excel' {
  if (id.startsWith('row-')) {
    return 'excel';
  }
  return 'mysql';
}

/**
 * Extract row index from Excel RO ID
 * @param ro - RepairOrder with Excel ID format ("row-23")
 * @returns Row index as number (23)
 * @throws Error if ID is not in Excel format
 */
export function getRowIndexFromExcelRO(ro: RepairOrder): number {
  if (!ro.id.startsWith('row-')) {
    throw new Error(
      `Cannot extract row index from non-Excel RO ID: ${ro.id}. ` +
      `Expected format: "row-X", got: "${ro.id}"`
    );
  }

  const rowIndex = parseInt(ro.id.replace('row-', ''), 10);

  if (isNaN(rowIndex)) {
    throw new Error(`Invalid Excel row index in ID: ${ro.id}`);
  }

  return rowIndex;
}

/**
 * Get MySQL ID from RO
 * @param ro - RepairOrder with MySQL ID format
 * @returns MySQL ID as string
 * @throws Error if ID is in Excel format
 */
export function getMySQLIdFromRO(ro: RepairOrder): string {
  if (ro.id.startsWith('row-')) {
    throw new Error(
      `Cannot use Excel RO with MySQL operations. ` +
      `ID "${ro.id}" is in Excel format (row-X). ` +
      `Please fetch data from MySQL or convert to Excel operations.`
    );
  }

  return ro.id;
}

/**
 * Find RO by number in a list (works with both MySQL and Excel IDs)
 * @param ros - Array of repair orders
 * @param roNumber - RO number to search for
 * @returns Found RepairOrder or undefined
 */
export function findROByNumber(ros: RepairOrder[], roNumber: string): RepairOrder | undefined {
  return ros.find(ro =>
    ro.roNumber.toString().toLowerCase().includes(roNumber.toLowerCase()) ||
    roNumber.toLowerCase().includes(ro.roNumber.toString().toLowerCase())
  );
}

/**
 * Check if all ROs in array are from same data source
 * @param ros - Array of repair orders
 * @returns 'mysql', 'excel', or 'mixed'
 */
export function getDataSourceType(ros: RepairOrder[]): 'mysql' | 'excel' | 'mixed' {
  if (ros.length === 0) {
    return 'mysql'; // Default
  }

  const sources = ros.map(ro => detectDataSource(ro.id));
  const uniqueSources = new Set(sources);

  if (uniqueSources.size === 1) {
    return sources[0];
  }

  return 'mixed';
}

/**
 * Validate RO is compatible with MySQL operations
 * @param ro - RepairOrder to validate
 * @throws Error if RO is in Excel format
 */
export function validateMySQLCompatible(ro: RepairOrder): void {
  if (ro.id.startsWith('row-')) {
    throw new Error(
      `RO ${ro.roNumber} (ID: ${ro.id}) is from Excel. ` +
      `Cannot perform MySQL operations on Excel data. ` +
      `Please refetch from MySQL or use Excel service.`
    );
  }
}

/**
 * Validate RO is compatible with Excel operations
 * @param ro - RepairOrder to validate
 * @throws Error if RO is in MySQL format
 */
export function validateExcelCompatible(ro: RepairOrder): void {
  if (!ro.id.startsWith('row-')) {
    throw new Error(
      `RO ${ro.roNumber} (ID: ${ro.id}) is from MySQL. ` +
      `Cannot perform Excel operations on MySQL data. ` +
      `Please use MySQL service or refetch from Excel.`
    );
  }
}

/**
 * Log data source information (for debugging)
 * @param context - Context string for logging
 * @param ros - Array of repair orders
 */
export function logDataSourceInfo(context: string, ros: RepairOrder[]): void {
  const sourceType = getDataSourceType(ros);
  const sampleIds = ros.slice(0, 3).map(ro => ro.id);

  logger.debug(`Data source info - ${context}`, {
    sourceType,
    count: ros.length,
    sampleIds,
  });
}

/**
 * Create a safe ID for logging (truncate long MySQL IDs)
 * @param id - RO ID
 * @returns Shortened ID for logging
 */
export function createLogSafeId(id: string): string {
  if (id.length > 20) {
    return `${id.slice(0, 17)}...`;
  }
  return id;
}
