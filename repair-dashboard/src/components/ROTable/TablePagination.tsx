import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Props for ROTablePagination component
 */
interface ROTablePaginationProps {
  /** Current page number (0-indexed) */
  currentPage: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Handler for page change */
  onPageChange: (page: number) => void;
  /** Handler for page size change */
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * ROTablePagination - Renders pagination controls for the table
 *
 * Features:
 * - Page size selector (25, 50, 100, All)
 * - Previous/Next page buttons
 * - Current page and total pages display
 * - Item range display (e.g., "1-25 of 100")
 * - Disabled state for buttons when at first/last page
 * - Responsive layout
 *
 * @example
 * ```tsx
 * <ROTablePagination
 *   currentPage={0}
 *   pageSize={25}
 *   totalItems={100}
 *   onPageChange={setCurrentPage}
 *   onPageSizeChange={setPageSize}
 * />
 * ```
 */
export const ROTablePagination = memo<ROTablePaginationProps>(({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}) => {
  // Calculate pagination values
  const { totalPages, startItem, endItem, hasPrevPage, hasNextPage } = useMemo(() => {
    const total = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);
    const start = pageSize === -1 ? 1 : currentPage * pageSize + 1;
    const end = pageSize === -1 ? totalItems : Math.min((currentPage + 1) * pageSize, totalItems);
    const hasPrev = currentPage > 0;
    const hasNext = currentPage < total - 1;

    return {
      totalPages: total,
      startItem: start,
      endItem: end,
      hasPrevPage: hasPrev,
      hasNextPage: hasNext,
    };
  }, [currentPage, pageSize, totalItems]);

  // Don't show pagination if there are no items
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-2 py-3 border-t border-border bg-background">
      {/* Items per page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          Rows per page:
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            const newPageSize = value === "-1" ? -1 : parseInt(value);
            onPageSizeChange(newPageSize);
            onPageChange(0); // Reset to first page when changing page size
          }}
        >
          <SelectTrigger className="w-[80px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="-1">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Item range display */}
      <div className="text-sm text-muted-foreground">
        {startItem}-{endItem} of {totalItems}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        {/* Page info */}
        {pageSize !== -1 && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Page {currentPage + 1} of {totalPages}
          </span>
        )}

        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrevPage}
          className="h-8 w-8 p-0"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="h-8 w-8 p-0"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

ROTablePagination.displayName = "ROTablePagination";
