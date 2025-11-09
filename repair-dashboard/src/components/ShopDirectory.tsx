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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div>
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-600" />
              <h2 className="text-3xl font-bold text-gray-900">
                Vendor Directory
              </h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Manage repair vendors and their information
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Vendor
          </Button>
        </div>

        {/* Search Bar */}
        <Card className="shadow-sm border-gray-200">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search vendors by name, customer #, location, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shop Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-blue-900">
                Total Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">
                {shops.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-900">
                With Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {shops.filter((s) => s.email).length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-purple-900">
                With Website
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900">
                {shops.filter((s) => s.website).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shop Table */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="h-1 w-8 bg-blue-600 rounded"></div>
              All Vendors ({filteredShops.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Customer #</TableHead>
                    <TableHead className="font-semibold text-gray-700">Business Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">Contact</TableHead>
                    <TableHead className="font-semibold text-gray-700">Location</TableHead>
                    <TableHead className="font-semibold text-gray-700">Email</TableHead>
                    <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                    <TableHead className="font-semibold text-gray-700">Payment Terms</TableHead>
                    <TableHead className="sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Store className="h-12 w-12 text-gray-300" />
                          <p className="font-medium">No vendors found</p>
                          <p className="text-sm">
                            {searchQuery
                              ? "Try adjusting your search"
                              : "Get started by adding your first vendor"}
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
                        <TableRow key={shop.id} className="hover:bg-blue-50/50 transition-colors">
                          <TableCell className="font-mono text-sm text-gray-900">
                            {shop.customerNumber}
                          </TableCell>
                          <TableCell className="font-semibold text-gray-900">
                            {shop.businessName}
                          </TableCell>
                          <TableCell className="text-gray-700">{shop.contact || "—"}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {location || "—"}
                          </TableCell>
                          <TableCell>
                            {shop.email ? (
                              <a
                                href={`mailto:${shop.email}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-medium"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[200px]">{shop.email}</span>
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {shop.phone ? (
                              <a
                                href={`tel:${shop.phone}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 font-medium"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {shop.phone}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-medium border-blue-200 text-blue-700 bg-blue-50">
                              {shop.paymentTerms}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(shop)}
                                title="Edit vendor"
                                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(shop)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete vendor"
                              >
                                <Trash2 className="h-4 w-4" />
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
