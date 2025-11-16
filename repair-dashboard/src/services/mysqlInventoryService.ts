/**
 * MySQL-based Inventory Service
 * Connects to the backend API which interfaces with MySQL database
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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

class MySQLInventoryService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = API_BASE_URL;
  }

  /**
   * Make API request with error handling
   */
  private async apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[MySQL Inventory Service] API request failed:`, error);
      throw error;
    }
  }

  /**
   * Search inventory by part number
   */
  async searchInventory(partNumber: string): Promise<InventorySearchResult[]> {
    if (!partNumber || partNumber.trim() === '') {
      return [];
    }

    console.log(`[MySQL Inventory Service] Searching for part: ${partNumber}`);

    try {
      const results = await this.apiRequest<InventorySearchResult[]>(
        `/inventory/search?partNumber=${encodeURIComponent(partNumber)}`
      );

      console.log(`[MySQL Inventory Service] Found ${results.length} matches`);
      return results;
    } catch (error) {
      console.error('[MySQL Inventory Service] Search failed:', error);
      throw error;
    }
  }

  /**
   * Get full details for a specific inventory item
   */
  async getInventoryDetails(_tableName: string, _rowId: string): Promise<any> {
    // For now, return empty object. Can be expanded to get full row data if needed
    return {};
  }

  /**
   * Get column headers for a specific inventory table
   */
  async getTableColumns(_tableName: string): Promise<string[]> {
    // This would require an additional backend endpoint
    // For now, return empty array
    return [];
  }

  /**
   * Decrement inventory quantity
   */
  async decrementInventory(
    indexId: string,
    partNumber: string,
    _tableName: string,
    _rowId: string,
    roNumber?: string,
    notes?: string
  ): Promise<InventoryDecrementResult> {
    console.log(`[MySQL Inventory Service] Decrementing inventory: ${partNumber}`);

    try {
      const result = await this.apiRequest<InventoryDecrementResult>(
        '/inventory/decrement',
        {
          method: 'POST',
          body: JSON.stringify({
            indexId,
            partNumber,
            roNumber,
            notes,
          }),
        }
      );

      console.log(`[MySQL Inventory Service] Decrement successful:`, result);
      return result;
    } catch (error) {
      console.error('[MySQL Inventory Service] Decrement failed:', error);
      throw error;
    }
  }

  /**
   * Log an inventory transaction
   */
  async logInventoryTransaction(_transaction: Omit<InventoryTransaction, 'transactionId' | 'timestamp' | 'user'>): Promise<void> {
    // Transaction logging is handled automatically by the backend during decrement
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<{
    totalItems: number;
    totalQuantity: number;
    lowStockCount: number;
    recentTransactions: number;
  }> {
    try {
      const stats = await this.apiRequest<{
        totalItems: number;
        totalQuantity: number;
        lowStockCount: number;
        recentTransactions: number;
      }>('/inventory/stats');

      console.log('[MySQL Inventory Service] Stats retrieved:', stats);
      return stats;
    } catch (error) {
      console.error('[MySQL Inventory Service] Get stats failed:', error);
      throw error;
    }
  }

  /**
   * Check if the MySQL service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl.replace('/api', '')}/health`);
      return response.ok;
    } catch (error) {
      console.error('[MySQL Inventory Service] Health check failed:', error);
      return false;
    }
  }
}

export const mysqlInventoryService = new MySQLInventoryService();
