import type { RepairOrder } from "../../types";
import type { ShopAnalyticsProfile } from "../../services/analyticsEngine";

/**
 * Sort direction for table columns
 */
export type SortDirection = "asc" | "desc";

/**
 * Valid sort columns for ROTable
 */
export type SortColumn = keyof RepairOrder | "finalCost";

/**
 * Filter options for RO list
 */
export interface ROFilters {
  overdue: boolean;
  dueThisWeek: boolean;
  highValue: boolean;
  waitingAction: boolean;
}

/**
 * Available view types for ROTable
 */
export type ViewType = "active" | "archive";

/**
 * Archive sheet configuration
 */
export interface ArchiveConfig {
  sheetName: string;
  tableName: string;
}
