import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddRepairOrder, useUpdateRepairOrder } from "../hooks/useROs";
import { useShops } from "../hooks/useShops";
import { ShopManagementDialog } from "./ShopManagementDialog";
import { Plus, Store } from "lucide-react";
import type { RepairOrder } from "../types";

interface AddRODialogProps {
  ro?: RepairOrder; // If provided, we're editing; otherwise, adding
  open: boolean;
  onClose: () => void;
}

export function AddRODialog({ ro, open, onClose }: AddRODialogProps) {
  const isEditing = !!ro;

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
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [showShopDialog, setShowShopDialog] = useState(false);
  const [shopSearch, setShopSearch] = useState("");

  const addRO = useAddRepairOrder();
  const updateRO = useUpdateRepairOrder();
  const { data: shops = [], isLoading: shopsLoading } = useShops();

  // Filter shops based on search
  const filteredShops = shops.filter((shop) => {
    if (!shopSearch) return true;
    const query = shopSearch.toLowerCase();
    return (
      shop.shopName?.toLowerCase().includes(query) ||
      shop.businessName?.toLowerCase().includes(query) ||
      shop.customerNumber?.toString().toLowerCase().includes(query) ||
      shop.city?.toLowerCase().includes(query) ||
      shop.state?.toLowerCase().includes(query)
    );
  });

  // Populate form when editing
  useEffect(() => {
    if (ro) {
      console.log("[AddRODialog] Editing RO:", ro.roNumber);
      setFormData({
        roNumber: ro.roNumber,
        shopName: ro.shopName,
        partNumber: ro.partNumber,
        serialNumber: ro.serialNumber,
        partDescription: ro.partDescription,
        requiredWork: ro.requiredWork,
        estimatedCost: ro.estimatedCost?.toString() || "",
        terms: ro.terms,
        shopReferenceNumber: ro.shopReferenceNumber,
      });
    } else {
      // Reset form for adding
      console.log("[AddRODialog] Adding new RO");
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
      setSelectedShopId("");
      setShopSearch(""); // Clear shop search when resetting
    }
  }, [ro, open]);

  // Log shops when they load
  useEffect(() => {
    console.log("[AddRODialog] Shops loaded:", shops.length, "shops");
    if (shops.length > 0) {
      console.log("[AddRODialog] Sample shop:", shops[0]);
    }
  }, [shops]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
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
    };

    if (isEditing && ro) {
      // Edit existing RO
      const rowIndex = parseInt(ro.id.replace("row-", ""));
      updateRO.mutate(
        { rowIndex, data },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      // Add new RO
      addRO.mutate(data, {
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
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleShopSelect = (shopId: string) => {
    console.log("[AddRODialog] Shop selected:", shopId);
    setSelectedShopId(shopId);

    if (shopId) {
      const shop = shops.find((s) => s.id === shopId);
      console.log("[AddRODialog] Found shop:", shop);
      if (shop) {
        console.log("[AddRODialog] Auto-filling - shopName:", shop.shopName, "terms:", shop.defaultTerms);
        setFormData((prev) => ({
          ...prev,
          shopName: shop.shopName,
          terms: shop.defaultTerms,
        }));
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {isEditing ? `Edit Repair Order - ${ro?.roNumber}` : "Create New Repair Order"}
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            {isEditing
              ? "Update the repair order details below"
              : "Fill in the details below to create a new repair order"}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Shop Selection Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-blue-600" />
                <Label className="text-sm font-semibold text-blue-900">
                  Select Shop (Auto-fill)
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowShopDialog(true)}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add New Shop
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Search shops by name, customer #, location..."
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
                className="bg-white border-blue-200"
              />
              <Select
                value={selectedShopId}
                onValueChange={handleShopSelect}
                disabled={shopsLoading}
              >
                <SelectTrigger className="bg-white border-blue-200">
                  <SelectValue placeholder="Choose a shop to auto-fill details..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {filteredShops.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      No shops found
                    </div>
                  ) : (
                    filteredShops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{shop.shopName}</span>
                          <span className="text-xs text-gray-500">
                            {shop.defaultTerms}
                            {shop.city && shop.state ? ` • ${shop.city}, ${shop.state}` : ''}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-blue-700">
              Selecting a shop will auto-fill the shop name and payment terms below
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="roNumber" className="text-sm font-semibold text-gray-700">
                RO Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="roNumber"
                name="roNumber"
                value={formData.roNumber}
                onChange={handleChange}
                required
                placeholder="e.g., RO-2024-001"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopName" className="text-sm font-semibold text-gray-700">
                Shop Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="shopName"
                name="shopName"
                value={formData.shopName}
                onChange={handleChange}
                required
                placeholder="Repair station name"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partNumber" className="text-sm font-semibold text-gray-700">
                Part Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partNumber"
                name="partNumber"
                value={formData.partNumber}
                onChange={handleChange}
                required
                placeholder="Part #"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber" className="text-sm font-semibold text-gray-700">
                Serial Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                required
                placeholder="Serial #"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partDescription" className="text-sm font-semibold text-gray-700">
                Part Description <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partDescription"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                required
                placeholder="Description of the part"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="requiredWork" className="text-sm font-semibold text-gray-700">
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
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost" className="text-sm font-semibold text-gray-700">
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
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms" className="text-sm font-semibold text-gray-700">
                Terms
              </Label>
              <Input
                id="terms"
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                placeholder="Payment terms"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor="shopReferenceNumber"
                className="text-sm font-semibold text-gray-700"
              >
                Shop Reference Number
              </Label>
              <Input
                id="shopReferenceNumber"
                name="shopReferenceNumber"
                value={formData.shopReferenceNumber}
                onChange={handleChange}
                placeholder="Shop's reference #"
                className="border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={addRO.isPending || updateRO.isPending}
              className="border-gray-300 hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={addRO.isPending || updateRO.isPending}
              className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
            >
              {addRO.isPending || updateRO.isPending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update Repair Order"
                : "Create Repair Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>

      <ShopManagementDialog
        open={showShopDialog}
        onClose={() => setShowShopDialog(false)}
      />
    </>
  );
}
