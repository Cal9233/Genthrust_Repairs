import { useState, useMemo, useEffect } from "react";
import type { RepairOrder } from "../types";
import { loadFilters, saveFilters } from "../utils/filterStorage";

export interface Filters {
  overdue: boolean;
  dueThisWeek: boolean;
  highValue: boolean;
  shop: string | null;
  waitingAction: boolean;
  excludedShops: string[];
  selectedStatuses: string[];
}

const HIGH_VALUE_THRESHOLD = 5000;

/**
 * Hook to manage repair order filters
 */
export function useROFilters(ros: RepairOrder[]) {
  const [filters, setFilters] = useState<Filters>(() => {
    // Load saved filters from localStorage on mount
    const savedFilters = loadFilters();
    return savedFilters ?? {
      overdue: false,
      dueThisWeek: false,
      highValue: false,
      shop: null,
      waitingAction: false,
      excludedShops: [],
      selectedStatuses: [],
    };
  });

  // Auto-save filters to localStorage whenever they change
  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  const filteredROs = useMemo(() => {
    let filtered = ros;

    // Filter: Overdue
    if (filters.overdue) {
      filtered = filtered.filter((ro) => ro.isOverdue);
    }

    // Filter: Due This Week
    if (filters.dueThisWeek) {
      const today = new Date();
      const oneWeekFromNow = new Date(today);
      oneWeekFromNow.setDate(today.getDate() + 7);

      filtered = filtered.filter((ro) => {
        if (!ro.nextDateToUpdate) return false;
        const nextDate = new Date(ro.nextDateToUpdate);
        return nextDate >= today && nextDate <= oneWeekFromNow;
      });
    }

    // Filter: High Value
    if (filters.highValue) {
      filtered = filtered.filter(
        (ro) =>
          (ro.estimatedCost && ro.estimatedCost > HIGH_VALUE_THRESHOLD) ||
          (ro.finalCost && ro.finalCost > HIGH_VALUE_THRESHOLD)
      );
    }

    // Filter: By Shop
    if (filters.shop) {
      filtered = filtered.filter((ro) => ro.shopName === filters.shop);
    }

    // Filter: Waiting My Action (quotes needing approval)
    if (filters.waitingAction) {
      filtered = filtered.filter((ro) =>
        ro.currentStatus.includes("WAITING QUOTE")
      );
    }

    // Filter: Exclude Shops (hide selected shops)
    if (filters.excludedShops.length > 0) {
      filtered = filtered.filter(
        (ro) => !filters.excludedShops.includes(ro.shopName)
      );
    }

    // Filter: Selected Statuses (show only selected, or all if none selected)
    if (filters.selectedStatuses.length > 0) {
      filtered = filtered.filter((ro) =>
        filters.selectedStatuses.includes(ro.currentStatus)
      );
    }

    return filtered;
  }, [ros, filters]);

  const setFilter = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      overdue: false,
      dueThisWeek: false,
      highValue: false,
      shop: null,
      waitingAction: false,
      excludedShops: [],
      selectedStatuses: [],
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== false && value !== null;
  }).length;

  return {
    filters,
    setFilter,
    clearFilters,
    filteredROs,
    activeFilterCount,
  };
}
