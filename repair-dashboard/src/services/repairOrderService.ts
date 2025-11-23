/**
 * MySQL-based Repair Order Service
 * Connects to the backend API which interfaces with MySQL database
 * Phase 3: Primary data store migration from Excel to MySQL
 */

import { RepairOrder, DashboardStats } from '@/types';
import { createLogger } from '@/utils/logger';

const logger = createLogger('RepairOrderService');
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Helper: Convert date string from API to Date object
 */
const parseDate = (dateStr: string | null): Date | null => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch (e) {
    logger.error('Failed to parse date', e, { dateStr });
    return null;
  }
};

/**
 * Helper: Convert Date object to ISO string for API
 */
const formatDate = (date: Date | null): string | null => {
  if (!date) return null;
  try {
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  } catch (e) {
    logger.error('Failed to format date', e, { date });
    return null;
  }
};

/**
 * Helper: Map API response to RepairOrder interface with Date objects
 */
const mapApiResponseToRepairOrder = (data: any): RepairOrder => {
  return {
    ...data,
    dateMade: parseDate(data.dateMade),
    dateDroppedOff: parseDate(data.dateDroppedOff),
    estimatedDeliveryDate: parseDate(data.estimatedDeliveryDate),
    currentStatusDate: parseDate(data.currentStatusDate),
    lastDateUpdated: parseDate(data.lastDateUpdated),
    nextDateToUpdate: parseDate(data.nextDateToUpdate),
    statusHistory: data.statusHistory || [],
    // Compute overdue status
    daysOverdue: data.nextDateToUpdate
      ? Math.max(0, Math.floor((Date.now() - new Date(data.nextDateToUpdate).getTime()) / (1000 * 60 * 60 * 24)))
      : 0,
    isOverdue: data.nextDateToUpdate ? new Date(data.nextDateToUpdate) < new Date() : false
  };
};

/**
 * Helper: Map RepairOrder to API request format
 */
const mapRepairOrderToApiRequest = (ro: Partial<RepairOrder>): any => {
  const mapped: any = { ...ro };

  // Convert Date objects to ISO strings
  if (ro.dateMade) mapped.dateMade = formatDate(ro.dateMade);
  if (ro.dateDroppedOff) mapped.dateDroppedOff = formatDate(ro.dateDroppedOff);
  if (ro.estimatedDeliveryDate) mapped.estimatedDeliveryDate = formatDate(ro.estimatedDeliveryDate);
  if (ro.currentStatusDate) mapped.currentStatusDate = formatDate(ro.currentStatusDate);
  if (ro.lastDateUpdated) mapped.lastDateUpdated = formatDate(ro.lastDateUpdated);
  if (ro.nextDateToUpdate) mapped.nextDateToUpdate = formatDate(ro.nextDateToUpdate);

  // Remove computed fields
  delete mapped.daysOverdue;
  delete mapped.isOverdue;

  return mapped;
};

class RepairOrderService {
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
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
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
   * Get all repair orders (default: ACTIVE only)
   * @param archiveStatus - Filter by archive status (ACTIVE, PAID, NET, RETURNED)
   */
  async getRepairOrders(archiveStatus: 'ACTIVE' | 'PAID' | 'NET' | 'RETURNED' = 'ACTIVE'): Promise<RepairOrder[]> {
    logger.info('Fetching repair orders', { archiveStatus });

    try {
      const data = await this.apiRequest<any[]>(
        `/api/ros?archiveStatus=${archiveStatus}`
      );

      const repairOrders = data.map(mapApiResponseToRepairOrder);

      logger.info('Repair orders fetched', {
        archiveStatus,
        count: repairOrders.length
      });

      return repairOrders;
    } catch (error) {
      logger.error('Failed to fetch repair orders', error, { archiveStatus });
      throw error;
    }
  }

  /**
   * Get archived repair orders by sheet name
   * @param sheetName - Archive sheet name (Paid, NET, Returns)
   */
  async getArchivedROs(sheetName: 'Paid' | 'NET' | 'Returns'): Promise<RepairOrder[]> {
    // Map sheet names to archiveStatus
    const statusMap: Record<string, 'PAID' | 'NET' | 'RETURNED'> = {
      'Paid': 'PAID',
      'NET': 'NET',
      'Returns': 'RETURNED'
    };

    const archiveStatus = statusMap[sheetName];
    return this.getRepairOrders(archiveStatus);
  }

  /**
   * Get single repair order by ID
   */
  async getRepairOrderById(id: string): Promise<RepairOrder> {
    logger.info('Fetching repair order', { id });

    try {
      const data = await this.apiRequest<any>(`/api/ros/${id}`);
      return mapApiResponseToRepairOrder(data);
    } catch (error) {
      logger.error('Failed to fetch repair order', error, { id });
      throw error;
    }
  }

  /**
   * Create new repair order
   */
  async addRepairOrder(ro: Partial<RepairOrder>): Promise<RepairOrder> {
    logger.info('Creating repair order', { roNumber: ro.roNumber });

    try {
      const requestData = mapRepairOrderToApiRequest(ro);

      const data = await this.apiRequest<any>('/api/ros', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      logger.info('Repair order created', {
        id: data.id,
        roNumber: data.roNumber
      });

      return mapApiResponseToRepairOrder(data);
    } catch (error) {
      logger.error('Failed to create repair order', error, {
        roNumber: ro.roNumber
      });
      throw error;
    }
  }

  /**
   * Update repair order
   */
  async updateRepairOrder(id: string, updates: Partial<RepairOrder>): Promise<RepairOrder> {
    logger.info('Updating repair order', { id, updates });

    try {
      const requestData = mapRepairOrderToApiRequest(updates);

      const data = await this.apiRequest<any>(`/api/ros/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(requestData)
      });

      logger.info('Repair order updated', { id });

      return mapApiResponseToRepairOrder(data);
    } catch (error) {
      logger.error('Failed to update repair order', error, { id });
      throw error;
    }
  }

  /**
   * Update repair order status
   */
  async updateROStatus(
    id: string,
    status: string,
    notes?: string,
    cost?: number,
    deliveryDate?: Date
  ): Promise<RepairOrder> {
    logger.info('Updating repair order status', {
      id,
      status,
      notes,
      cost,
      deliveryDate
    });

    const updates: Partial<RepairOrder> = {
      currentStatus: status,
      currentStatusDate: new Date(),
      lastDateUpdated: new Date(),
    };

    if (notes) {
      // Append to existing notes
      updates.notes = notes;
    }

    if (cost !== undefined) {
      updates.finalCost = cost;
    }

    if (deliveryDate) {
      updates.estimatedDeliveryDate = deliveryDate;
    }

    return this.updateRepairOrder(id, updates);
  }

  /**
   * Archive repair order (soft delete by changing archiveStatus)
   */
  async archiveRepairOrder(
    id: string,
    archiveStatus: 'PAID' | 'NET' | 'RETURNED'
  ): Promise<RepairOrder> {
    logger.info('Archiving repair order', { id, archiveStatus });

    return this.updateRepairOrder(id, { archiveStatus });
  }

  /**
   * Delete repair order (permanent delete)
   */
  async deleteRepairOrder(id: string): Promise<void> {
    logger.info('Deleting repair order', { id });

    try {
      await this.apiRequest<{ success: boolean; message: string }>(
        `/api/ros/${id}`,
        { method: 'DELETE' }
      );

      logger.info('Repair order deleted', { id });
    } catch (error) {
      logger.error('Failed to delete repair order', error, { id });
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    logger.info('Fetching dashboard statistics');

    try {
      const stats = await this.apiRequest<DashboardStats>('/api/ros/stats/dashboard');

      logger.info('Dashboard statistics fetched', stats);

      return stats;
    } catch (error) {
      logger.error('Failed to fetch dashboard statistics', error);
      throw error;
    }
  }

  /**
   * Search repair orders by RO number
   */
  async searchByRONumber(roNumber: string): Promise<RepairOrder[]> {
    logger.info('Searching repair orders', { roNumber });

    try {
      // Get all active ROs and filter client-side
      // TODO: Add backend endpoint for search if needed
      const ros = await this.getRepairOrders('ACTIVE');
      return ros.filter(ro =>
        ro.roNumber.toLowerCase().includes(roNumber.toLowerCase())
      );
    } catch (error) {
      logger.error('Failed to search repair orders', error, { roNumber });
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      return response.ok;
    } catch (error) {
      logger.error('Health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const repairOrderService = new RepairOrderService();
