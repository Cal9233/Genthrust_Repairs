import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { getApprovalMessage } from "@/config/excelSheets";

interface ApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  roNumber: string;
  paymentTerms?: string;
  onConfirm: (approved: boolean) => void;
}

export function ApprovalDialog({
  isOpen,
  onClose,
  status,
  roNumber,
  paymentTerms,
  onConfirm,
}: ApprovalDialogProps) {
  const message = getApprovalMessage(status, paymentTerms);

  const handleYes = () => {
    onConfirm(true);
    onClose();
  };

  const handleNo = () => {
    onConfirm(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Confirm Status Update
          </DialogTitle>
          <DialogDescription>
            RO #{roNumber} → {status}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm font-medium">{message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Selecting "Yes" will archive this RO and remove it from the active dashboard.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleNo}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            No, Not Yet
          </Button>
          <Button
            onClick={handleYes}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            Yes, Received
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
