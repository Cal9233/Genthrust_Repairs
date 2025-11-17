import { memo } from "react";
import { TableHead, TableHeader as UITableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown } from "lucide-react";
import type { RepairOrder } from "../../types";
import type { SortColumn, SortDirection } from "./types";

/**
 * Props for ROTableHeader component
 */
interface ROTableHeaderProps {
  /** Current sort column */
  sortColumn: SortColumn;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Handler for column sort */
  onSort: (column: keyof RepairOrder) => void;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some (but not all) items are selected */
  isSomeSelected: boolean;
  /** Handler for select all toggle */
  onToggleSelectAll: () => void;
}

/**
 * ROTableHeader - Renders sortable table header with column controls
 *
 * Features:
 * - Sortable columns (RO #, Next Update, Cost)
 * - Select all checkbox
 * - Responsive text sizing
 * - Consistent Tailwind styling
 *
 * @example
 * ```tsx
 * <ROTableHeader
 *   sortColumn="roNumber"
 *   sortDirection="asc"
 *   onSort={handleSort}
 *   isAllSelected={false}
 *   isSomeSelected={true}
 *   onToggleSelectAll={handleToggleSelectAll}
 * />
 * ```
 */
export const ROTableHeader = memo<ROTableHeaderProps>(({
  sortColumn,
  sortDirection,
  onSort,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
}) => {
  return (
    <UITableHeader>
      <TableRow className="bg-secondary hover:bg-secondary border-b border-border">
        {/* Select All Checkbox */}
        <TableHead className="w-[40px] sm:w-[50px]">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all"
            className={isSomeSelected ? "data-[state=checked]:bg-bright-blue" : ""}
          />
        </TableHead>

        {/* Expand/Collapse Column */}
        <TableHead className="w-[40px] sm:w-[50px]"></TableHead>

        {/* RO # - Sortable */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          <Button
            variant="ghost"
            onClick={() => onSort("roNumber")}
            className="hover:bg-bg-hover hover:text-foreground font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] px-2 sm:px-3"
          >
            RO #
            <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </TableHead>

        {/* Part # */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          Part #
        </TableHead>

        {/* Serial # */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          Serial #
        </TableHead>

        {/* Status */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          Status
        </TableHead>

        {/* Est. Completion */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          Est. Completion
        </TableHead>

        {/* Next Update - Sortable */}
        <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          <Button
            variant="ghost"
            onClick={() => onSort("nextDateToUpdate")}
            className="hover:bg-bg-hover hover:text-foreground font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] px-2 sm:px-3"
          >
            Next Update
            <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </TableHead>

        {/* Cost - Sortable */}
        <TableHead className="text-right font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
          <Button
            variant="ghost"
            onClick={() => onSort("finalCost")}
            className="hover:bg-bg-hover hover:text-foreground font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] px-2 sm:px-3 ml-auto"
          >
            Cost
            <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </TableHead>

        {/* Actions */}
        <TableHead className="sticky right-0 bg-secondary hover:bg-secondary shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase text-center">
          Actions
        </TableHead>
      </TableRow>
    </UITableHeader>
  );
});

ROTableHeader.displayName = "ROTableHeader";
