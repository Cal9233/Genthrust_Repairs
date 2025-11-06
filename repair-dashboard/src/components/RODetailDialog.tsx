import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { UpdateStatusDialog } from "./UpdateStatusDialog";
import type { RepairOrder } from "../types";

interface RODetailDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

export function RODetailDialog({ ro, open, onClose }: RODetailDialogProps) {
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>RO #{ro.roNumber}</span>
              <StatusBadge status={ro.currentStatus} isOverdue={ro.isOverdue} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={() => setShowUpdateStatus(true)}>
                Update Status
              </Button>
              <Button variant="outline">Email Shop</Button>
            </div>

            {/* Shop Info */}
            <div>
              <h3 className="font-semibold mb-2">Shop Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Shop:</span>{" "}
                  <span className="font-medium">{ro.shopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shop Ref:</span>{" "}
                  {ro.shopReferenceNumber || "N/A"}
                </div>
                <div>
                  <span className="text-muted-foreground">Terms:</span>{" "}
                  {ro.terms || "N/A"}
                </div>
              </div>
            </div>

            {/* Part Info */}
            <div>
              <h3 className="font-semibold mb-2">Part Information</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Description:</span>{" "}
                  <span className="font-medium">{ro.partDescription}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Part #:</span>{" "}
                    {ro.partNumber || "N/A"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serial #:</span>{" "}
                    {ro.serialNumber || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Required Work:</span>{" "}
                  {ro.requiredWork || "N/A"}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div>
              <h3 className="font-semibold mb-2">Timeline</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Date Made:</span>{" "}
                  {formatDate(ro.dateMade)}
                </div>
                <div>
                  <span className="text-muted-foreground">Dropped Off:</span>{" "}
                  {formatDate(ro.dateDroppedOff)}
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Delivery:</span>{" "}
                  {formatDate(ro.estimatedDeliveryDate)}
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>{" "}
                  {formatDate(ro.lastDateUpdated)}
                </div>
                <div
                  className={ro.isOverdue ? "text-red-600 font-semibold" : ""}
                >
                  <span className="text-muted-foreground">Next Update:</span>{" "}
                  {formatDate(ro.nextDateToUpdate)}
                  {ro.isOverdue && ` (${ro.daysOverdue} days overdue)`}
                </div>
              </div>
            </div>

            {/* Costs */}
            <div>
              <h3 className="font-semibold mb-2">Costs</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Estimated:</span>{" "}
                  {formatCurrency(ro.estimatedCost)}
                </div>
                <div>
                  <span className="text-muted-foreground">Final:</span>{" "}
                  <span className="font-medium">
                    {formatCurrency(ro.finalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tracking */}
            {ro.trackingNumber && (
              <div>
                <h3 className="font-semibold mb-2">Shipping</h3>
                <div className="text-sm">
                  <span className="text-muted-foreground">Tracking:</span>{" "}
                  <a
                    href={`https://www.ups.com/track?tracknum=${ro.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {ro.trackingNumber}
                  </a>
                </div>
              </div>
            )}

            {/* Notes */}
            {ro.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <div className="text-sm bg-muted p-3 rounded-md whitespace-pre-wrap">
                  {ro.notes}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showUpdateStatus && (
        <UpdateStatusDialog
          ro={ro}
          open={showUpdateStatus}
          onClose={() => setShowUpdateStatus(false)}
        />
      )}
    </>
  );
}
