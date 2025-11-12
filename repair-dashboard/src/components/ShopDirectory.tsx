import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShops, useDeleteShop } from "../hooks/useShops";
import { ShopManagementDialog } from "./ShopManagementDialog";
import type { Shop } from "../types";
import { Store, Plus, Search, Edit, Mail, Phone, Trash2 } from "lucide-react";

export function ShopDirectory() {
  const { data: shops = [], isLoading, isError, error } = useShops();
  const deleteShop = useDeleteShop();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | undefined>(undefined);
  const [deletingShop, setDeletingShop] = useState<Shop | undefined>(undefined);

  // Filter shops based on search query
  const filteredShops = shops.filter((shop) => {
    const query = searchQuery.toLowerCase();
    return (
      shop.businessName?.toLowerCase().includes(query) ||
      shop.contact?.toLowerCase().includes(query) ||
      shop.email?.toLowerCase().includes(query) ||
      shop.customerNumber?.toString().toLowerCase().includes(query) ||
      shop.city?.toLowerCase().includes(query) ||
      shop.state?.toLowerCase().includes(query)
    );
  });

  const handleEdit = (shop: Shop) => {
    setEditingShop(shop);
  };

  const handleDelete = (shop: Shop) => {
    setDeletingShop(shop);
  };

  const confirmDelete = () => {
    if (deletingShop) {
      const rowIndex = parseInt(deletingShop.id.replace("shop-", ""));
      deleteShop.mutate(rowIndex, {
        onSuccess: () => {
          setDeletingShop(undefined);
          setSearchQuery(""); // Clear search after delete
        },
      });
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingShop(undefined);
    setSearchQuery(""); // Clear search after add/update
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shops...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900 flex items-center gap-2">
              <Store className="h-6 w-6" />
              Vendor Directory Not Set Up
            </CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-800">
            <p className="mb-4">
              The Shop Directory table hasn't been created yet. Please follow these steps in your existing Book.xlsx file:
            </p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>Open <strong>Book.xlsx</strong> in SharePoint</li>
              <li>Add a new sheet (worksheet) and name it: <strong>Shops</strong></li>
              <li>Add these column headers in row 1:</li>
            </ol>
            <div className="bg-yellow-100 p-2 rounded text-xs mb-4 overflow-x-auto">
              <code>Customer # | Business Name | Address Line 1 | Address Line 2 | Address Line 3 | Address Line 4 | City | State | ZIP | Country | Phone | Toll Free | Fax | Email | Website | Contact | Payment Terms | ILS Code | Last Sale Date | YTD Sales</code>
            </div>
            <ol className="list-decimal list-inside space-y-2 mb-4" start={4}>
              <li>Select the header row and your data range, then convert to table (Ctrl+T)</li>
              <li>Name the table: <strong>Table3</strong> (in Table Design tab, or keep the auto-generated name and update VITE_SHOP_TABLE_NAME in .env.local)</li>
              <li>Save and refresh this page</li>
            </ol>
            <p className="text-sm italic">
              Error details: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-h1 text-foreground mb-1 sm:mb-2">
              Vendor Directory
            </h1>
            <p className="text-sm sm:text-[15px] text-muted-foreground font-normal">
              Manage repair vendors and their information
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-blue text-white font-semibold shadow-[0_4px_12px_rgba(2,132,199,0.3)] button-lift transition-all duration-200 rounded-lg px-4 sm:px-5 py-2.5 sm:py-3 w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add New Vendor</span>
            <span className="sm:hidden ml-2">Add Vendor</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sm:pl-11 h-12 sm:h-14 border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10 focus:bg-bg-secondary rounded-xl transition-all duration-200 text-sm"
          />
        </div>

        {/* Shop Stats */}
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-3">
          <Card className="bg-card-blue border-l-[4px] sm:border-l-[5px] border-l-bright-blue border-t border-r border-b border-border shadow-[0_4px_12px_rgba(2,132,199,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                TOTAL VENDORS
              </CardTitle>
              <div className="bg-bright-blue/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <Store className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-bright-blue" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {shops.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card-green border-l-[4px] sm:border-l-[5px] border-l-success border-t border-r border-b border-border shadow-[0_4px_12px_rgba(16,185,129,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                WITH EMAIL
              </CardTitle>
              <div className="bg-success/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <Mail className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-success" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {shops.filter((s) => s.email).length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card-purple border-l-[4px] sm:border-l-[5px] border-l-[#8b5cf6] border-t border-r border-b border-border shadow-[0_4px_12px_rgba(139,92,246,0.08)] lift-on-hover rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-3">
              <CardTitle className="text-[11px] sm:text-[12px] md:text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                WITH WEBSITE
              </CardTitle>
              <div className="bg-[#8b5cf6]/15 p-2 sm:p-2.5 md:p-3 rounded-full">
                <Phone className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-[#8b5cf6]" strokeWidth={2.5} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-[32px] sm:text-[36px] md:text-[40px] font-bold text-foreground leading-none">
                {shops.filter((s) => s.website).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shop Table */}
        <Card className="shadow-vibrant-lg border-border rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border bg-secondary py-3 sm:py-4">
            <CardTitle className="text-lg sm:text-xl md:text-h3 text-foreground">
              All Vendors ({filteredShops.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary hover:bg-secondary border-b border-border">
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Customer #</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Business Name</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Contact</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Location</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Email</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Phone</TableHead>
                    <TableHead className="font-semibold text-muted-foreground text-[13px] uppercase">Payment Terms</TableHead>
                    <TableHead className="sticky right-0 bg-secondary shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] font-semibold text-muted-foreground text-[13px] uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-bright-blue/10 flex items-center justify-center">
                            <Store className="h-8 w-8 text-bright-blue" />
                          </div>
                          <p className="font-semibold text-foreground text-lg">No vendors found</p>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            {searchQuery
                              ? "Try adjusting your search to find vendors"
                              : "Get started by adding your first vendor to the directory"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredShops.map((shop) => {
                      const location = [shop.city, shop.state]
                        .filter(Boolean)
                        .join(", ");

                      return (
                        <TableRow key={shop.id} className="hover:bg-bg-hover transition-smooth border-b border-border group">
                          <TableCell className="font-mono text-[13px] text-muted-foreground font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-bright-blue/30 group-hover:bg-bright-blue transition-colors"></div>
                              {shop.customerNumber}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-sm text-foreground">
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-bright-blue opacity-0 group-hover:opacity-100 transition-opacity" />
                              {shop.businessName}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shop.contact || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {location || "—"}
                          </TableCell>
                          <TableCell>
                            {shop.email ? (
                              <a
                                href={`mailto:${shop.email}`}
                                className="text-bright-blue hover:opacity-80 hover:underline flex items-center gap-1.5 font-medium"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[200px]">{shop.email}</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {shop.phone ? (
                              <a
                                href={`tel:${shop.phone}`}
                                className="text-bright-blue hover:opacity-80 hover:underline flex items-center gap-1.5 font-medium"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {shop.phone}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-semibold border-bright-blue/30 text-bright-blue bg-bright-blue/10 rounded-md px-2.5 py-1 text-xs">
                              {shop.paymentTerms}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 bg-background shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(shop)}
                                title="Edit vendor"
                                className="text-muted-foreground hover:text-bright-blue hover:bg-bright-blue/10"
                              >
                                <Edit className="h-5 w-5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(shop)}
                                className="text-muted-foreground hover:text-danger hover:bg-danger/5"
                                title="Delete vendor"
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <ShopManagementDialog
        shop={editingShop}
        open={showAddDialog || !!editingShop}
        onClose={handleCloseDialog}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingShop} onOpenChange={() => setDeletingShop(undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Vendor
            </DialogTitle>
            <DialogDescription className="text-gray-600 pt-2">
              Are you sure you want to delete <strong className="text-gray-900">{deletingShop?.businessName}</strong>?
              <br />
              <span className="text-red-600 font-medium">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeletingShop(undefined)}
              disabled={deleteShop.isPending}
              className="border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteShop.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm"
            >
              {deleteShop.isPending ? "Deleting..." : "Delete Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
