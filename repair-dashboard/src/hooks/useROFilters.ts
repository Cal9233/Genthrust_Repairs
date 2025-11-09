import { useState, useMemo } from "react";
import type { RepairOrder } from "../types";

export interface Filters {
  overdue: boolean;
  dueThisWeek: boolean;
  highValue: boolean;
  shop: string | null;
  waitingAction: boolean;
}

const HIGH_VALUE_THRESHOLD = 5000;

/**
 * Hook to manage repair order filters
 */
export function useROFilters(ros: RepairOrder[]) {
  const [filters, setFilters] = useState<Filters>({
    overdue: false,
    dueThisWeek: false,
    highValue: false,
    shop: null,
    waitingAction: false,
  });

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
    });
  };

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== false && value !== null
  ).length;

  return {
    filters,
    setFilter,
    clearFilters,
    filteredROs,
    activeFilterCount,
  };
}
