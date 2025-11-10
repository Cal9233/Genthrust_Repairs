import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, ClipboardList, Bell } from "lucide-react";
import { useState } from "react";

interface ReminderTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (types: { todo: boolean; calendar: boolean }) => void;
  roNumber: string;
  dueDate: Date;
}

export function ReminderTypeDialog({
  open,
  onClose,
  onConfirm,
  roNumber,
  dueDate,
}: ReminderTypeDialogProps) {
  const [selectedTodo, setSelectedTodo] = useState(true);
  const [selectedCalendar, setSelectedCalendar] = useState(true);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const handleConfirm = () => {
    if (!selectedTodo && !selectedCalendar) {
      return; // At least one must be selected
    }
    onConfirm({ todo: selectedTodo, calendar: selectedCalendar });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Bell className="h-5 w-5 text-purple-600" />
            Set Reminder
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Choose where to create reminders for RO #{roNumber} on{" "}
            <span className="font-semibold">{formatDate(dueDate)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* To Do Option */}
          <button
            onClick={() => setSelectedTodo(!selectedTodo)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedTodo
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {selectedTodo ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                ) : (
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">
                    Microsoft To Do
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Creates a task in your To Do list with high priority and
                  reminder notification
                </p>
              </div>
            </div>
          </button>

          {/* Calendar Option */}
          <button
            onClick={() => setSelectedCalendar(!selectedCalendar)}
            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
              selectedCalendar
                ? "border-purple-500 bg-purple-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {selectedCalendar ? (
                  <CheckCircle2 className="h-5 w-5 text-purple-600" />
                ) : (
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold text-gray-900">
                    Outlook Calendar
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  Creates a 30-min event at 9 AM (marked as "Free" - won't
                  block your schedule)
                </p>
              </div>
            </div>
          </button>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-900">
              💡 <strong>Tip:</strong> Select both for maximum visibility, or
              just To Do for less calendar clutter.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTodo && !selectedCalendar}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            Create Reminder{selectedTodo && selectedCalendar ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
