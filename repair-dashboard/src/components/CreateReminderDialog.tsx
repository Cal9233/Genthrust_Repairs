import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, ClipboardList, Bell, RefreshCw, AlertCircle } from "lucide-react";
import { reminderService } from "@/lib/reminderService";
import { toast } from "sonner";
import { useLogger } from "@/utils/logger";

interface CreateReminderDialogProps {
  open: boolean;
  onClose: () => void;
  roNumber: string;
  shopName: string;
  status: string;
  nextDateToUpdate: Date;
  partDescription: string;
}

interface ReminderError {
  type: "todo" | "calendar" | "both";
  message: string;
  canRetry: boolean;
}

export function CreateReminderDialog({
  open,
  onClose,
  roNumber,
  shopName,
  status,
  nextDateToUpdate,
  partDescription,
}: CreateReminderDialogProps) {
  const logger = useLogger("CreateReminderDialog", { roNumber });

  const [selectedTodo, setSelectedTodo] = useState(true);
  const [selectedCalendar, setSelectedCalendar] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<ReminderError | null>(null);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleCreate = async () => {
    if (!selectedTodo && !selectedCalendar) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      logger.info("Creating reminders", {
        todo: selectedTodo,
        calendar: selectedCalendar,
        dueDate: nextDateToUpdate.toISOString(),
      });

      const results = await reminderService.createReminders(
        {
          roNumber,
          shopName,
          title: `Follow up - ${status}`,
          dueDate: nextDateToUpdate,
          notes: `Follow up on repair order ${roNumber} for ${partDescription}. Current status: ${status}`,
        },
        { todo: selectedTodo, calendar: selectedCalendar }
      );

      // Check results and show appropriate feedback
      const todoSuccess = !selectedTodo || results.todo;
      const calendarSuccess = !selectedCalendar || results.calendar;

      if (todoSuccess && calendarSuccess) {
        // All requested reminders created successfully
        if (selectedTodo && selectedCalendar) {
          toast.success("Reminders created in To Do and Calendar!");
        } else if (selectedTodo) {
          toast.success("To Do task created!");
        } else {
          toast.success("Calendar event created!");
        }
        onClose();
      } else {
        // Some reminders failed
        const failedTypes: string[] = [];
        if (selectedTodo && !results.todo) failedTypes.push("To Do");
        if (selectedCalendar && !results.calendar) failedTypes.push("Calendar");

        const errorMessage = `Failed to create ${failedTypes.join(" and ")} reminder${failedTypes.length > 1 ? "s" : ""}`;

        logger.warn("Partial reminder creation failure", {
          todoRequested: selectedTodo,
          todoSuccess: results.todo,
          calendarRequested: selectedCalendar,
          calendarSuccess: results.calendar,
        });

        setError({
          type: failedTypes.length === 2 ? "both" : (failedTypes[0].toLowerCase() as "todo" | "calendar"),
          message: errorMessage,
          canRetry: true,
        });

        // Show partial success if any succeeded
        if (selectedTodo && results.todo && !results.calendar) {
          toast.success("To Do task created (Calendar failed)");
        } else if (selectedCalendar && results.calendar && !results.todo) {
          toast.success("Calendar event created (To Do failed)");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";

      logger.error("Failed to create reminders", err as Error, {
        todo: selectedTodo,
        calendar: selectedCalendar,
      });

      // Classify error for retry guidance
      const canRetry = !errorMessage.includes("401") && !errorMessage.includes("403");

      setError({
        type: "both",
        message: errorMessage,
        canRetry,
      });

      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        toast.error("Authentication error. Please sign out and sign back in.");
      } else {
        toast.error("Failed to create reminders. You can retry or skip.");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleCreate();
  };

  const handleSkip = () => {
    logger.info("User skipped reminder creation");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleSkip()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-5 w-5 text-purple-600" />
            Create Follow-up Reminder?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Status updated to <span className="font-semibold text-foreground">{status}</span>.
            Next follow-up scheduled for:
          </DialogDescription>
        </DialogHeader>

        {/* Next Update Date Highlight */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="text-lg font-semibold text-foreground">
                {formatDate(nextDateToUpdate)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 py-2">
          {/* To Do Option */}
          <button
            onClick={() => setSelectedTodo(!selectedTodo)}
            disabled={isCreating}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 ${
              selectedTodo
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-border bg-card hover:border-accent"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {selectedTodo ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                ) : (
                  <div className="h-5 w-5 border-2 border-border rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-foreground">
                    Microsoft To Do
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  High priority task with reminder notification
                </p>
              </div>
            </div>
          </button>

          {/* Calendar Option */}
          <button
            onClick={() => setSelectedCalendar(!selectedCalendar)}
            disabled={isCreating}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left disabled:opacity-50 ${
              selectedCalendar
                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                : "border-border bg-card hover:border-accent"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {selectedCalendar ? (
                  <CheckCircle2 className="h-5 w-5 text-purple-600" />
                ) : (
                  <div className="h-5 w-5 border-2 border-border rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold text-foreground">
                    Outlook Calendar
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  30-min event at 9 AM (marked "Free")
                </p>
              </div>
            </div>
          </button>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">
                    {error.message}
                  </p>
                  {error.canRetry && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleRetry}
                      className="text-red-600 hover:text-red-700 p-0 h-auto mt-1"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  {!error.canRetry && (
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      Please sign out and sign back in to refresh your authentication.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isCreating}
            className="flex-1 border-input"
          >
            Skip
          </Button>
          <Button
            onClick={handleCreate}
            disabled={(!selectedTodo && !selectedCalendar) || isCreating}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            {isCreating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>Create Reminder{selectedTodo && selectedCalendar ? "s" : ""}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
