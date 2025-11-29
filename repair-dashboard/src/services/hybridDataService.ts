/**
 * Hybrid Data Service
 *
 * Provides automatic fallback between MySQL backend and Excel SharePoint:
 * 1. Try MySQL backend first (faster, scalable)
 * 2. On failure, automatically fall back to Excel (reliable, always available)
 * 3. Cache fallback state to avoid repeated MySQL attempts
 * 4. Retry MySQL after timeout period
 * 5. Track metrics for monitoring
 *
 * Usage:
 *   const ros = await hybridDataService.getRepairOrders('ACTIVE');
 *   // Will try MySQL first, fall back to Excel if MySQL fails
 */

import { RepairOrder, DashboardStats } from '@/types';
import { repairOrderService } from './repairOrderService';
import { excelService } from '@/lib/excelService';
import { createLogger } from '@/utils/logger';
import { isDueToday, isOnTrack } from '@/lib/businessRules';
import { toast } from 'sonner';

const logger = createLogger('HybridDataService');

export interface HybridServiceMetrics {
  mysqlSuccessCount: number;
  mysqlFailureCount: number;
  excelFallbackCount: number;
  lastMySQLSuccess: number | null;
  lastMySQLFailure: number | null;
  lastFailureReason: string | null;
}

export type DataSource = 'mysql' | 'excel';

class HybridDataService {
  private fallbackMode: boolean = false;
  private lastMySQLAttempt: number = 0;
  private retryInterval: number = 60000; // 1 minute default
  private metrics: HybridServiceMetrics = {
    mysqlSuccessCount: 0,
    mysqlFailureCount: 0,
    excelFallbackCount: 0,
    lastMySQLSuccess: null,
    lastMySQLFailure: null,
    lastFailureReason: null,
  };

  /**
   * Determine if we should try MySQL based on fallback state and retry interval
   */
  private shouldTryMySQL(): boolean {
    if (!this.fallbackMode) {
      return true; // Not in fallback mode, always try MySQL
    }

    // In fallback mode - check if retry interval has passed
    const timeSinceLastAttempt = Date.now() - this.lastMySQLAttempt;
    const shouldRetry = timeSinceLastAttempt >= this.retryInterval;

    if (shouldRetry) {
      logger.info('Retry interval elapsed, attempting MySQL reconnection', {
        timeSinceLastAttempt,
        retryInterval: this.retryInterval,
      });
    }

    return shouldRetry;
  }

  /**
   * Handle successful MySQL operation
   */
  private onMySQLSuccess(): void {
    const wasInFallbackMode = this.fallbackMode;

    this.fallbackMode = false;
    this.metrics.mysqlSuccessCount++;
    this.metrics.lastMySQLSuccess = Date.now();

    if (wasInFallbackMode) {
      logger.info('✅ MySQL connection restored');
      toast.success('✅ Database reconnected - Now using primary database');
    }
  }

  /**
   * Handle MySQL failure
   */
  private onMySQLFailure(error: any): void {
    const wasInFallbackMode = this.fallbackMode;

    this.fallbackMode = true;
    this.lastMySQLAttempt = Date.now();
    this.metrics.mysqlFailureCount++;
    this.metrics.lastMySQLFailure = Date.now();
    this.metrics.lastFailureReason = error.message || 'Unknown error';

    if (!wasInFallbackMode) {
      // First failure - log warning and show user notification
      logger.warn('⚠️ MySQL backend unavailable, falling back to Excel', {
        error: error.message,
        errorType: error.name,
      });

      toast.warning('⚠️ Using local data - Backend database unavailable. Reading from Excel.');
    } else {
      // Still in fallback mode - just log
      logger.debug('MySQL still unavailable (in fallback mode)', {
        error: error.message,
      });
    }
  }

  /**
   * Execute operation with fallback logic
   */
  private async executeWithFallback<T>(
    operation: {
      mysql: () => Promise<T>;
      excel: () => Promise<T>;
      operationName: string;
    }
  ): Promise<{ data: T; source: DataSource }> {
    const { mysql, excel, operationName } = operation;

    // Try MySQL first (if not in permanent fallback mode)
    if (this.shouldTryMySQL()) {
      try {
        logger.debug(`Attempting ${operationName} via MySQL`);
        const data = await mysql();
        this.onMySQLSuccess();
        return { data, source: 'mysql' };
      } catch (error: any) {
        logger.warn(`MySQL ${operationName} failed, falling back to Excel`, {
          error: error.message,
        });
        this.onMySQLFailure(error);
        // Continue to Excel fallback
      }
    }

    // Fallback to Excel
    try {
      logger.debug(`Executing ${operationName} via Excel (fallback)`);
      const data = await excel();
      this.metrics.excelFallbackCount++;
      return { data, source: 'excel' };
    } catch (excelError: any) {
      // Both sources failed - throw detailed error
      logger.error(`Both MySQL and Excel failed for ${operationName}`, {
        mysqlError: this.metrics.lastFailureReason,
        excelError: excelError.message,
      });

      toast.error('❌ Failed to load data - Both database and Excel are unavailable. Please check your connection.');

      throw new Error(
        `Both data sources failed for ${operationName}. ` +
        `MySQL: ${this.metrics.lastFailureReason || 'Unknown'}; ` +
        `Excel: ${excelError.message || 'Unknown'}`
      );
    }
  }

  /**
   * Get repair orders with fallback
   */
  async getRepairOrders(archiveStatus: 'ACTIVE' | 'PAID' | 'NET' | 'RETURNED' = 'ACTIVE'): Promise<RepairOrder[]> {
    const { data } = await this.executeWithFallback({
      mysql: () => repairOrderService.getRepairOrders(archiveStatus),
      excel: async () => {
        if (archiveStatus === 'ACTIVE') {
          return excelService.getRepairOrders();
        } else {
          // Map archive status to Excel sheet names
          const sheetMap: Record<string, { sheet: string; table: string }> = {
            PAID: { sheet: 'Paid', table: 'Paid' },
            NET: { sheet: 'NET', table: 'NET' },
            RETURNED: { sheet: 'Returns', table: 'Returns' },
          };

          const { sheet, table } = sheetMap[archiveStatus] || { sheet: 'Paid', table: 'Paid' };
          return excelService.getRepairOrdersFromSheet(sheet, table);
        }
      },
      operationName: `getRepairOrders(${archiveStatus})`,
    });

    return data;
  }

  /**
   * Get archived ROs with fallback
   */
  async getArchivedROs(sheetName: 'Paid' | 'NET' | 'Returns'): Promise<RepairOrder[]> {
    const statusMap: Record<string, 'PAID' | 'NET' | 'RETURNED'> = {
      Paid: 'PAID',
      NET: 'NET',
      Returns: 'RETURNED',
    };

    const archiveStatus = statusMap[sheetName] || 'PAID';

    const { data } = await this.executeWithFallback({
      mysql: () => repairOrderService.getArchivedROs(sheetName),
      excel: () => {
        // Determine table name based on sheet
        const tableName = sheetName; // Usually same as sheet name
        return excelService.getRepairOrdersFromSheet(sheetName, tableName);
      },
      operationName: `getArchivedROs(${sheetName})`,
    });

    return data;
  }

  /**
   * Get dashboard stats with fallback
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const { data, source } = await this.executeWithFallback({
      mysql: () => repairOrderService.getDashboardStats(),
      excel: async (): Promise<DashboardStats> => {
        // Fetch ROs from Excel and calculate stats locally
        const ros = await excelService.getRepairOrders();

        return {
          totalActive: ros.filter(
            (ro) =>
              !ro.currentStatus.includes('PAID') &&
              ro.currentStatus !== 'PAYMENT SENT' &&
              ro.currentStatus !== 'BER' &&
              !ro.currentStatus.includes('CANCEL') &&
              !ro.currentStatus.includes('RAI') &&
              !ro.currentStatus.includes('SCRAPPED')
          ).length,
          overdue: ros.filter((ro) => ro.isOverdue).length,
          waitingQuote: ros.filter((ro) => ro.currentStatus.includes('WAITING QUOTE')).length,
          approved: ros.filter((ro) => ro.currentStatus.includes('APPROVED')).length,
          beingRepaired: ros.filter((ro) => ro.currentStatus.includes('BEING REPAIRED')).length,
          shipping: ros.filter((ro) => ro.currentStatus.includes('SHIPPING')).length,
          totalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || ro.estimatedCost || 0), 0),
          totalEstimatedValue: ros.reduce((sum, ro) => sum + (ro.estimatedCost || 0), 0),
          totalFinalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || 0), 0),
          dueToday: ros.filter((ro) => isDueToday(ro.nextDateToUpdate)).length,
          overdue30Plus: ros.filter((ro) => ro.daysOverdue > 30).length,
          onTrack: ros.filter((ro) => isOnTrack(ro.nextDateToUpdate)).length,
          approvedPaid: ros.filter(
            (ro) => ro.currentStatus.includes('PAID') || ro.currentStatus === 'PAYMENT SENT'
          ).length,
          rai: ros.filter((ro) => ro.currentStatus.includes('RAI')).length,
          ber: ros.filter((ro) => ro.currentStatus.includes('BER')).length,
          cancel: ros.filter((ro) => ro.currentStatus.includes('CANCEL')).length,
          scrapped: ros.filter((ro) => ro.currentStatus.includes('SCRAPPED')).length,
          approvedNet: ros.filter(
            (ro) => ro.currentStatus.includes('NET') || ro.terms?.includes('NET')
          ).length,
        };
      },
      operationName: 'getDashboardStats',
    });

    return data;
  }

  /**
   * Add repair order with fallback
   * Note: For mutations, we prefer Excel fallback since MySQL may have sync issues
   */
  async addRepairOrder(data: Partial<RepairOrder>): Promise<RepairOrder> {
    const { data: createdRO } = await this.executeWithFallback({
      mysql: () => repairOrderService.addRepairOrder(data),
      excel: () => excelService.addRepairOrder(data),
      operationName: 'addRepairOrder',
    });

    return createdRO;
  }

  /**
   * Update repair order with fallback
   * Note: Requires either MySQL id or Excel rowIndex
   */
  async updateRepairOrder(idOrRowIndex: string | number, data: Partial<RepairOrder>): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';

    const { data: updatedRO } = await this.executeWithFallback({
      mysql: async () => {
        if (isExcelRowIndex) {
          throw new Error('Cannot update Excel row via MySQL. Please use Excel service directly.');
        }
        return repairOrderService.updateRepairOrder(idOrRowIndex as string, data);
      },
      excel: async () => {
        if (!isExcelRowIndex) {
          throw new Error('Cannot update MySQL record via Excel. Please provide Excel row index.');
        }
        return excelService.updateRepairOrder(idOrRowIndex as number, data);
      },
      operationName: 'updateRepairOrder',
    });

    return updatedRO;
  }

  /**
   * Update RO status with fallback
   */
  async updateROStatus(
    idOrRowIndex: string | number,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';

    const { data: updatedRO } = await this.executeWithFallback({
      mysql: async () => {
        if (isExcelRowIndex) {
          throw new Error('Cannot update Excel row via MySQL.');
        }
        return repairOrderService.updateROStatus(idOrRowIndex as string, status, notes, cost, deliveryDate);
      },
      excel: async () => {
        if (!isExcelRowIndex) {
          throw new Error('Cannot update MySQL record via Excel.');
        }
        return excelService.updateROStatus(idOrRowIndex as number, status, notes, cost, deliveryDate);
      },
      operationName: 'updateROStatus',
    });

    return updatedRO;
  }

  /**
   * Delete repair order with fallback
   * @deprecated Use deleteRepairOrderByNumber() instead for reliable cross-source deletion
   */
  async deleteRepairOrder(idOrRowIndex: string | number): Promise<void> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';

    await this.executeWithFallback({
      mysql: async () => {
        if (isExcelRowIndex) {
          throw new Error('Cannot delete Excel row via MySQL.');
        }
        return repairOrderService.deleteRepairOrder(idOrRowIndex as string);
      },
      excel: async () => {
        if (!isExcelRowIndex) {
          throw new Error('Cannot delete MySQL record via Excel.');
        }
        return excelService.deleteRepairOrder(idOrRowIndex as number);
      },
      operationName: 'deleteRepairOrder',
    });
  }

  /**
   * Delete repair order by RO number (universal identifier)
   * This method uses roNumber as a universal identifier that works across both MySQL and Excel.
   * MySQL first, Excel fallback pattern is maintained.
   *
   * @param roNumber - The unique RO number (e.g., "RO-00001")
   */
  async deleteRepairOrderByNumber(roNumber: string): Promise<void> {
    await this.executeWithFallback({
      mysql: async () => {
        await repairOrderService.deleteByRONumber(roNumber);
        return undefined;
      },
      excel: async () => {
        await excelService.deleteRepairOrderByRONumber(roNumber);
        return undefined;
      },
      operationName: `deleteRepairOrderByNumber(${roNumber})`,
    });
  }

  /**
   * Archive repair order with fallback
   */
  async archiveRepairOrder(
    idOrRowIndex: string | number,
    archiveStatusOrSheet: 'PAID' | 'NET' | 'RETURNED' | string
  ): Promise<RepairOrder> {
    const isExcelRowIndex = typeof idOrRowIndex === 'number';

    const { data: archivedRO } = await this.executeWithFallback({
      mysql: async () => {
        if (isExcelRowIndex) {
          throw new Error('Cannot archive Excel row via MySQL.');
        }
        return repairOrderService.archiveRepairOrder(
          idOrRowIndex as string,
          archiveStatusOrSheet as 'PAID' | 'NET' | 'RETURNED'
        );
      },
      excel: async () => {
        if (!isExcelRowIndex) {
          throw new Error('Cannot archive MySQL record via Excel.');
        }

        // Determine table name from sheet name
        const targetTableName = archiveStatusOrSheet; // Usually same
        return excelService.moveROToArchive(idOrRowIndex as number, archiveStatusOrSheet, targetTableName);
      },
      operationName: 'archiveRepairOrder',
    });

    return archivedRO;
  }

  /**
   * Check if currently in fallback mode
   */
  isInFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Get current metrics
   */
  getMetrics(): HybridServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Set retry interval (for testing)
   */
  setRetryInterval(ms: number): void {
    this.retryInterval = ms;
    logger.debug('Retry interval updated', { retryInterval: ms });
  }

  /**
   * Reset fallback state (for testing)
   */
  resetFallbackState(): void {
    this.fallbackMode = false;
    this.lastMySQLAttempt = 0;
    logger.debug('Fallback state reset');
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      mysqlSuccessCount: 0,
      mysqlFailureCount: 0,
      excelFallbackCount: 0,
      lastMySQLSuccess: null,
      lastMySQLFailure: null,
      lastFailureReason: null,
    };
    logger.debug('Metrics reset');
  }
}

// Export singleton instance
export const hybridDataService = new HybridDataService();

// Export class for testing
export { HybridDataService };
