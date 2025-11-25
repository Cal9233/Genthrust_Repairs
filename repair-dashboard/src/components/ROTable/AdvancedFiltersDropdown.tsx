import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, X } from "lucide-react";
import type { RepairOrder } from "@/types";
import type { Filters } from "@/hooks/useROFilters";

interface AdvancedFiltersDropdownProps {
  /** All repair orders (used to extract unique values) */
  ros: RepairOrder[];
  /** Current filter state */
  filters: Filters;
  /** Handler for updating a filter */
  setFilter: (key: keyof Filters, value: any) => void;
  /** Handler for clearing all filters */
  clearFilters: () => void;
}

/**
 * AdvancedFiltersDropdown - Dropdown menu for shop exclusion and status filtering
 *
 * Features:
 * - Multi-select shop exclusion (hide selected shops)
 * - Multi-select status filtering (show only selected statuses)
 * - Badge showing number of active advanced filters
 * - Clear all filters button
 * - Alphabetically sorted options
 *
 * @example
 * ```tsx
 * <AdvancedFiltersDropdown
 *   ros={repairOrders}
 *   filters={filters}
 *   setFilter={setFilter}
 *   clearFilters={clearFilters}
 * />
 * ```
 */
export const AdvancedFiltersDropdown = memo<AdvancedFiltersDropdownProps>(({
  ros,
  filters,
  setFilter,
  clearFilters,
}) => {
  // Extract unique shop names and sort alphabetically
  const uniqueShops = useMemo(() => {
    const shops = new Set(ros.map((ro) => ro.shopName).filter(Boolean));
    return Array.from(shops).sort();
  }, [ros]);

  // Extract unique statuses and sort alphabetically
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(ros.map((ro) => ro.currentStatus).filter(Boolean));
    return Array.from(statuses).sort();
  }, [ros]);

  // Count active advanced filters
  const advancedFilterCount = filters.excludedShops.length + filters.selectedStatuses.length;

  // Toggle shop in exclusion list
  const toggleShop = (shopName: string) => {
    const newExcluded = filters.excludedShops.includes(shopName)
      ? filters.excludedShops.filter((s) => s !== shopName)
      : [...filters.excludedShops, shopName];
    setFilter("excludedShops", newExcluded);
  };

  // Toggle status in selection list
  const toggleStatus = (status: string) => {
    const newSelected = filters.selectedStatuses.includes(status)
      ? filters.selectedStatuses.filter((s) => s !== status)
      : [...filters.selectedStatuses, status];
    setFilter("selectedStatuses", newSelected);
  };

  // Clear only advanced filters (shops and statuses)
  const clearAdvancedFilters = () => {
    setFilter("excludedShops", []);
    setFilter("selectedStatuses", []);
  };

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-dashed"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced Filters
                {advancedFilterCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 h-5 px-1.5 text-xs font-normal"
                  >
                    {advancedFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">Advanced Filters</p>
              <p className="text-xs">
                <span className="font-medium">Exclude Shops:</span> Hide selected shops from the table
              </p>
              <p className="text-xs">
                <span className="font-medium">Filter by Status:</span> Show only selected statuses (or all if none selected)
              </p>
            </div>
          </TooltipContent>
        </Tooltip>

      <DropdownMenuContent className="w-72 max-h-[500px] overflow-y-auto" align="start">
        {/* Exclude Shops Section */}
        <DropdownMenuLabel className="flex items-center justify-between">
          Exclude Shops
          {filters.excludedShops.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {filters.excludedShops.length}
            </Badge>
          )}
        </DropdownMenuLabel>
        <div className="max-h-48 overflow-y-auto">
          {uniqueShops.length > 0 ? (
            uniqueShops.map((shop) => (
              <DropdownMenuCheckboxItem
                key={shop}
                checked={filters.excludedShops.includes(shop)}
                onCheckedChange={() => toggleShop(shop)}
                onSelect={(e) => e.preventDefault()} // Prevent menu from closing
              >
                <span className="truncate">{shop}</span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No shops available
            </div>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* Filter by Status Section */}
        <DropdownMenuLabel className="flex items-center justify-between">
          Filter by Status
          {filters.selectedStatuses.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
              {filters.selectedStatuses.length}
            </Badge>
          )}
        </DropdownMenuLabel>
        <div className="max-h-48 overflow-y-auto">
          {uniqueStatuses.length > 0 ? (
            uniqueStatuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={filters.selectedStatuses.includes(status)}
                onCheckedChange={() => toggleStatus(status)}
                onSelect={(e) => e.preventDefault()} // Prevent menu from closing
              >
                <span className="truncate">{status}</span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No statuses available
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {advancedFilterCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm h-8"
                onClick={clearAdvancedFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Advanced Filters
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
});

AdvancedFiltersDropdown.displayName = "AdvancedFiltersDropdown";
