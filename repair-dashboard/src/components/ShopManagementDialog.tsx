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
  "C.O.D.",
  "COD",
  "COD Secure",
  "NET 15",
  "NET 30",
  "NET 60",
  "NET 90",
  "UPON RECEIPT",
  "Wire Transfer",
  "Credit Card",
  "C.I.A.",
  "Prepaid",
];

export function ShopManagementDialog({
  shop,
  open,
  onClose,
}: ShopManagementDialogProps) {
  const isEditing = !!shop;

  // Form state
  const [customerNumber, setCustomerNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressLine3, setAddressLine3] = useState("");
  const [addressLine4, setAddressLine4] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [tollFree, setTollFree] = useState("");
  const [fax, setFax] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("NET 30");
  const [ilsCode, setIlsCode] = useState("");

  const addShop = useAddShop();
  const updateShop = useUpdateShop();

  // Populate form when editing
  useEffect(() => {
    if (shop) {
      setCustomerNumber(shop.customerNumber);
      setBusinessName(shop.businessName);
      setAddressLine1(shop.addressLine1);
      setAddressLine2(shop.addressLine2);
      setAddressLine3(shop.addressLine3);
      setAddressLine4(shop.addressLine4);
      setCity(shop.city);
      setState(shop.state);
      setZip(shop.zip);
      setCountry(shop.country);
      setPhone(shop.phone);
      setTollFree(shop.tollFree);
      setFax(shop.fax);
      setEmail(shop.email);
      setWebsite(shop.website);
      setContact(shop.contact);
      setPaymentTerms(shop.paymentTerms);
      setIlsCode(shop.ilsCode);
    } else {
      // Reset form for adding
      setCustomerNumber("");
      setBusinessName("");
      setAddressLine1("");
      setAddressLine2("");
      setAddressLine3("");
      setAddressLine4("");
      setCity("");
      setState("");
      setZip("");
      setCountry("");
      setPhone("");
      setTollFree("");
      setFax("");
      setEmail("");
      setWebsite("");
      setContact("");
      setPaymentTerms("NET 30");
      setIlsCode("");
    }
  }, [shop, open]);

  const handleSubmit = () => {
    // Basic validation
    if (!businessName.trim()) {
      return;
    }

    if (isEditing && shop) {
      // Edit existing shop
      const rowIndex = parseInt(shop.id.replace("shop-", ""));
      updateShop.mutate(
        {
          rowIndex,
          data: {
            customerNumber: customerNumber.trim(),
            businessName: businessName.trim(),
            addressLine1: addressLine1.trim(),
            addressLine2: addressLine2.trim(),
            addressLine3: addressLine3.trim(),
            addressLine4: addressLine4.trim(),
            city: city.trim(),
            state: state.trim(),
            zip: zip.trim(),
            country: country.trim(),
            phone: phone.trim(),
            tollFree: tollFree.trim(),
            fax: fax.trim(),
            email: email.trim(),
            website: website.trim(),
            contact: contact.trim(),
            paymentTerms,
            ilsCode: ilsCode.trim(),
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
          customerNumber: customerNumber.trim(),
          businessName: businessName.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          addressLine3: addressLine3.trim(),
          addressLine4: addressLine4.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          country: country.trim(),
          phone: phone.trim(),
          tollFree: tollFree.trim(),
          fax: fax.trim(),
          email: email.trim(),
          website: website.trim(),
          contact: contact.trim(),
          paymentTerms,
          ilsCode: ilsCode.trim(),
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold text-foreground">
            {isEditing ? `Edit Vendor - ${shop?.businessName}` : "Add New Vendor"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="h-6 w-1 bg-blue-600 rounded"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Basic Information
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-sm font-medium">
                Business Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="ABC Repair Shop"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerNumber" className="text-sm font-medium">
                  Customer #
                </Label>
                <Input
                  id="customerNumber"
                  value={customerNumber}
                  onChange={(e) => setCustomerNumber(e.target.value)}
                  placeholder="AUTO-123"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ilsCode" className="text-sm font-medium">
                  ILS Code
                </Label>
                <Input
                  id="ilsCode"
                  value={ilsCode}
                  onChange={(e) => setIlsCode(e.target.value)}
                  placeholder="ILS-123"
                  className="h-10"
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="h-6 w-1 bg-green-600 rounded"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Address
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressLine1" className="text-sm font-medium">
                Street Address
              </Label>
              <Input
                id="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 Main Street"
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine2" className="text-sm font-medium text-muted-foreground">
                  Address Line 2
                </Label>
                <Input
                  id="addressLine2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Suite 100"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine3" className="text-sm font-medium text-muted-foreground">
                  Address Line 3
                </Label>
                <Input
                  id="addressLine3"
                  value={addressLine3}
                  onChange={(e) => setAddressLine3(e.target.value)}
                  placeholder="Optional"
                  className="h-10"
                />
              </div>
            </div>

            {addressLine3 && (
              <div className="space-y-2">
                <Label htmlFor="addressLine4" className="text-sm font-medium text-muted-foreground">
                  Address Line 4
                </Label>
                <Input
                  id="addressLine4"
                  value={addressLine4}
                  onChange={(e) => setAddressLine4(e.target.value)}
                  placeholder="Optional"
                  className="h-10"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">
                  City
                </Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="New York"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state" className="text-sm font-medium">
                  State
                </Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NY"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip" className="text-sm font-medium">
                  ZIP
                </Label>
                <Input
                  id="zip"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="10001"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country" className="text-sm font-medium">
                Country
              </Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="USA"
                className="h-10"
              />
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="h-6 w-1 bg-purple-600 rounded"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Contact Information
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact" className="text-sm font-medium">
                  Contact Person
                </Label>
                <Input
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="John Smith"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@shop.com"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tollFree" className="text-sm font-medium text-muted-foreground">
                  Toll Free
                </Label>
                <Input
                  id="tollFree"
                  type="tel"
                  value={tollFree}
                  onChange={(e) => setTollFree(e.target.value)}
                  placeholder="(800) 123-4567"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fax" className="text-sm font-medium text-muted-foreground">
                  Fax
                </Label>
                <Input
                  id="fax"
                  type="tel"
                  value={fax}
                  onChange={(e) => setFax(e.target.value)}
                  placeholder="(555) 123-4568"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm font-medium">
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.example.com"
                className="h-10"
              />
            </div>
          </div>

          {/* Payment Terms Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <div className="h-6 w-1 bg-orange-600 rounded"></div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Payment Terms
              </h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTerms" className="text-sm font-medium">
                Default Payment Terms
              </Label>
              <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                <SelectTrigger className="h-10">
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
          </div>
        </div>

        <DialogFooter className="border-t pt-4 gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="min-w-[100px] border-input hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !businessName.trim()}
            className="min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
          >
            {isPending
              ? isEditing
                ? "Updating..."
                : "Adding..."
              : isEditing
              ? "Update Vendor"
              : "Add Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
