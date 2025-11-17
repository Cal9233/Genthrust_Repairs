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
import { useROs, useUpdateROStatus } from "../hooks/useROs";
import type { RepairOrder } from "../types";
import { Mail, Bell, Calendar as CalendarIcon, Info } from "lucide-react";
import { reminderService } from "../lib/reminderService";
import { getTrackingInfo } from "../lib/trackingUtils";
import { toast } from "sonner";
import { useLogger } from '@/utils/logger';

interface RODetailDialogProps {
  ro: RepairOrder;
  open: boolean;
  onClose: () => void;
}

export function RODetailDialog({ ro, open, onClose }: RODetailDialogProps) {
  const logger = useLogger('RODetailDialog', {
    roNumber: ro.roNumber,
    open
  });

  // Fetch the latest RO data to ensure updates are reflected
  const { data: allROs } = useROs();

  // Find the current RO from the latest data, fall back to prop if not found yet
  const currentRO = useMemo(() => {
    if (!allROs) return ro;
    const latestRO = allROs.find(r => r.roNumber === ro.roNumber);
    return latestRO || ro;
  }, [allROs, ro]);
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
    return shops.find((shop) => shop.shopName === currentRO.shopName) || null;
  }, [shops, currentRO.shopName]);

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
    const rowIndex = parseInt(currentRO.id.replace("row-", ""));
    const emailNote = `Email sent: ${subject} (Template: ${templateName})`;

    // Update the RO to log the email in status history
    updateStatus.mutate({
      rowIndex,
      status: currentRO.currentStatus, // Keep same status
      notes: emailNote,
    });
  };

  // Handler to create reminders with selected types
  const handleCreateReminders = async (types: { todo: boolean; calendar: boolean }) => {
    if (!currentRO.nextDateToUpdate) {
      toast.error("No follow-up date set for this RO");
      return;
    }

    setIsCreatingReminder(true);

    try {
      const results = await reminderService.createReminders(
        {
          roNumber: currentRO.roNumber,
          shopName: currentRO.shopName,
          title: `Follow up - ${currentRO.currentStatus}`,
          dueDate: new Date(currentRO.nextDateToUpdate),
          notes: `Follow up on repair order for ${currentRO.partDescription}. Current status: ${currentRO.currentStatus}`,
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
      logger.error('Failed to create reminders', error as Error, {
        roNumber: currentRO.roNumber,
        todoSelected: types.todo,
        calendarSelected: types.calendar
      });
      toast.error("Failed to create reminders");
    } finally {
      setIsCreatingReminder(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50">
          <DialogHeader className="bg-card -mx-6 -mt-6 px-6 pt-6 pb-4 mb-4 rounded-t-[20px] border-b border-border">
            <DialogTitle className="flex items-center justify-between">
              <span className="font-bold text-foreground text-[28px]">RO #{currentRO.roNumber}</span>
              <StatusBadge status={currentRO.currentStatus} isOverdue={currentRO.isOverdue} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* First-time user help text */}
            {isFirstTimeUser && currentRO.nextDateToUpdate && (
              <div className="bg-card rounded-lg p-4 border-2 border-accent/30">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-accent">
                      First time using reminders?
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                className="bg-gradient-blue text-white font-semibold shadow-[0_4px_12px_rgba(2,132,199,0.3)] hover:shadow-[0_6px_20px_rgba(2,132,199,0.4)] button-lift transition-all duration-200"
              >
                Update Status
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowEmailComposer(true)}
                className="gap-2 bg-card border-2 border-border text-foreground hover:bg-accent hover:text-accent-foreground transition-all"
              >
                <Mail className="h-4 w-4" />
                Email Shop
              </Button>
              {currentRO.nextDateToUpdate && (
                <Button
                  variant="outline"
                  onClick={() => setShowReminderTypeDialog(true)}
                  disabled={isCreatingReminder}
                  className="gap-2 bg-card border-2 border-accent text-accent hover:bg-accent/10 hover:text-accent transition-all disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" />
                  <CalendarIcon className="h-4 w-4" />
                  {isCreatingReminder ? "Creating..." : "Set Reminder"}
                </Button>
              )}
            </div>

            {/* Shop Info */}
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                <div className="h-1.5 w-10 bg-cyan-600 rounded"></div>
                Shop Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-semibold">Shop:</span>{" "}
                  <span className="font-normal text-foreground">{currentRO.shopName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Shop Ref:</span>{" "}
                  <span className="text-foreground">{currentRO.shopReferenceNumber || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Terms:</span>{" "}
                  <span className="text-foreground">{currentRO.terms || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Part Info */}
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                <div className="h-1.5 w-10 bg-accent rounded"></div>
                Part Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-semibold">Description:</span>{" "}
                  <span className="font-normal text-foreground">{currentRO.partDescription}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground font-semibold">Part #:</span>{" "}
                    <span className="text-foreground">{currentRO.partNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Serial #:</span>{" "}
                    <span className="text-foreground">{currentRO.serialNumber || "N/A"}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Required Work:</span>{" "}
                  <span className="text-foreground">{currentRO.requiredWork || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                <div className="h-1.5 w-10 bg-green-600 rounded"></div>
                Timeline
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-semibold">Date Made:</span>{" "}
                  <span className="text-foreground">{formatDate(currentRO.dateMade)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Dropped Off:</span>{" "}
                  <span className="text-foreground">{formatDate(currentRO.dateDroppedOff)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Est. Delivery:</span>{" "}
                  <span className="text-foreground">{formatDate(currentRO.estimatedDeliveryDate)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Last Updated:</span>{" "}
                  <span className="text-foreground">{formatDate(currentRO.lastDateUpdated)}</span>
                </div>
                <div
                  className={currentRO.isOverdue ? "font-semibold" : ""}
                >
                  <span className="text-muted-foreground font-semibold">Next Update:</span>{" "}
                  <span className={currentRO.isOverdue ? "text-red-400" : "text-foreground"}>
                    {formatDate(currentRO.nextDateToUpdate)}
                    {currentRO.isOverdue && ` (${currentRO.daysOverdue} days overdue)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Costs */}
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                <div className="h-1.5 w-10 bg-orange-600 rounded"></div>
                Costs
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground font-semibold">Estimated:</span>{" "}
                  <span className="text-foreground font-normal">{formatCurrency(currentRO.estimatedCost)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold">Final:</span>{" "}
                  <span className="font-normal text-foreground">
                    {formatCurrency(currentRO.finalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tracking */}
            {currentRO.trackingNumber && (
              <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-10 bg-indigo-600 rounded"></div>
                  Shipping
                </h3>
                <div className="text-sm">
                  <span className="text-muted-foreground font-semibold">Tracking:</span>{" "}
                  <a
                    href={getTrackingInfo(currentRO.trackingNumber).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 hover:underline font-normal"
                  >
                    {currentRO.trackingNumber}
                  </a>
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({getTrackingInfo(currentRO.trackingNumber).carrier})
                  </span>
                </div>
              </div>
            )}

            {/* Notes */}
            {currentRO.notes && (
              <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <h3 className="font-semibold text-foreground text-lg mb-3 flex items-center gap-2">
                  <div className="h-1.5 w-10 bg-accent rounded"></div>
                  Notes
                </h3>
                <div className="text-sm bg-card p-3 rounded-md whitespace-pre-wrap border border-border text-foreground">
                  {currentRO.notes}
                </div>
              </div>
            )}

            {/* Attachments */}
            <AttachmentManager roNumber={currentRO.roNumber} />

            {/* Status History */}
            <div className="bg-card rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <h3 className="font-semibold text-foreground text-lg mb-4 flex items-center gap-2">
                <div className="h-1.5 w-10 bg-accent rounded"></div>
                Status History
              </h3>
              <StatusTimeline history={currentRO.statusHistory} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showUpdateStatus && (
        <UpdateStatusDialog
          ro={currentRO}
          open={showUpdateStatus}
          onClose={() => setShowUpdateStatus(false)}
        />
      )}

      {showEmailComposer && (
        <EmailComposerDialog
          ro={currentRO}
          shop={currentShop}
          open={showEmailComposer}
          onClose={() => setShowEmailComposer(false)}
          onLogEmail={handleLogEmail}
        />
      )}

      {showReminderTypeDialog && currentRO.nextDateToUpdate && (
        <ReminderTypeDialog
          open={showReminderTypeDialog}
          onClose={() => setShowReminderTypeDialog(false)}
          onConfirm={handleCreateReminders}
          roNumber={currentRO.roNumber}
          dueDate={new Date(currentRO.nextDateToUpdate)}
        />
      )}
    </>
  );
}
