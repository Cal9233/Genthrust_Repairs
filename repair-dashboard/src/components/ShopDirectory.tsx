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
import { useShops } from "../hooks/useShops";
import { ShopManagementDialog } from "./ShopManagementDialog";
import type { Shop } from "../types";
import { Store, Plus, Search, Edit, Mail, Phone, Clock } from "lucide-react";

export function ShopDirectory() {
  const { data: shops = [], isLoading } = useShops();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | undefined>(undefined);

  // Filter shops based on search query
  const filteredShops = shops.filter(
    (shop) =>
      shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (shop: Shop) => {
    setEditingShop(shop);
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setEditingShop(undefined);
  };

  if (isLoading) {
    return <div className="p-8">Loading shops...</div>;
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
                Shop Directory
              </h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Manage repair shops and their information
            </p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Shop
          </Button>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search shops by name, contact, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Shop Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-blue-900">
                Total Shops
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
                Active Shops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {shops.filter((s) => s.active).length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-900">
                Inactive Shops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {shops.filter((s) => !s.active).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shop Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              All Shops ({filteredShops.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead>TAT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Store className="h-12 w-12 text-gray-300" />
                          <p className="font-medium">No shops found</p>
                          <p className="text-sm">
                            {searchQuery
                              ? "Try adjusting your search"
                              : "Get started by adding your first shop"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredShops.map((shop) => (
                      <TableRow key={shop.id}>
                        <TableCell className="font-medium">
                          {shop.shopName}
                        </TableCell>
                        <TableCell>{shop.contactName}</TableCell>
                        <TableCell>
                          {shop.email && (
                            <a
                              href={`mailto:${shop.email}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Mail className="h-3 w-3" />
                              {shop.email}
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          {shop.phone && (
                            <a
                              href={`tel:${shop.phone}`}
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {shop.phone}
                            </a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{shop.defaultTerms}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-gray-500" />
                            {shop.typicalTAT} days
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={shop.active ? "default" : "secondary"}
                            className={
                              shop.active
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-gray-100 text-gray-800 border-gray-200"
                            }
                          >
                            {shop.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(shop)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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
    </>
  );
}
