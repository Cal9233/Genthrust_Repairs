import { useState, useMemo } from "react";
import { useROs } from "../hooks/useROs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { RODetailDialog } from "./RODetailDialog";
import { AddRODialog } from "./AddRODialog";
import { Search, ArrowUpDown, AlertTriangle, Plus } from "lucide-react";
import type { RepairOrder } from "../types";

export function ROTable() {
  const { data: ros, isLoading } = useROs();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RepairOrder>("roNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filteredAndSorted = useMemo(() => {
    if (!ros) return [];

    // Filter
    let filtered = ros;
    if (search) {
      filtered = ros.filter(
        (ro) =>
          ro.roNumber.toLowerCase().includes(search.toLowerCase()) ||
          ro.shopName.toLowerCase().includes(search.toLowerCase()) ||
          ro.partDescription.toLowerCase().includes(search.toLowerCase()) ||
          ro.serialNumber.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [ros, search, sortColumn, sortDirection]);

  const handleSort = (column: keyof RepairOrder) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return "N/A";
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(dateObj);
    } catch {
      return "N/A";
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading repair orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ROs, shops, parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-600 bg-gray-100 px-4 py-2 rounded-lg">
            {filteredAndSorted.length} of {ros?.length || 0} ROs
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            New RO
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="font-semibold text-gray-700">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("roNumber")}
                    className="hover:bg-gray-100 font-semibold"
                  >
                    RO #
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Shop
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Part
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("nextDateToUpdate")}
                    className="hover:bg-gray-100 font-semibold"
                  >
                    Next Update
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right font-semibold text-gray-700">
                  Cost
                </TableHead>
                <TableHead className="font-semibold text-gray-700"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((ro) => (
                <TableRow
                  key={ro.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    ro.isOverdue ? "bg-red-50 hover:bg-red-100" : ""
                  }`}
                >
                  <TableCell className="font-semibold text-gray-900">
                    {ro.roNumber}
                  </TableCell>
                  <TableCell className="text-gray-700">{ro.shopName}</TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-gray-700">
                      {ro.partDescription}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={ro.currentStatus}
                      isOverdue={ro.isOverdue}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-gray-900">
                      {formatDate(ro.nextDateToUpdate)}
                    </div>
                    {ro.isOverdue && (
                      <div className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        {ro.daysOverdue} days overdue
                      </div>
                  )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">
                    {formatCurrency(ro.finalCost)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => setSelectedRO(ro)}
                      className="bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedRO && (
        <RODetailDialog
          ro={selectedRO}
          open={!!selectedRO}
          onClose={() => setSelectedRO(null)}
        />
      )}

      <AddRODialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </div>
  );
}
