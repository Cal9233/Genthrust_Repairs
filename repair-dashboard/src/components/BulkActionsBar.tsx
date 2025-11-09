import { Button } from "@/components/ui/button";
import { X, Send, Mail, Download } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMarkAsSent: () => void;
  onRequestUpdates: () => void;
  onExportSelected: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMarkAsSent,
  onRequestUpdates,
  onExportSelected,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-blue-500 shadow-2xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection count */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-900 font-semibold px-4 py-2 rounded-lg">
              {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Selection
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAsSent}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Mark as Sent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestUpdates}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              Request Updates
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onExportSelected}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
