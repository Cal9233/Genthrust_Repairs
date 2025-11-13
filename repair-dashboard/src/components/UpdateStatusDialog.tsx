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
import { statusRequiresApproval, getFinalSheetForStatus } from "@/config/excelSheets";

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
    // Check if this status requires approval (PAID, NET, BER/RAI/Cancel)
    if (statusRequiresApproval(status)) {
      setShowApprovalDialog(true);
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

  const handleApprovalResponse = (approved: boolean) => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));
    const costValue = cost ? parseFloat(cost.replace(/[^0-9.]/g, "")) : undefined;
    const deliveryDateValue = deliveryDate ? new Date(deliveryDate) : undefined;

    if (approved) {
      // User confirmed they received the part - update status then archive
      const targetSheet = getFinalSheetForStatus(status);

      if (targetSheet) {
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
              // After updating status, archive the RO
              archiveRO.mutate(
                {
                  rowIndex,
                  targetSheetName: targetSheet.sheetName,
                  targetTableName: targetSheet.tableName,
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
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Update Status - RO #{ro.roNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Status transition indicator */}
          {status !== ro.currentStatus && (
            <div className="flex items-center gap-3 text-sm bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <span className="font-semibold text-gray-700 px-3 py-1 bg-white rounded-md border border-gray-300">
                {ro.currentStatus}
              </span>
              <ArrowRight className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-700 px-3 py-1 bg-blue-100 rounded-md border border-blue-300">
                {status}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-semibold text-gray-700">
              New Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11 border-gray-300">
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
            <div className="space-y-2 bg-orange-50 rounded-lg p-4 border border-orange-200">
              <Label htmlFor="cost" className="text-sm font-semibold text-orange-900">
                Cost (optional)
              </Label>
              <Input
                id="cost"
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g., 1250.00"
                className="h-11 border-orange-300 bg-white"
              />
              <p className="text-xs text-orange-700">
                Enter the quote or final cost for this repair
              </p>
            </div>
          )}

          {/* Conditional delivery date field */}
          {showDeliveryDateField && (
            <div className="space-y-2 bg-green-50 rounded-lg p-4 border border-green-200">
              <Label htmlFor="deliveryDate" className="text-sm font-semibold text-green-900">
                Estimated Delivery Date (optional)
              </Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-11 border-green-300 bg-white"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold text-gray-700">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this status change..."
              rows={3}
              className="border-gray-300"
            />
          </div>

          {/* Auto-calculated next update date info */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">
                  Auto-calculated Next Update
                </p>
                <p className="text-sm text-blue-700 mt-1">
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

        <DialogFooter className="border-t pt-4 gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 hover:bg-gray-50"
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
        onConfirm={handleApprovalResponse}
      />
    </Dialog>
  );
}
