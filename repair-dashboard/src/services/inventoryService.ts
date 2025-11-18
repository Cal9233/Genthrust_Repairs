/**
 * Inventory Service using MySQL backend
 *
 * This service connects to the MySQL backend API for inventory management.
 */

import type { IPublicClientApplication } from "@azure/msal-browser";
import { mysqlInventoryService } from "./mysqlInventoryService";
import { excelInventoryService } from "./excelInventoryService";
import type { LowStockResponse } from "./mysqlInventoryService";
import { createLogger } from '@/utils/logger';

const logger = createLogger('InventoryService');

export interface InventorySearchResult {
  indexId: string;
  partNumber: string;
  tableName: string;
  rowId: string;
  serialNumber: string;
  qty: number;
  condition: string;
  location: string;
  description: string;
  lastSeen: string;
}

export interface InventoryDecrementResult {
  success: boolean;
  newQty: number;
  isLowStock: boolean;
  message: string;
}

export interface InventoryTransaction {
  transactionId: string;
  timestamp: string;
  action: 'DECREMENT' | 'INCREMENT' | 'ADJUST';
  partNumber: string;
  tableName: string;
  rowId: string;
  delta: number;
  oldQty: number;
  newQty: number;
  roNumber?: string;
  user: string;
  notes?: string;
}

// Re-export types from mysqlInventoryService
export type { LowStockItem, LowStockResponse } from "./mysqlInventoryService";

class MySQLInventoryServiceWrapper {
  private mysqlAvailable: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // Check every 60 seconds

  setMsalInstance(_instance: IPublicClientApplication) {
    // MySQL service doesn't need MSAL, but keeping interface compatible
  }

  /**
   * Check if MySQL is available
   */
  private async checkMySQLHealth(): Promise<boolean> {
    const now = Date.now();

    // Only check health if it's been more than healthCheckInterval
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.mysqlAvailable;
    }

    try {
      this.mysqlAvailable = await mysqlInventoryService.healthCheck();
      this.lastHealthCheck = now;

      if (this.mysqlAvailable) {
        logger.info('MySQL backend is available');
      } else {
        logger.warn('MySQL backend is not responding');
      }

      return this.mysqlAvailable;
    } catch (error) {
      logger.warn('MySQL health check failed', error);
      this.mysqlAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Execute operation with automatic fallback to Excel
   */
  private async executeWithFallback<T>(
    operation: string,
    mysqlFn: () => Promise<T>,
    excelFn?: () => Promise<T>
  ): Promise<T> {
    // Check MySQL health first
    await this.checkMySQLHealth();

    // Try MySQL first
    try {
      logger.info(`Attempting ${operation} via MySQL`);
      const result = await mysqlFn();
      logger.info(`${operation} successful via MySQL`);

      // Mark MySQL as available if it was previously unavailable
      if (!this.mysqlAvailable) {
        this.mysqlAvailable = true;
        this.lastHealthCheck = Date.now();
      }

      return result;
    } catch (mysqlError) {
      logger.error(`MySQL ${operation} failed`, mysqlError);

      // Mark MySQL as unavailable
      this.mysqlAvailable = false;
      this.lastHealthCheck = Date.now();

      // Try Excel fallback if provided
      if (excelFn) {
        try {
          logger.warn(`Falling back to SharePoint Excel for ${operation}`);
          const result = await excelFn();
          logger.info(`${operation} successful via Excel fallback`, {
            operation,
            source: 'excel',
            timestamp: new Date().toISOString()
          });

          // Log that we're using fallback (non-critical warning)
          logger.warn('Operating in Excel fallback mode. MySQL backend unavailable.', {
            mysqlError: mysqlError instanceof Error ? mysqlError.message : 'unknown error'
          });

          return result;
        } catch (excelError) {
          logger.error(`Excel fallback for ${operation} also failed`, excelError);

          // Both failed - throw comprehensive error
          throw new Error(
            `Inventory operation failed on both MySQL and Excel sources:\n` +
            `MySQL: ${mysqlError instanceof Error ? mysqlError.message : 'unknown error'}\n` +
            `Excel: ${excelError instanceof Error ? excelError.message : 'unknown error'}`
          );
        }
      }

      // No fallback provided, throw original MySQL error
      throw new Error(
        `Inventory operation failed: ${mysqlError instanceof Error ? mysqlError.message : 'unknown error'}`
      );
    }
  }

  /**
   * Search inventory by part number
   */
  async searchInventory(partNumber: string): Promise<InventorySearchResult[]> {
    return this.executeWithFallback(
      'searchInventory',
      () => mysqlInventoryService.searchInventory(partNumber),
      () => excelInventoryService.searchInventory(partNumber)
    );
  }

  /**
   * Get full details for a specific inventory item
   */
  async getInventoryDetails(tableName: string, rowId: string): Promise<any> {
    return this.executeWithFallback(
      'getInventoryDetails',
      () => mysqlInventoryService.getInventoryDetails(tableName, rowId)
    );
  }

  /**
   * Get column headers for a specific inventory table
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    return this.executeWithFallback(
      'getTableColumns',
      () => mysqlInventoryService.getTableColumns(tableName)
    );
  }

  /**
   * Decrement inventory quantity
   * Note: Excel fallback for decrement operations is not yet implemented
   */
  async decrementInventory(
    indexId: string,
    partNumber: string,
    tableName: string,
    rowId: string,
    roNumber?: string,
    notes?: string
  ): Promise<InventoryDecrementResult> {
    return this.executeWithFallback(
      'decrementInventory',
      () => mysqlInventoryService.decrementInventory(indexId, partNumber, tableName, rowId, roNumber, notes),
      () => excelInventoryService.decrementInventory(indexId, partNumber, tableName, rowId, roNumber, notes)
    );
  }

  /**
   * Log an inventory transaction
   */
  async logInventoryTransaction(
    transaction: Omit<InventoryTransaction, 'transactionId' | 'timestamp' | 'user'>
  ): Promise<void> {
    return this.executeWithFallback(
      'logInventoryTransaction',
      () => mysqlInventoryService.logInventoryTransaction(transaction)
    );
  }

  /**
   * Get low stock parts with usage analysis and reorder recommendations
   */
  async getLowStockParts(threshold: number = 5): Promise<LowStockResponse> {
    return this.executeWithFallback(
      'getLowStockParts',
      () => mysqlInventoryService.getLowStockParts(threshold),
      () => excelInventoryService.getLowStockParts(threshold)
    );
  }

  /**
   * Get current data source status
   */
  getDataSourceStatus(): {
    current: 'mysql' | 'excel' | 'unknown';
    mysqlAvailable: boolean;
    usingExcelFallback: boolean;
  } {
    return {
      current: this.mysqlAvailable ? 'mysql' : 'excel',
      mysqlAvailable: this.mysqlAvailable,
      usingExcelFallback: !this.mysqlAvailable
    };
  }

  /**
   * Force a health check (useful for testing)
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastHealthCheck = 0; // Reset timestamp to force check
    return this.checkMySQLHealth();
  }
}

export const inventoryService = new MySQLInventoryServiceWrapper();
