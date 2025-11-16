/**
 * Inventory Service using MySQL backend
 *
 * This service connects to the MySQL backend API for inventory management.
 */

import type { IPublicClientApplication } from "@azure/msal-browser";
import { mysqlInventoryService } from "./mysqlInventoryService";

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
        console.log('[Hybrid Inventory] ✓ MySQL backend is available');
      } else {
        console.warn('[Hybrid Inventory] ⚠ MySQL backend is not responding, will use SharePoint');
      }

      return this.mysqlAvailable;
    } catch (error) {
      console.warn('[Hybrid Inventory] ⚠ MySQL health check failed:', error);
      this.mysqlAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Execute operation with automatic fallback
   */
  private async executeWithFallback<T>(
    operation: string,
    mysqlFn: () => Promise<T>
  ): Promise<T> {
    // Check MySQL health first
    await this.checkMySQLHealth();

    // Try MySQL
    try {
      console.log(`[Inventory] Attempting ${operation} via MySQL`);
      const result = await mysqlFn();
      console.log(`[Inventory] ✓ ${operation} successful`);

      // Mark MySQL as available if it was previously unavailable
      if (!this.mysqlAvailable) {
        this.mysqlAvailable = true;
        this.lastHealthCheck = Date.now();
      }

      return result;
    } catch (error) {
      console.error(`[Inventory] ✗ MySQL ${operation} failed:`, error);

      // Mark MySQL as unavailable
      this.mysqlAvailable = false;
      this.lastHealthCheck = Date.now();

      throw new Error(
        `Inventory operation failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  }

  /**
   * Search inventory by part number
   */
  async searchInventory(partNumber: string): Promise<InventorySearchResult[]> {
    return this.executeWithFallback(
      'searchInventory',
      () => mysqlInventoryService.searchInventory(partNumber)
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
      () => mysqlInventoryService.decrementInventory(indexId, partNumber, tableName, rowId, roNumber, notes)
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
   * Get current data source status
   */
  getDataSourceStatus(): { current: 'mysql'; mysqlAvailable: boolean } {
    return {
      current: 'mysql',
      mysqlAvailable: this.mysqlAvailable
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
