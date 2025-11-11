import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { UpdateStatusDialog } from "./UpdateStatusDialog";
import { StatusTimeline } from "./StatusTimeline";
import { EmailComposerDialog } from "./EmailComposerDialog";
import { ReminderTypeDialog } from "./ReminderTypeDialog";
import { AttachmentManager } from "./AttachmentManager";
import { useShops } from "../hooks/useShops";
import { useUpdateROStatus } from "../hooks/useROs";
import type { RepairOrder } from "../types";
import { Mail, Bell, Calendar as CalendarIcon, Info } from "lucide-react";
import { reminderService } from "../lib/reminderService";
import { toast } from "sonner";

interface RODetailDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

export function RODetailDialog({ ro, open, onClose }: RODetailDialogProps) {
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showReminderTypeDialog, setShowReminderTypeDialog] = useState(false);
  const [isCreatingReminder, setIsCreatingReminder] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(() => {
    // Check if user has created a reminder before
    return !localStorage.getItem("hasCreatedReminder");
  });

  // Fetch shops to get shop details
  const { data: shops } = useShops();
  const updateStatus = useUpdateROStatus();

  // Find the shop for this RO
  const currentShop = useMemo(() => {
    if (!shops) return null;
    return shops.find((shop) => shop.shopName === ro.shopName) || null;
  }, [shops, ro.shopName]);

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "N/A";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(dateObj);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Handler to log email in status history
  const handleLogEmail = (subject: string, templateName: string) => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));
    const emailNote = `Email sent: ${subject} (Template: ${templateName})`;

    // Update the RO to log the email in status history
    updateStatus.mutate({
      rowIndex,
      status: ro.currentStatus, // Keep same status
      notes: emailNote,
    });
  };

  // Handler to create reminders with selected types
  const handleCreateReminders = async (types: { todo: boolean; calendar: boolean }) => {
    if (!ro.nextDateToUpdate) {
      toast.error("No follow-up date set for this RO");
      return;
    }

    setIsCreatingReminder(true);

    try {
      const results = await reminderService.createReminders(
        {
          roNumber: ro.roNumber,
          shopName: ro.shopName,
          title: `Follow up - ${ro.currentStatus}`,
          dueDate: new Date(ro.nextDateToUpdate),
          notes: `Follow up on repair order for ${ro.partDescription}. Current status: ${ro.currentStatus}`,
        },
        types
      );

      // Mark that user has created a reminder
      localStorage.setItem("hasCreatedReminder", "true");
      setIsFirstTimeUser(false);

      // Show appropriate success message
      if (types.todo && types.calendar) {
        if (results.todo && results.calendar) {
          toast.success("Created reminders in To Do and Calendar!");
        } else if (results.todo) {
          toast.success("Created reminder in To Do (Calendar failed)");
        } else if (results.calendar) {
          toast.success("Created reminder in Calendar (To Do failed)");
        } else {
          toast.error("Failed to create reminders");
        }
      } else if (types.todo) {
        if (results.todo) {
          toast.success("Created reminder in To Do!");
        } else {
          toast.error("Failed to create To Do reminder");
        }
      } else if (types.calendar) {
        if (results.calendar) {
          toast.success("Created reminder in Calendar!");
        } else {
          toast.error("Failed to create Calendar reminder");
        }
      }
    } catch (error) {
      console.error("[RODetailDialog] Error creating reminders:", error);
      toast.error("Failed to create reminders");
    } finally {
      setIsCreatingReminder(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center justify-between text-2xl">
              <span className="font-bold text-gray-900">RO #{ro.roNumber}</span>
              <StatusBadge status={ro.currentStatus} isOverdue={ro.isOverdue} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First-time user help text */}
            {isFirstTimeUser && ro.nextDateToUpdate && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-purple-900">
                      First time using reminders?
                    </p>
                    <p className="text-xs text-purple-800">
                      Clicking "Set Reminder" will ask for permission to access your Microsoft To Do and Calendar.
                      This is secure and only happens once. You can choose to create reminders in one or both apps.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowUpdateStatus(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
              >
                Update Status
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEmailComposer(true)}
                className="gap-2 border-gray-300 hover:bg-gray-50"
              >
                <Mail className="h-4 w-4" />
                Email Shop
              </Button>
              {ro.nextDateToUpdate && (
                <Button
                  variant="outline"
                  onClick={() => setShowReminderTypeDialog(true)}
                  disabled={isCreatingReminder}
                  className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Bell className="h-4 w-4" />
                  <CalendarIcon className="h-4 w-4" />
                  {isCreatingReminder ? "Creating..." : "Set Reminder"}
                </Button>
              )}
            </div>

            {/* Shop Info */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <div className="h-1 w-8 bg-blue-600 rounded"></div>
                Shop Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Shop:</span>{" "}
                  <span className="font-semibold text-gray-900">{ro.shopName}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Shop Ref:</span>{" "}
                  <span className="text-gray-900">{ro.shopReferenceNumber || "N/A"}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Terms:</span>{" "}
                  <span className="text-gray-900">{ro.terms || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Part Info */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <div className="h-1 w-8 bg-purple-600 rounded"></div>
                Part Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-purple-700 font-medium">Description:</span>{" "}
                  <span className="font-semibold text-gray-900">{ro.partDescription}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-purple-700 font-medium">Part #:</span>{" "}
                    <span className="text-gray-900">{ro.partNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-purple-700 font-medium">Serial #:</span>{" "}
                    <span className="text-gray-900">{ro.serialNumber || "N/A"}</span>
                  </div>
                </div>
                <div>
                  <span className="text-purple-700 font-medium">Required Work:</span>{" "}
                  <span className="text-gray-900">{ro.requiredWork || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                <div className="h-1 w-8 bg-green-600 rounded"></div>
                Timeline
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-green-700 font-medium">Date Made:</span>{" "}
                  <span className="text-gray-900">{formatDate(ro.dateMade)}</span>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Dropped Off:</span>{" "}
                  <span className="text-gray-900">{formatDate(ro.dateDroppedOff)}</span>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Est. Delivery:</span>{" "}
                  <span className="text-gray-900">{formatDate(ro.estimatedDeliveryDate)}</span>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Last Updated:</span>{" "}
                  <span className="text-gray-900">{formatDate(ro.lastDateUpdated)}</span>
                </div>
                <div
                  className={ro.isOverdue ? "text-red-600 font-semibold" : ""}
                >
                  <span className="text-green-700 font-medium">Next Update:</span>{" "}
                  <span className={ro.isOverdue ? "text-red-600" : "text-gray-900"}>
                    {formatDate(ro.nextDateToUpdate)}
                    {ro.isOverdue && ` (${ro.daysOverdue} days overdue)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Costs */}
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                <div className="h-1 w-8 bg-orange-600 rounded"></div>
                Costs
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-orange-700 font-medium">Estimated:</span>{" "}
                  <span className="text-gray-900 font-semibold">{formatCurrency(ro.estimatedCost)}</span>
                </div>
                <div>
                  <span className="text-orange-700 font-medium">Final:</span>{" "}
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(ro.finalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tracking */}
            {ro.trackingNumber && (
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                  <div className="h-1 w-8 bg-indigo-600 rounded"></div>
                  Shipping
                </h3>
                <div className="text-sm">
                  <span className="text-indigo-700 font-medium">Tracking:</span>{" "}
                  <a
                    href={`https://www.ups.com/track?tracknum=${ro.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {ro.trackingNumber}
                  </a>
                </div>
              </div>
            )}

            {/* Notes */}
            {ro.notes && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <div className="h-1 w-8 bg-gray-600 rounded"></div>
                  Notes
                </h3>
                <div className="text-sm bg-white p-3 rounded-md whitespace-pre-wrap border border-gray-200 text-gray-700">
                  {ro.notes}
                </div>
              </div>
            )}

            {/* Attachments */}
            <AttachmentManager roNumber={ro.roNumber} />

            {/* Status History */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="h-1 w-8 bg-slate-600 rounded"></div>
                Status History
              </h3>
              <StatusTimeline history={ro.statusHistory} />
            </div>
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

      {showEmailComposer && (
        <EmailComposerDialog
          ro={ro}
          shop={currentShop}
          open={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
          onLogEmail={handleLogEmail}
        />
      )}

      {showReminderTypeDialog && ro.nextDateToUpdate && (
        <ReminderTypeDialog
          open={showReminderTypeDialog}
          onClose={() => setShowReminderTypeDialog(false)}
          onConfirm={handleCreateReminders}
          roNumber={ro.roNumber}
          dueDate={new Date(ro.nextDateToUpdate)}
        />
      )}
    </>
  );
}
