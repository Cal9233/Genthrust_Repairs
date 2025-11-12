import { useState, useMemo } from "react";
import { useROs, useUpdateROStatus, useBulkUpdateStatus, useDeleteRepairOrder } from "../hooks/useROs";
import { useShops } from "../hooks/useShops";
import { useROFilters } from "../hooks/useROFilters";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "./StatusBadge";
import { RODetailDialog } from "./RODetailDialog";
import { AddRODialog } from "./AddRODialog";
import { EmailComposerDialog } from "./EmailComposerDialog";
import { BulkActionsBar } from "./BulkActionsBar";
import { exportToCSV } from "../lib/exportUtils";
import { Search, ArrowUpDown, AlertTriangle, Plus, Mail, X, Filter, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { RepairOrder } from "../types";

export function ROTable() {
  const { data: ros, isLoading } = useROs();
  const { data: shops } = useShops();
  const updateStatus = useUpdateROStatus();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const deleteRO = useDeleteRepairOrder();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RepairOrder>("roNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);
  const [emailRO, setEmailRO] = useState<RepairOrder | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRO, setEditingRO] = useState<RepairOrder | undefined>(undefined);
  const [deletingRO, setDeletingRO] = useState<RepairOrder | undefined>(undefined);
  const [selectedRONumbers, setSelectedRONumbers] = useState<string[]>([]);

  // Filters
  const {
    filters,
    setFilter,
    clearFilters,
    filteredROs: filterAppliedROs,
    activeFilterCount,
  } = useROFilters(ros || []);

  const filteredAndSorted = useMemo(() => {
    if (!ros) return [];

    // Start with filter-applied ROs
    let filtered = filterAppliedROs;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (ro) =>
          String(ro.roNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.shopName)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.partDescription)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.serialNumber)?.toLowerCase().includes(search.toLowerCase())
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
  }, [filterAppliedROs, search, sortColumn, sortDirection]);

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

  // Handler to log email in status history
  const handleLogEmail = (ro: RepairOrder, subject: string, templateName: string) => {
    const rowIndex = parseInt(ro.id.replace("row-", ""));
    const emailNote = `Email sent: ${subject} (Template: ${templateName})`;

    updateStatus.mutate({
      rowIndex,
      status: ro.currentStatus,
      notes: emailNote,
    });
  };

  // Find shop for email RO
  const emailShop = useMemo(() => {
    if (!emailRO || !shops) return null;
    return shops.find((shop) => shop.shopName === emailRO.shopName) || null;
  }, [emailRO, shops]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedRONumbers.length === filteredAndSorted.length) {
      setSelectedRONumbers([]);
    } else {
      setSelectedRONumbers(filteredAndSorted.map((ro) => ro.roNumber));
    }
  };

  const handleToggleSelect = (roNumber: string) => {
    setSelectedRONumbers((prev) =>
      prev.includes(roNumber)
        ? prev.filter((num) => num !== roNumber)
        : [...prev, roNumber]
    );
  };

  const isAllSelected =
    filteredAndSorted.length > 0 &&
    selectedRONumbers.length === filteredAndSorted.length;

  const isSomeSelected =
    selectedRONumbers.length > 0 &&
    selectedRONumbers.length < filteredAndSorted.length;

  // Bulk action handlers
  const handleMarkAsSent = () => {
    bulkUpdateStatus.mutate(
      { roNumbers: selectedRONumbers, newStatus: "TO SEND" },
      {
        onSuccess: () => {
          setSelectedRONumbers([]);
        },
      }
    );
  };

  const handleRequestUpdates = () => {
    toast.info("Email composer for multiple ROs coming soon!");
    // Future: Open email composer with multi-RO template
  };

  const handleExportSelected = () => {
    if (!ros) return;
    const selectedROs = ros.filter((ro) =>
      selectedRONumbers.includes(ro.roNumber)
    );
    exportToCSV(selectedROs, `selected_ros_${new Date().toISOString().split("T")[0]}.csv`);
    toast.success(`Exported ${selectedROs.length} repair orders to CSV`);
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

      {/* Smart Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
          <Filter className="h-4 w-4" />
          Filters:
        </div>
        <Button
          variant={filters.overdue ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("overdue", !filters.overdue)}
          className={filters.overdue ? "bg-red-600 hover:bg-red-700" : ""}
        >
          🔴 Overdue
        </Button>
        <Button
          variant={filters.dueThisWeek ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("dueThisWeek", !filters.dueThisWeek)}
          className={filters.dueThisWeek ? "bg-yellow-600 hover:bg-yellow-700" : ""}
        >
          ⏰ Due This Week
        </Button>
        <Button
          variant={filters.highValue ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("highValue", !filters.highValue)}
          className={filters.highValue ? "bg-green-600 hover:bg-green-700" : ""}
        >
          💰 High Value ($5K+)
        </Button>
        <Button
          variant={filters.waitingAction ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("waitingAction", !filters.waitingAction)}
          className={filters.waitingAction ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          📋 Waiting Quote
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-gray-600 hover:text-gray-900"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters ({activeFilterCount})
          </Button>
        )}
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Select all"
                    className={isSomeSelected ? "data-[state=checked]:bg-blue-500" : ""}
                  />
                </TableHead>
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
                <TableHead className="sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] font-semibold text-gray-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((ro) => (
                <TableRow
                  key={ro.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    ro.isOverdue ? "bg-red-50 hover:bg-red-100" : ""
                  } ${
                    selectedRONumbers.includes(ro.roNumber) ? "bg-blue-50" : ""
                  }`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedRONumbers.includes(ro.roNumber)}
                      onCheckedChange={() => handleToggleSelect(ro.roNumber)}
                      aria-label={`Select RO ${ro.roNumber}`}
                    />
                  </TableCell>
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
                  <TableCell className="sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRO(ro);
                        }}
                        className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit RO"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRO(ro);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete RO"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmailRO(ro);
                        }}
                        className="text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                        title="Send Email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setSelectedRO(ro)}
                        className="bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
                      >
                        View Details
                      </Button>
                    </div>
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

      {emailRO && (
        <EmailComposerDialog
          ro={emailRO}
          shop={emailShop}
          open={!!emailRO}
          onClose={() => setEmailRO(null)}
          onLogEmail={(subject, templateName) =>
            handleLogEmail(emailRO, subject, templateName)
          }
        />
      )}

      <AddRODialog
        ro={editingRO}
        open={showAddDialog || !!editingRO}
        onClose={() => {
          setShowAddDialog(false);
          setEditingRO(undefined);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingRO} onOpenChange={() => setDeletingRO(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repair Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete RO <strong>{deletingRO?.roNumber}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingRO(undefined)}
              disabled={deleteRO.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingRO) {
                  const rowIndex = parseInt(deletingRO.id.replace("row-", ""));
                  deleteRO.mutate(rowIndex, {
                    onSuccess: () => {
                      setDeletingRO(undefined);
                    },
                  });
                }
              }}
              disabled={deleteRO.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteRO.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRONumbers.length}
        onClearSelection={() => setSelectedRONumbers([])}
        onMarkAsSent={handleMarkAsSent}
        onRequestUpdates={handleRequestUpdates}
        onExportSelected={handleExportSelected}
      />
    </div>
  );
}
