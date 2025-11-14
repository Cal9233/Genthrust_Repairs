import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateROStatus, useArchiveRO } from "../hooks/useROs";
import type { RepairOrder } from "../types";
import { calculateNextUpdateDate, formatDateForDisplay } from "../lib/businessRules";
import { Calendar, ArrowRight } from "lucide-react";
import { ApprovalDialog } from "./ApprovalDialog";
import { ArchiveDestinationDialog } from "./ArchiveDestinationDialog";
import { statusRequiresApproval, getFinalSheetForStatus, extractNetDays, EXCEL_SHEETS, type SheetConfig } from "@/config/excelSheets";
import { reminderService } from "../lib/reminderService";
import { toast } from "sonner";

interface UpdateStatusDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  "TO SEND",
  "WAITING QUOTE",
  "APPROVED",
  "BEING REPAIRED",
  "CURRENTLY BEING SHIPPED",
  "RECEIVED",
  "SHIPPING",
  "PAID",
  "PAYMENT SENT",
  "RAI",
  "BER",
];

export function UpdateStatusDialog({
  ro,
  open,
  onClose,
}: UpdateStatusDialogProps) {
  const [status, setStatus] = useState(ro.currentStatus);
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showArchiveDestinationDialog, setShowArchiveDestinationDialog] = useState(false);
  const [pendingArchiveDestination, setPendingArchiveDestination] = useState<'PAID' | 'NET' | null>(null);
  const updateStatus = useUpdateROStatus();
  const archiveRO = useArchiveRO();

  // Calculate the next update date based on selected status and payment terms
  const calculatedNextUpdate = useMemo(() => {
    const nextDate = calculateNextUpdateDate(status, new Date(), ro.terms);
    return nextDate;
  }, [status, ro.terms]);

  // Show cost field for quote-related statuses
  const showCostField = status.includes("APPROVED") || status.includes("QUOTE");

  // Show delivery date field for approved status
  const showDeliveryDateField = status.includes("APPROVED");

  const handleSubmit = () => {
    // Check if this status requires approval/archiving
    if (statusRequiresApproval(status)) {
      const destination = getFinalSheetForStatus(status, ro.terms);

      // If destination is 'prompt', show archive destination dialog
      if (destination === 'prompt') {
        setShowArchiveDestinationDialog(true);
      } else {
        // Otherwise, show approval dialog
        setShowApprovalDialog(true);
      }
    } else {
      // No approval needed, update directly
      performStatusUpdate();
    }
  };

  const performStatusUpdate = () => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));

    const costValue = cost ? parseFloat(cost.replace(/[^0-9.]/g, "")) : undefined;
    const deliveryDateValue = deliveryDate ? new Date(deliveryDate) : undefined;

    updateStatus.mutate(
      {
        rowIndex,
        status,
        notes,
        cost: costValue,
        deliveryDate: deliveryDateValue,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleArchiveDestinationChoice = (destination: 'PAID' | 'NET') => {
    setPendingArchiveDestination(destination);
    setShowApprovalDialog(true);
  };

  const handleApprovalResponse = async (approved: boolean) => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));
    const costValue = cost ? parseFloat(cost.replace(/[^0-9.]/g, "")) : undefined;
    const deliveryDateValue = deliveryDate ? new Date(deliveryDate) : undefined;

    if (approved) {
      // User confirmed they received the part - determine destination
      let targetSheet: SheetConfig | null = null;

      // If user manually chose destination, use that
      if (pendingArchiveDestination) {
        targetSheet = pendingArchiveDestination === 'NET' ? EXCEL_SHEETS.NET : EXCEL_SHEETS.PAID;
      } else {
        // Otherwise, use automatic determination
        const destination = getFinalSheetForStatus(status, ro.terms);
        if (destination !== 'prompt' && destination !== null) {
          targetSheet = destination;
        }
      }

      if (targetSheet) {
        // For NET payments, create a payment reminder
        const isNetArchive = targetSheet.sheetName === 'NET';
        let netDays: number | null = null;

        if (isNetArchive) {
          // Try to extract NET days from payment terms
          netDays = extractNetDays(ro.terms || '');

          // If no NET days found in terms but archiving to NET, default to NET30
          if (!netDays) {
            netDays = 30;
            toast.info('No NET days specified, defaulting to NET30');
          }
        }

        updateStatus.mutate(
          {
            rowIndex,
            status,
            notes,
            cost: costValue,
            deliveryDate: deliveryDateValue,
          },
          {
            onSuccess: async () => {
              // Create NET payment reminder before archiving
              if (isNetArchive && netDays && costValue) {
                try {
                  await reminderService.createPaymentDueCalendarEvent({
                    roNumber: ro.roNumber,
                    shopName: ro.shopName,
                    invoiceDate: new Date(),
                    amount: costValue,
                    netDays: netDays
                  });
                  toast.success(`Created payment reminder for NET${netDays} (${netDays} days from today)`);
                } catch (error) {
                  console.error('[UpdateStatusDialog] Failed to create NET payment reminder:', error);
                  toast.error('Failed to create payment reminder, but RO will still be archived');
                }
              }

              // After updating status (and creating reminder if needed), archive the RO
              archiveRO.mutate(
                {
                  rowIndex,
                  targetSheetName: targetSheet!.sheetName,
                  targetTableName: targetSheet!.tableName,
                },
                {
                  onSuccess: () => {
                    onClose();
                  },
                }
              );
            },
          }
        );
      }
    } else {
      // User hasn't received it yet - just update status, keep in active sheet
      performStatusUpdate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Update Status - RO #{ro.roNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Status transition indicator */}
          {status !== ro.currentStatus && (
            <div className="flex items-center gap-3 text-sm bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <span className="font-semibold text-foreground px-3 py-1 bg-background rounded-md border border-border">
                {ro.currentStatus}
              </span>
              <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-700 dark:text-blue-300 px-3 py-1 bg-blue-100 dark:bg-blue-950/50 rounded-md border border-blue-300 dark:border-blue-700">
                {status}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold text-foreground">
              New Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional cost field */}
          {showCostField && (
            <div className="space-y-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <Label htmlFor="cost" className="text-sm font-semibold text-orange-900 dark:text-orange-300">
                Cost (optional)
              </Label>
              <Input
                id="cost"
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g., 1250.00"
                className="h-11 border-orange-300 dark:border-orange-700 bg-background"
              />
              <p className="text-xs text-orange-700 dark:text-orange-400">
                Enter the quote or final cost for this repair
              </p>
            </div>
          )}

          {/* Conditional delivery date field */}
          {showDeliveryDateField && (
            <div className="space-y-2 bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <Label htmlFor="deliveryDate" className="text-sm font-semibold text-green-900 dark:text-green-300">
                Estimated Delivery Date (optional)
              </Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-11 border-green-300 dark:border-green-700 bg-background"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold text-foreground">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this status change..."
              rows={3}
              className="border-border"
            />
          </div>

          {/* Auto-calculated next update date info */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                  Auto-calculated Next Update
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  {calculatedNextUpdate ? (
                    <>
                      Next follow-up will be automatically set to{" "}
                      <span className="font-semibold">
                        {formatDateForDisplay(calculatedNextUpdate)}
                      </span>
                    </>
                  ) : (
                    "No follow-up needed - order complete"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border pt-4 gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateStatus.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm px-6"
          >
            {updateStatus.isPending ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        status={status}
        roNumber={ro.roNumber}
        paymentTerms={ro.terms}
        onConfirm={handleApprovalResponse}
      />

      <ArchiveDestinationDialog
        isOpen={showArchiveDestinationDialog}
        onClose={() => setShowArchiveDestinationDialog(false)}
        roNumber={ro.roNumber}
        onConfirm={handleArchiveDestinationChoice}
      />
    </Dialog>
  );
}
