import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { useUpdateROStatus } from "../hooks/useROs";
import type { RepairOrder } from "../types";

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
  const updateStatus = useUpdateROStatus();

  const handleSubmit = () => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));

    updateStatus.mutate(
      { rowIndex, status, notes },
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
