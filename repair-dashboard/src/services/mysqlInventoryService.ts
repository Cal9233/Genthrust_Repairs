/**
 * MySQL-based Inventory Service
 * Connects to the backend API which interfaces with MySQL database
 */

import { createLogger } from '@/utils/logger';

const logger = createLogger('MySQLInventoryService');
// VITE_BACKEND_URL should already include the full API path (e.g., /.netlify/functions/api)
// No need to append '/api' - that would cause duplication
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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

export interface LowStockItem {
  indexId: string;
  partNumber: string;
  tableName: string;
  rowId: string;
  serialNumber: string;
  currentQty: number;
  condition: string;
  location: string;
  description: string;
  lastSeen: string;
  usage90Days: number;
  transactionCount90Days: number;
  monthlyUsageRate: number;
  lastUsedDate: string | null;
  lastRONumber: string | null;
  recommendedReorder: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  daysUntilStockout: number | null;
}

export interface LowStockResponse {
  threshold: number;
  totalLowStockItems: number;
  criticalItems: number;
  highUrgencyItems: number;
  items: LowStockItem[];
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
      logger.error('API request failed', error, {
        endpoint,
        method: options?.method || 'GET'
      });
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

    logger.info('Searching for part', { partNumber });

    try {
      const results = await this.apiRequest<InventorySearchResult[]>(
        `/inventory/search?partNumber=${encodeURIComponent(partNumber)}`
      );

      logger.info('Search completed', {
        partNumber,
        matchCount: results.length
      });
      return results;
    } catch (error) {
      logger.error('Search failed', error, { partNumber });
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
    logger.info('Decrementing inventory', {
      partNumber,
      indexId,
      roNumber
    });

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

      logger.info('Decrement successful', {
        partNumber,
        newQty: result.newQty,
        isLowStock: result.isLowStock
      });
      return result;
    } catch (error) {
      logger.error('Decrement failed', error, {
        partNumber,
        indexId
      });
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

      logger.info('Stats retrieved', stats);
      return stats;
    } catch (error) {
      logger.error('Get stats failed', error);
      throw error;
    }
  }

  /**
   * Get low stock parts with usage analysis
   */
  async getLowStockParts(threshold: number = 5): Promise<LowStockResponse> {
    logger.info('Getting low stock parts', { threshold });

    try {
      const response = await this.apiRequest<LowStockResponse>(
        `/inventory/low-stock?threshold=${threshold}`
      );

      logger.info('Low stock query completed', {
        threshold,
        totalItems: response.totalLowStockItems,
        criticalItems: response.criticalItems,
        highUrgencyItems: response.highUrgencyItems
      });

      return response;
    } catch (error) {
      logger.error('Low stock query failed', error, { threshold });
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
      logger.error('Health check failed', error);
      return false;
    }
  }
}

export const mysqlInventoryService = new MySQLInventoryService();
