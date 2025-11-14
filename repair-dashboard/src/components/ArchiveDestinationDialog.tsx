import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Calendar } from "lucide-react";

interface ArchiveDestinationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roNumber: string;
  onConfirm: (destination: 'PAID' | 'NET') => void;
}

export function ArchiveDestinationDialog({
  isOpen,
  onClose,
  roNumber,
  onConfirm,
}: ArchiveDestinationDialogProps) {
  const handleChoice = (destination: 'PAID' | 'NET') => {
    onConfirm(destination);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="h-5 w-5 text-warning" />
            Payment Terms Not Clear
          </DialogTitle>
          <DialogDescription className="pt-2">
            RO #{roNumber} does not have clear payment terms specified. Please select where to archive this received part:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <button
            onClick={() => handleChoice('PAID')}
            className="w-full p-4 rounded-lg border-2 border-border hover:border-success hover:bg-success/5 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="bg-success/10 p-2 rounded-lg group-hover:bg-success/20 transition-colors">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  Paid Archive
                </h3>
                <p className="text-sm text-muted-foreground">
                  Part has been received and payment has been made or will be made immediately
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleChoice('NET')}
            className="w-full p-4 rounded-lg border-2 border-border hover:border-warning hover:bg-warning/5 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="bg-warning/10 p-2 rounded-lg group-hover:bg-warning/20 transition-colors">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">
                  NET Payment Archive
                </h3>
                <p className="text-sm text-muted-foreground">
                  Part has been received but payment is due in 30/60/90 days (NET terms)
                </p>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
