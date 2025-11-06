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
import { useAddShop, useUpdateShop } from "../hooks/useShops";
import type { Shop } from "../types";

interface ShopManagementDialogProps {
  shop?: Shop; // If provided, we're editing; otherwise, we're adding
  open: boolean;
  onClose: () => void;
}

const TERMS_OPTIONS = [
  "COD",
  "NET 30",
  "NET 60",
  "NET 90",
  "Prepaid",
  "Credit Card",
];

export function ShopManagementDialog({
  shop,
  open,
  onClose,
}: ShopManagementDialogProps) {
  const isEditing = !!shop;

  // Form state
  const [shopName, setShopName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("NET 30");
  const [typicalTAT, setTypicalTAT] = useState<string>("14");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  const addShop = useAddShop();
  const updateShop = useUpdateShop();

  // Populate form when editing
  useEffect(() => {
    if (shop) {
      setShopName(shop.shopName);
      setContactName(shop.contactName);
      setEmail(shop.email);
      setPhone(shop.phone);
      setDefaultTerms(shop.defaultTerms);
      setTypicalTAT(shop.typicalTAT.toString());
      setNotes(shop.notes);
      setActive(shop.active);
    } else {
      // Reset form for adding
      setShopName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setDefaultTerms("NET 30");
      setTypicalTAT("14");
      setNotes("");
      setActive(true);
    }
  }, [shop, open]);

  const handleSubmit = () => {
    // Basic validation
    if (!shopName.trim()) {
      return;
    }

    const tatNumber = parseInt(typicalTAT);
    if (isNaN(tatNumber) || tatNumber < 0) {
      return;
    }

    if (isEditing && shop) {
      // Edit existing shop
      const rowIndex = parseInt(shop.id.replace("shop-", ""));
      updateShop.mutate(
        {
          rowIndex,
          data: {
            shopName: shopName.trim(),
            contactName: contactName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            defaultTerms,
            typicalTAT: tatNumber,
            notes: notes.trim(),
            active,
          },
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    } else {
      // Add new shop
      addShop.mutate(
        {
          shopName: shopName.trim(),
          contactName: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          defaultTerms,
          typicalTAT: tatNumber,
          notes: notes.trim(),
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
    }
  };

  const isPending = addShop.isPending || updateShop.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Shop - ${shop?.shopName}` : "Add New Shop"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">
                Shop Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="ABC Repair Shop"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@shop.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultTerms">Default Payment Terms</Label>
              <Select value={defaultTerms} onValueChange={setDefaultTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS_OPTIONS.map((term) => (
                    <SelectItem key={term} value={term}>
                      {term}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="typicalTAT">Typical Turnaround Time (days)</Label>
              <Input
                id="typicalTAT"
                type="number"
                min="0"
                value={typicalTAT}
                onChange={(e) => setTypicalTAT(e.target.value)}
                placeholder="14"
              />
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <Select
                value={active ? "active" : "inactive"}
                onValueChange={(value) => setActive(value === "active")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information about this shop..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !shopName.trim()}>
            {isPending
              ? isEditing
                ? "Updating..."
                : "Adding..."
              : isEditing
              ? "Update Shop"
              : "Add Shop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
