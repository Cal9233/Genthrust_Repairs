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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 border-bright-blue shadow-2xl">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection count */}
          <div className="flex items-center gap-3">
            <div className="bg-bright-blue/10 text-bright-blue font-semibold px-4 py-2 rounded-lg border border-bright-blue/30">
              {selectedCount} {selectedCount === 1 ? "item" : "items"} selected
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary"
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
              className="gap-2 border-border hover:bg-secondary"
            >
              <Send className="h-4 w-4" />
              Mark as Sent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestUpdates}
              className="gap-2 border-border hover:bg-secondary"
            >
              <Mail className="h-4 w-4" />
              Request Updates
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onExportSelected}
              className="gap-2 bg-gradient-blue text-white shadow-md hover:shadow-lg transition-all duration-200"
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
