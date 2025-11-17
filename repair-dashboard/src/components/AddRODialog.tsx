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
import { Plus, Store, Search } from "lucide-react";
import type { RepairOrder } from "../types";
import { useLogger } from '@/utils/logger';

interface AddRODialogProps {
  ro?: RepairOrder; // If provided, we're editing; otherwise, adding
  open: boolean;
  onClose: () => void;
}

export function AddRODialog({ ro, open, onClose }: AddRODialogProps) {
  const isEditing = !!ro;
  const logger = useLogger('AddRODialog', { isEditing, roNumber: ro?.roNumber });

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

  // Auto-select when there's exactly one match
  useEffect(() => {
    if (shopSearch && filteredShops.length === 1 && !selectedShopId) {
      const shop = filteredShops[0];
      setSelectedShopId(shop.id);
      handleShopSelect(shop.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopSearch, filteredShops.length, selectedShopId]);

  // Populate form when editing
  useEffect(() => {
    if (ro) {
      logger.debug('Populating form for editing', { roNumber: ro.roNumber });
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
      logger.debug('Resetting form for new RO');
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
    logger.info('Shops loaded', {
      shopCount: shops.length,
      hasSampleShop: shops.length > 0
    });
  }, [shops, logger]);

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
    logger.debug('Shop selected', { shopId });
    setSelectedShopId(shopId);

    if (shopId) {
      const shop = shops.find((s) => s.id === shopId);
      if (shop) {
        logger.info('Auto-filling shop details', {
          shopName: shop.shopName,
          terms: shop.defaultTerms
        });
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
          <DialogTitle className="text-2xl font-bold text-foreground">
            {isEditing ? `Edit Repair Order - ${ro?.roNumber}` : "Create New Repair Order"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
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
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                <Input
                  type="text"
                  placeholder="🔍 Type to search shops..."
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                  className="bg-background border-2 border-input pl-10 focus:border-blue-500 shadow-sm"
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
            <p className="text-xs text-blue-700">
              💡 <strong>Tip:</strong> Start typing in the search bar to filter shops. When only one match is found, it will auto-select automatically!
            </p>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="roNumber" className="text-sm font-semibold text-foreground">
                RO Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="roNumber"
                name="roNumber"
                value={formData.roNumber}
                onChange={handleChange}
                required
                placeholder="e.g., RO-2024-001"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopName" className="text-sm font-semibold text-foreground">
                Shop Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="shopName"
                name="shopName"
                value={formData.shopName}
                onChange={handleChange}
                required
                placeholder="Repair station name"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partNumber" className="text-sm font-semibold text-foreground">
                Part Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partNumber"
                name="partNumber"
                value={formData.partNumber}
                onChange={handleChange}
                required
                placeholder="Part #"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber" className="text-sm font-semibold text-foreground">
                Serial Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                required
                placeholder="Serial #"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="partDescription" className="text-sm font-semibold text-foreground">
                Part Description <span className="text-red-600">*</span>
              </Label>
              <Input
                id="partDescription"
                name="partDescription"
                value={formData.partDescription}
                onChange={handleChange}
                required
                placeholder="Description of the part"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="requiredWork" className="text-sm font-semibold text-foreground">
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
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCost" className="text-sm font-semibold text-foreground">
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
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms" className="text-sm font-semibold text-foreground">
                Terms
              </Label>
              <Input
                id="terms"
                name="terms"
                value={formData.terms}
                onChange={handleChange}
                placeholder="Payment terms"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor="shopReferenceNumber"
                className="text-sm font-semibold text-foreground"
              >
                Shop Reference Number
              </Label>
              <Input
                id="shopReferenceNumber"
                name="shopReferenceNumber"
                value={formData.shopReferenceNumber}
                onChange={handleChange}
                placeholder="Shop's reference #"
                className="border-input bg-background focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={addRO.isPending || updateRO.isPending}
              className="border-input hover:bg-accent"
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
