import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAddRepairOrder } from "../hooks/useROs";

interface AddRODialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddRODialog({ open, onClose }: AddRODialogProps) {
  const [formData, setFormData] = useState({
    roNumber: "",
    shopName: "",
    partNumber: "",
    serialNumber: "",
    partDescription: "",
    requiredWork: "",
    estimatedCost: "",
    terms: "",
    shopReferenceNumber: "",
  });

  const addRO = useAddRepairOrder();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addRO.mutate(
      {
        roNumber: formData.roNumber,
        shopName: formData.shopName,
        partNumber: formData.partNumber,
        serialNumber: formData.serialNumber,
        partDescription: formData.partDescription,
        requiredWork: formData.requiredWork,
        estimatedCost: formData.estimatedCost
          ? parseFloat(formData.estimatedCost)
          : undefined,
        terms: formData.terms || undefined,
        shopReferenceNumber: formData.shopReferenceNumber || undefined,
      },
      {
        onSuccess: () => {
          setFormData({
            roNumber: "",
            shopName: "",
            partNumber: "",
            serialNumber: "",
            partDescription: "",
            requiredWork: "",
            estimatedCost: "",
            terms: "",
            shopReferenceNumber: "",
          });
          onClose();
        },
      }
    );
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Repair Order</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="roNumber" className="text-sm font-semibold">
                RO Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="roNumber"
                name="roNumber"
                value={formData.roNumber}
                onChange={handleChange}
                required
                placeholder="e.g., RO-2024-001"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopName" className="text-sm font-semibold">
                Shop Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="shopName"
                name="shopName"
                value={formData.shopName}
                onChange={handleChange}
                required
                placeholder="Repair station name"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partNumber" className="text-sm font-semibold">
                Part Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partNumber"
                name="partNumber"
                value={formData.partNumber}
                onChange={handleChange}
                required
                placeholder="Part #"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber" className="text-sm font-semibold">
                Serial Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                required
                placeholder="Serial #"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partDescription" className="text-sm font-semibold">
                Part Description <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partDescription"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                required
                placeholder="Description of the part"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="requiredWork" className="text-sm font-semibold">
                Required Work <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="requiredWork"
                name="requiredWork"
                value={formData.requiredWork}
                onChange={handleChange}
                required
                placeholder="Describe the work needed..."
                rows={3}
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost" className="text-sm font-semibold">
                Estimated Cost
              </Label>
              <Input
                id="estimatedCost"
                name="estimatedCost"
                type="number"
                step="0.01"
                value={formData.estimatedCost}
                onChange={handleChange}
                placeholder="0.00"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms" className="text-sm font-semibold">
                Terms
              </Label>
              <Input
                id="terms"
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                placeholder="Payment terms"
                className="border-gray-300"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor="shopReferenceNumber"
                className="text-sm font-semibold"
              >
                Shop Reference Number
              </Label>
              <Input
                id="shopReferenceNumber"
                name="shopReferenceNumber"
                value={formData.shopReferenceNumber}
                onChange={handleChange}
                placeholder="Shop's reference #"
                className="border-gray-300"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={addRO.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addRO.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {addRO.isPending ? "Creating..." : "Create Repair Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
