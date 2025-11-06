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
import { useUpdateROStatus } from "../hooks/useROs";
import type { RepairOrder } from "../types";
import { calculateNextUpdateDate, formatDateForDisplay } from "../lib/businessRules";
import { Calendar, ArrowRight } from "lucide-react";

interface UpdateStatusDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  "TO SEND",
  "WAITING QUOTE",
  "APPROVED >>>>",
  "BEING REPAIRED",
  "SHIPPING",
  "PAID >>>>",
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
  const updateStatus = useUpdateROStatus();

  // Calculate the next update date based on selected status
  const calculatedNextUpdate = useMemo(() => {
    const nextDate = calculateNextUpdateDate(status, new Date());
    return nextDate;
  }, [status]);

  // Show cost field for quote-related statuses
  const showCostField = status.includes("APPROVED") || status.includes("QUOTE");

  // Show delivery date field for approved status
  const showDeliveryDateField = status.includes("APPROVED");

  const handleSubmit = () => {
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Status - RO #{ro.roNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status transition indicator */}
          {status !== ro.currentStatus && (
            <div className="flex items-center gap-2 text-sm bg-gray-50 p-3 rounded-lg border">
              <span className="font-medium">{ro.currentStatus}</span>
              <ArrowRight className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-blue-600">{status}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="cost">Cost (optional)</Label>
              <Input
                id="cost"
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g., 1250.00"
              />
              <p className="text-xs text-muted-foreground">
                Enter the quote or final cost for this repair
              </p>
            </div>
          )}

          {/* Conditional delivery date field */}
          {showDeliveryDateField && (
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Estimated Delivery Date (optional)</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this status change..."
              rows={3}
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? "Updating..." : "Update Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
