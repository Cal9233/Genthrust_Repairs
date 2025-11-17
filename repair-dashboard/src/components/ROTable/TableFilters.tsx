import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Plus,
  Filter,
  X,
  AlertCircle,
  Clock,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import type { ROFilters } from "./types";

/**
 * Props for ROTableFilters component
 */
interface ROTableFiltersProps {
  /** Current search query */
  search: string;
  /** Handler for search change */
  onSearchChange: (value: string) => void;
  /** Current selected view */
  selectedView: string;
  /** Handler for view change */
  onViewChange: (value: string) => void;
  /** Current filter state */
  filters: ROFilters;
  /** Handler for toggling individual filter */
  onToggleFilter: (filterKey: keyof ROFilters) => void;
  /** Handler for clearing all filters */
  onClearFilters: () => void;
  /** Number of active filters */
  activeFilterCount: number;
  /** Total number of ROs */
  totalCount: number;
  /** Number of filtered ROs */
  filteredCount: number;
  /** Whether to show the "New RO" button */
  showAddButton: boolean;
  /** Handler for clicking "New RO" */
  onClickAdd?: () => void;
}

/**
 * ROTableFilters - Renders search bar, view selector, and filter buttons
 *
 * Features:
 * - Search input with icon
 * - View selector (Active/Paid Archive/Returns/NET Archive)
 * - Smart filter buttons (Overdue, Due This Week, High Value, Waiting Quote)
 * - Clear filters button
 * - RO count display
 * - New RO button (active view only)
 * - Responsive layout
 *
 * @example
 * ```tsx
 * <ROTableFilters
 *   search={search}
 *   onSearchChange={setSearch}
 *   selectedView="active"
 *   onViewChange={handleViewChange}
 *   filters={filters}
 *   onToggleFilter={handleToggleFilter}
 *   onClearFilters={clearFilters}
 *   activeFilterCount={2}
 *   totalCount={100}
 *   filteredCount={45}
 *   showAddButton={true}
 *   onClickAdd={() => setShowAddDialog(true)}
 * />
 * ```
 */
export const ROTableFilters = memo<ROTableFiltersProps>(({
  search,
  onSearchChange,
  selectedView,
  onViewChange,
  filters,
  onToggleFilter,
  onClearFilters,
  activeFilterCount,
  totalCount,
  filteredCount,
  showAddButton,
  onClickAdd,
}) => {
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search and View Selection Row */}
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Search Bar */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ROs, shops, parts..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10 focus:bg-bg-secondary rounded-xl transition-all duration-200 w-full"
          />
        </div>

        {/* View Selector and RO Count */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Select value={selectedView} onValueChange={onViewChange}>
              <SelectTrigger className="w-[180px] border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">📋 Active ROs</SelectItem>
                <SelectItem value="Paid:Approved_Paid">💰 Paid Archive</SelectItem>
                <SelectItem value="Returns:Approved_Cancel">🔄 Returns/Cancel</SelectItem>
                <SelectItem value="NET:Approved_Net">💵 NET Archive</SelectItem>
              </SelectContent>
            </Select>

            {/* RO Count Badge */}
            <div className="text-xs sm:text-sm font-semibold text-muted-foreground bg-secondary px-3 sm:px-4 py-2 rounded-lg border border-border">
              {filteredCount} of {totalCount} ROs
            </div>
          </div>

          {/* New RO Button */}
          {showAddButton && onClickAdd && (
            <Button
              onClick={onClickAdd}
              className="bg-gradient-blue text-white font-semibold shadow-[0_4px_12px_rgba(2,132,199,0.3)] button-lift transition-all duration-200 rounded-lg px-3 sm:px-4"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">New RO</span>
            </Button>
          )}
        </div>
      </div>

      {/* Smart Filters Row */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Filters:</span>
        </div>

        {/* Overdue Filter */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleFilter("overdue")}
          className={
            filters.overdue
              ? "bg-danger text-white border-danger hover:bg-danger/90 hover:text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-danger/10 text-danger border-danger/30 hover:bg-danger/15 hover:border-danger/50 hover:text-danger transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Overdue</span>
        </Button>

        {/* Due This Week Filter */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleFilter("dueThisWeek")}
          className={
            filters.dueThisWeek
              ? "bg-warning text-white border-warning hover:bg-warning/90 hover:text-white shadow-[0_2px_8px_rgba(245,158,11,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/15 hover:border-warning/50 hover:text-warning transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Due This Week</span>
        </Button>

        {/* High Value Filter */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleFilter("highValue")}
          className={
            filters.highValue
              ? "bg-success text-white border-success hover:bg-success/90 hover:text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-success/10 text-success border-success/30 hover:bg-success/15 hover:border-success/50 hover:text-success transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">High Value ($5K+)</span>
        </Button>

        {/* Waiting Action Filter */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleFilter("waitingAction")}
          className={
            filters.waitingAction
              ? "bg-bright-blue text-white border-bright-blue hover:bg-bright-blue/90 hover:text-white shadow-[0_2px_8px_rgba(2,132,199,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-bright-blue/10 text-bright-blue border-bright-blue/30 hover:bg-bright-blue/15 hover:border-bright-blue/50 hover:text-bright-blue transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Waiting Quote</span>
        </Button>

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary text-xs sm:text-sm px-2 sm:px-3"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Clear Filters ({activeFilterCount})</span>
            <span className="sm:hidden">Clear ({activeFilterCount})</span>
          </Button>
        )}
      </div>
    </div>
  );
});

ROTableFilters.displayName = "ROTableFilters";
