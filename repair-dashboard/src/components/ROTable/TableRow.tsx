import { memo } from "react";
import { TableCell, TableRow as UITableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "../StatusBadge";
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Mail,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { RepairOrder } from "../../types";
import type { ShopAnalyticsProfile } from "../../services/analyticsEngine";

/**
 * Props for ROTableRow component
 */
interface ROTableRowProps {
  /** The repair order data */
  ro: RepairOrder;
  /** Whether this row is selected */
  isSelected: boolean;
  /** Whether this row is expanded */
  isExpanded: boolean;
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
 * Format date for display
 */
const formatDate = (date: Date | null): string => {
  if (!date) return "N/A";
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  } catch {
    return "N/A";
  }
};

/**
 * Format currency for display
 */
const formatCurrency = (amount: number | null): string => {
  if (!amount) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

/**
 * ROTableRow - Renders a single RO row with expandable details
 *
 * Features:
 * - Checkbox for selection
 * - Expand/collapse button
 * - All RO data columns
 * - Completion prediction with confidence interval
 * - Overdue status indication
 * - Actions dropdown menu (View, Edit, Email, Delete)
 * - Expandable row with detailed information in 6 sections:
 *   1. Part Information
 *   2. Shop & Logistics
 *   3. Timeline
 *   4. Financials
 *   5. Status Tracking
 *   6. Additional (Notes, Required Work)
 * - Responsive styling
 * - Sticky actions column
 *
 * @example
 * ```tsx
 * <ROTableRow
 *   ro={repairOrder}
 *   isSelected={selectedRONumbers.includes(repairOrder.roNumber)}
 *   isExpanded={expandedRows.has(repairOrder.id)}
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
export const ROTableRow = memo<ROTableRowProps>(({
  ro,
  isSelected,
  isExpanded,
  shopProfiles,
  onToggleSelect,
  onToggleExpand,
  onViewDetails,
  onEdit,
  onSendEmail,
  onDelete,
  predictCompletion,
}) => {
  const prediction = predictCompletion(ro, shopProfiles);

  return (
    <>
      {/* Main Row */}
      <UITableRow
        className={`hover:bg-bg-hover transition-smooth border-b border-border group ${
          ro.isOverdue ? "bg-danger/5 hover:bg-danger/10" : ""
        } ${isSelected ? "bg-bright-blue/5" : ""}`}
      >
        {/* Selection Checkbox */}
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(ro.roNumber)}
            aria-label={`Select RO ${ro.roNumber}`}
          />
        </TableCell>

        {/* Expand/Collapse Button */}
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleExpand(ro.id)}
            className="p-0 h-auto hover:bg-transparent"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </TableCell>

        {/* RO Number */}
        <TableCell className="font-semibold text-foreground">
          {ro.roNumber}
        </TableCell>

        {/* Part Number */}
        <TableCell className="text-muted-foreground font-medium">
          {ro.partNumber}
        </TableCell>

        {/* Serial Number */}
        <TableCell className="text-muted-foreground">
          {ro.serialNumber || "N/A"}
        </TableCell>

        {/* Status */}
        <TableCell>
          <StatusBadge status={ro.currentStatus} isOverdue={ro.isOverdue} />
        </TableCell>

        {/* Estimated Completion */}
        <TableCell>
          {prediction ? (
            <div>
              <div
                className={`font-semibold ${
                  prediction.status === "on-track"
                    ? "text-green-600"
                    : prediction.status === "at-risk"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {prediction.estimatedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                ±{prediction.confidenceDays}d
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">N/A</span>
          )}
        </TableCell>

        {/* Next Update Date */}
        <TableCell>
          <div className="text-foreground">{formatDate(ro.nextDateToUpdate)}</div>
          {ro.isOverdue && (
            <div className="text-xs font-semibold text-danger flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" />
              {ro.daysOverdue} days overdue
            </div>
          )}
        </TableCell>

        {/* Cost */}
        <TableCell className="text-right font-semibold text-foreground">
          {formatCurrency(ro.finalCost || ro.estimatedCost)}
        </TableCell>

        {/* Actions Dropdown */}
        <TableCell
          className={`sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] ${
            ro.isOverdue
              ? "bg-danger/5 hover:bg-danger/10"
              : isSelected
              ? "bg-bright-blue/5"
              : "bg-background"
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onViewDetails(ro)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(ro)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendEmail(ro)}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(ro)}
                  className="text-danger focus:text-danger"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </UITableRow>

      {/* Expanded Details Row */}
      {isExpanded && (
        <UITableRow className="bg-secondary/30 hover:bg-secondary/30">
          <TableCell colSpan={10} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Part Information */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                  Part Information
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Part #:</span>
                    <span className="font-medium text-foreground">
                      {ro.partNumber}
                    </span>
                  </div>
                  {ro.serialNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Serial #:</span>
                      <span className="font-medium text-foreground">
                        {ro.serialNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="font-medium text-foreground text-right max-w-[200px]">
                      {ro.partDescription}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shop & Logistics */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                  Shop & Logistics
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shop:</span>
                    <span className="font-medium text-foreground">
                      {ro.shopName}
                    </span>
                  </div>
                  {ro.shopReferenceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shop Ref #:</span>
                      <span className="font-medium text-foreground">
                        {ro.shopReferenceNumber}
                      </span>
                    </div>
                  )}
                  {ro.terms && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Terms:</span>
                      <span className="font-medium text-foreground">
                        {ro.terms}
                      </span>
                    </div>
                  )}
                  {ro.trackingNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracking #:</span>
                      <span className="font-medium text-foreground">
                        {ro.trackingNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                  Timeline
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="font-medium text-foreground">
                      {formatDate(ro.dateMade)}
                    </span>
                  </div>
                  {ro.dateDroppedOff && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dropped Off:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(ro.dateDroppedOff)}
                      </span>
                    </div>
                  )}
                  {ro.estimatedDeliveryDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Delivery:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(ro.estimatedDeliveryDate)}
                      </span>
                    </div>
                  )}
                  {ro.lastDateUpdated && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Updated:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(ro.lastDateUpdated)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financials */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                  Financials
                </h4>
                <div className="space-y-1 text-sm">
                  {ro.estimatedCost && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Estimated Cost:
                      </span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(ro.estimatedCost)}
                      </span>
                    </div>
                  )}
                  {ro.finalCost && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Final Cost:</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(ro.finalCost)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Tracking */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                  Status Tracking
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Status:</span>
                    <StatusBadge
                      status={ro.currentStatus}
                      isOverdue={ro.isOverdue}
                    />
                  </div>
                  {ro.currentStatusDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status Date:</span>
                      <span className="font-medium text-foreground">
                        {formatDate(ro.currentStatusDate)}
                      </span>
                    </div>
                  )}
                  {ro.genThrustStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Genthrust Status:
                      </span>
                      <span className="font-medium text-foreground">
                        {ro.genThrustStatus}
                      </span>
                    </div>
                  )}
                  {ro.shopStatus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shop Status:</span>
                      <span className="font-medium text-foreground">
                        {ro.shopStatus}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Information */}
              {(ro.requiredWork || ro.notes) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                    Additional
                  </h4>
                  <div className="space-y-1 text-sm">
                    {ro.requiredWork && (
                      <div>
                        <span className="text-muted-foreground">
                          Required Work:
                        </span>
                        <p className="font-medium text-foreground mt-1">
                          {ro.requiredWork}
                        </p>
                      </div>
                    )}
                    {ro.notes && (
                      <div>
                        <span className="text-muted-foreground">Notes:</span>
                        <p className="font-medium text-foreground mt-1">
                          {ro.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </UITableRow>
      )}
    </>
  );
});

ROTableRow.displayName = "ROTableRow";
