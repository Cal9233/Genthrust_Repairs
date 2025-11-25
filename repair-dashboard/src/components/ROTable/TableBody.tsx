import { memo } from "react";
import { Search } from "lucide-react";
import { TableBody as UITableBody } from "@/components/ui/table";
import { ROTableRow } from "./TableRow";
import type { RepairOrder } from "../../types";
import type { ShopAnalyticsProfile } from "../../services/analyticsEngine";

/**
 * Props for ROTableBody component
 */
interface ROTableBodyProps {
  /** Array of repair orders to display */
  repairOrders: RepairOrder[];
  /** Set of selected RO numbers */
  selectedRONumbers: string[];
  /** Set of expanded row IDs */
  expandedRows: Set<string>;
  /** Shop analytics profiles for completion prediction */
  shopProfiles: Map<string, ShopAnalyticsProfile>;
  /** Handler for selection toggle */
  onToggleSelect: (roNumber: string) => void;
  /** Handler for row expansion toggle */
  onToggleExpand: (roId: string) => void;
  /** Handler for view details action */
  onViewDetails: (ro: RepairOrder) => void;
  /** Handler for edit action */
  onEdit: (ro: RepairOrder) => void;
  /** Handler for send email action */
  onSendEmail: (ro: RepairOrder) => void;
  /** Handler for delete action */
  onDelete: (ro: RepairOrder) => void;
  /** Function to predict completion date */
  predictCompletion: (
    ro: RepairOrder,
    profiles: Map<string, ShopAnalyticsProfile>
  ) => { estimatedDate: Date; confidenceDays: number; status: string } | null;
}

/**
 * ROTableBody - Renders the table body with all RO rows
 *
 * Features:
 * - Maps over repair orders to render ROTableRow components
 * - Memoized for performance optimization
 * - Passes through all required handlers and state
 *
 * @example
 * ```tsx
 * <ROTableBody
 *   repairOrders={filteredAndSorted}
 *   selectedRONumbers={selectedRONumbers}
 *   expandedRows={expandedRows}
 *   shopProfiles={shopProfiles}
 *   onToggleSelect={handleToggleSelect}
 *   onToggleExpand={toggleRowExpansion}
 *   onViewDetails={setSelectedRO}
 *   onEdit={setEditingRO}
 *   onSendEmail={setEmailRO}
 *   onDelete={setDeletingRO}
 *   predictCompletion={predictCompletion}
 * />
 * ```
 */
export const ROTableBody = memo<ROTableBodyProps>(({
  repairOrders,
  selectedRONumbers,
  expandedRows,
  shopProfiles,
  onToggleSelect,
  onToggleExpand,
  onViewDetails,
  onEdit,
  onSendEmail,
  onDelete,
  predictCompletion,
}) => {
  return (
    <UITableBody>
      {repairOrders.length === 0 ? (
        <tr>
          <td colSpan={8} className="text-center py-12">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Search className="h-12 w-12 opacity-40" />
              <div>
                <p className="text-lg font-semibold">No repair orders found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </div>
          </td>
        </tr>
      ) : (
        repairOrders.map((ro) => (
          <ROTableRow
            key={ro.id}
            ro={ro}
            isSelected={selectedRONumbers.includes(ro.roNumber)}
            isExpanded={expandedRows.has(ro.id)}
            shopProfiles={shopProfiles}
            onToggleSelect={onToggleSelect}
            onToggleExpand={onToggleExpand}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onSendEmail={onSendEmail}
            onDelete={onDelete}
            predictCompletion={predictCompletion}
          />
        ))
      )}
    </UITableBody>
  );
});

ROTableBody.displayName = "ROTableBody";
