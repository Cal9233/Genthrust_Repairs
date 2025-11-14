import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddRepairOrder } from "../hooks/useROs";
import { useShops } from "../hooks/useShops";
import { ShopManagementDialog } from "./ShopManagementDialog";
import { Plus, Store, Search, AlertCircle, Package, MapPin } from "lucide-react";
import { inventoryService, type InventorySearchResult } from "../services/inventoryService";
import { toast } from "sonner";

interface CreateROFromInventoryDialogProps {
  inventoryItem: InventorySearchResult | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateROFromInventoryDialog({
  inventoryItem,
  open,
  onClose,
  onSuccess,
}: CreateROFromInventoryDialogProps) {
  const [formData, setFormData] = useState({
    roNumber: "",
    shopName: "",
    serialNumber: "",
    requiredWork: "",
    estimatedCost: "",
    terms: "",
    shopReferenceNumber: "",
  });
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [showShopDialog, setShowShopDialog] = useState(false);
  const [shopSearch, setShopSearch] = useState("");
  const [isDecrementing, setIsDecrementing] = useState(false);

  const addRO = useAddRepairOrder();
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

  // Auto-select when there's exactly one match
  useEffect(() => {
    if (shopSearch && filteredShops.length === 1 && !selectedShopId) {
      const shop = filteredShops[0];
      setSelectedShopId(shop.id);
      handleShopSelect(shop.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSearch, filteredShops.length, selectedShopId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && inventoryItem) {
      setFormData({
        roNumber: "",
        shopName: "",
        serialNumber: inventoryItem.serialNumber || "",
        requiredWork: "",
        estimatedCost: "",
        terms: "",
        shopReferenceNumber: "",
      });
      setSelectedShopId("");
      setShopSearch("");
    }
  }, [open, inventoryItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inventoryItem) {
      toast.error("No inventory item selected");
      return;
    }

    // Validate qty > 0
    if (inventoryItem.qty < 1) {
      toast.error("Cannot create RO - insufficient quantity");
      return;
    }

    const roData = {
      roNumber: formData.roNumber,
      shopName: formData.shopName,
      partNumber: inventoryItem.partNumber,
      serialNumber: formData.serialNumber,
      partDescription: inventoryItem.description,
      requiredWork: formData.requiredWork,
      estimatedCost: formData.estimatedCost
        ? parseFloat(formData.estimatedCost)
        : undefined,
      terms: formData.terms || undefined,
      shopReferenceNumber: formData.shopReferenceNumber || undefined,
    };

    // Create RO first
    addRO.mutate(roData, {
      onSuccess: async () => {
        // After RO creation, decrement inventory
        setIsDecrementing(true);

        try {
          const decrementResult = await inventoryService.decrementInventory(
            inventoryItem.indexId,
            inventoryItem.partNumber,
            inventoryItem.tableName,
            inventoryItem.rowId,
            formData.roNumber,
            `Created RO ${formData.roNumber} for ${formData.shopName}`
          );

          if (decrementResult.success) {
            // Show success with qty info
            if (decrementResult.isLowStock) {
              toast.success(
                <div className="space-y-1">
                  <div className="font-semibold">RO Created & Inventory Updated</div>
                  <div className="text-sm">
                    New quantity: <Badge variant="destructive" className="ml-1">{decrementResult.newQty}</Badge>
                  </div>
                  <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    LOW STOCK WARNING!
                  </div>
                </div>,
                { duration: 6000 }
              );
            } else {
              toast.success(
                <div className="space-y-1">
                  <div className="font-semibold">RO Created & Inventory Updated</div>
                  <div className="text-sm">New quantity: {decrementResult.newQty}</div>
                </div>,
                { duration: 4000 }
              );
            }

            // Reset form and close
            setFormData({
              roNumber: "",
              shopName: "",
              serialNumber: "",
              requiredWork: "",
              estimatedCost: "",
              terms: "",
              shopReferenceNumber: "",
            });
            setIsDecrementing(false);
            onSuccess?.();
            onClose();
          } else {
            // Decrement failed
            toast.error(
              <div className="space-y-1">
                <div className="font-semibold">RO Created but Inventory Update Failed</div>
                <div className="text-sm">{decrementResult.message}</div>
              </div>,
              { duration: 5000 }
            );
            setIsDecrementing(false);
            onClose();
          }
        } catch (error) {
          console.error("[CreateROFromInventory] Decrement error:", error);
          toast.error(
            <div className="space-y-1">
              <div className="font-semibold">RO Created but Inventory Update Failed</div>
              <div className="text-sm">
                {error instanceof Error ? error.message : "Unknown error"}
              </div>
            </div>,
            { duration: 5000 }
          );
          setIsDecrementing(false);
          onClose();
        }
      },
      onError: (error) => {
        console.error("[CreateROFromInventory] RO creation error:", error);
        toast.error("Failed to create repair order");
      },
    });
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
    setSelectedShopId(shopId);

    if (shopId) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        setFormData((prev) => ({
          ...prev,
          shopName: shop.shopName,
          terms: shop.defaultTerms,
        }));
      }
    }
  };

  if (!inventoryItem) {
    return null;
  }

  const isSubmitting = addRO.isPending || isDecrementing;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Create RO from Inventory
            </DialogTitle>
            <DialogDescription>
              Creating repair order for part from inventory (qty will be decremented)
            </DialogDescription>
          </DialogHeader>

          {/* Pre-filled Part Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Part Information (from Inventory)</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <Label className="text-xs text-blue-700">Part Number</Label>
                <div className="font-mono font-semibold text-gray-900 mt-1">
                  {inventoryItem.partNumber}
                </div>
              </div>
              <div>
                <Label className="text-xs text-blue-700">Current Quantity</Label>
                <div className="mt-1">
                  <Badge
                    variant={inventoryItem.qty < 2 ? "destructive" : "secondary"}
                    className="font-mono"
                  >
                    {inventoryItem.qty}
                  </Badge>
                  {inventoryItem.qty < 2 && (
                    <span className="text-xs text-orange-600 ml-2">Low Stock</span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-blue-700">Description</Label>
                <div className="text-gray-900 mt-1">
                  {inventoryItem.description || "-"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-blue-700 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </Label>
                <div className="text-gray-900 mt-1">
                  {inventoryItem.location || "-"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-blue-700">Condition</Label>
                <div className="text-gray-900 mt-1">
                  {inventoryItem.condition || "-"}
                </div>
              </div>
            </div>

            {inventoryItem.qty < 1 && (
              <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2 mt-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-xs text-red-800">
                  <strong>Cannot create RO:</strong> Insufficient quantity available
                </div>
              </div>
            )}
          </div>

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
              <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                  <Input
                    type="text"
                    placeholder="🔍 Type to search shops..."
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    className="bg-white border-2 border-blue-300 pl-10 focus:border-blue-500 shadow-sm"
                  />
                  {shopSearch && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {filteredShops.length} {filteredShops.length === 1 ? 'match' : 'matches'}
                    </div>
                  )}
                </div>

                {/* Dropdown Selector */}
                <div className="space-y-1">
                  <Label className="text-xs text-blue-700 font-medium">
                    {shopSearch ? 'Select from filtered results:' : 'Or browse all shops:'}
                  </Label>
                  <Select
                    value={selectedShopId}
                    onValueChange={handleShopSelect}
                    disabled={shopsLoading}
                  >
                    <SelectTrigger className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200 hover:border-blue-400 transition-colors">
                      <SelectValue placeholder="▼ Click to choose shop..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {filteredShops.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          No shops found
                        </div>
                      ) : (
                        filteredShops.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{shop.shopName}</span>
                              <span className="text-xs text-muted-foreground">
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
              </div>
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

              <div className="space-y-2">
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
                disabled={isSubmitting}
                className="border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || inventoryItem.qty < 1}
                className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
              >
                {isSubmitting
                  ? isDecrementing
                    ? "Updating Inventory..."
                    : "Creating RO..."
                  : "Create RO & Update Inventory"}
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
