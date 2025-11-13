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
import { Search, ArrowUpDown, AlertTriangle, Plus, Mail, X, Filter, Edit, Trash2, AlertCircle, Clock, DollarSign, ClipboardList, ChevronDown, ChevronRight, MoreVertical, Eye } from "lucide-react";
import { toast } from "sonner";
import type { RepairOrder } from "../types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
      let aVal, bVal;

      // Special handling for cost column (uses finalCost || estimatedCost)
      if (sortColumn === 'finalCost') {
        aVal = a.finalCost || a.estimatedCost || 0;
        bVal = b.finalCost || b.estimatedCost || 0;
      } else {
        aVal = a[sortColumn];
        bVal = b[sortColumn];
      }

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

  const toggleRowExpansion = (roId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(roId)) {
        newSet.delete(roId);
      } else {
        newSet.add(roId);
      }
      return newSet;
    });
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search ROs, shops, parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-2 border-input focus:border-bright-blue focus:ring-4 focus:ring-bright-blue/10 focus:bg-bg-secondary rounded-xl transition-all duration-200 w-full"
          />
        </div>
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="text-xs sm:text-sm font-semibold text-muted-foreground bg-secondary px-3 sm:px-4 py-2 rounded-lg border border-border">
            {filteredAndSorted.length} of {ros?.length || 0} ROs
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-blue text-white font-semibold shadow-[0_4px_12px_rgba(2,132,199,0.3)] button-lift transition-all duration-200 rounded-lg px-3 sm:px-4"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New RO</span>
          </Button>
        </div>
      </div>

      {/* Smart Filters */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="hidden sm:inline">Filters:</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter("overdue", !filters.overdue)}
          className={
            filters.overdue
              ? "bg-danger text-white border-danger hover:bg-danger/90 shadow-[0_2px_8px_rgba(239,68,68,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-danger/10 text-danger border-danger/30 hover:bg-danger/15 hover:border-danger/50 transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Overdue</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter("dueThisWeek", !filters.dueThisWeek)}
          className={
            filters.dueThisWeek
              ? "bg-warning text-white border-warning hover:bg-warning/90 shadow-[0_2px_8px_rgba(245,158,11,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-warning/10 text-warning border-warning/30 hover:bg-warning/15 hover:border-warning/50 transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Due This Week</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter("highValue", !filters.highValue)}
          className={
            filters.highValue
              ? "bg-success text-white border-success hover:bg-success/90 shadow-[0_2px_8px_rgba(16,185,129,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-success/10 text-success border-success/30 hover:bg-success/15 hover:border-success/50 transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">High Value ($5K+)</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilter("waitingAction", !filters.waitingAction)}
          className={
            filters.waitingAction
              ? "bg-bright-blue text-white border-bright-blue hover:bg-bright-blue/90 shadow-[0_2px_8px_rgba(2,132,199,0.3)] font-semibold transition-smooth text-xs sm:text-sm px-2 sm:px-3"
              : "bg-bright-blue/10 text-bright-blue border-bright-blue/30 hover:bg-bright-blue/15 hover:border-bright-blue/50 transition-smooth text-xs sm:text-sm px-2 sm:px-3"
          }
        >
          <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Waiting Quote</span>
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary text-xs sm:text-sm px-2 sm:px-3"
          >
            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Clear Filters ({activeFilterCount})</span>
            <span className="sm:hidden">Clear ({activeFilterCount})</span>
          </Button>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-background shadow-vibrant-lg">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary hover:bg-secondary border-b border-border">
                <TableHead className="w-[40px] sm:w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Select all"
                    className={isSomeSelected ? "data-[state=checked]:bg-bright-blue" : ""}
                  />
                </TableHead>
                <TableHead className="w-[40px] sm:w-[50px]"></TableHead>
                <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("roNumber")}
                    className="hover:bg-bg-hover font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] px-2 sm:px-3"
                  >
                    RO #
                    <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
                  Part #
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
                  Description
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("nextDateToUpdate")}
                    className="hover:bg-bg-hover font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] px-2 sm:px-3"
                  >
                    Next Update
                    <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </TableHead>
                <TableHead className="sticky right-0 bg-secondary hover:bg-secondary shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] font-semibold text-muted-foreground text-[11px] sm:text-[12px] md:text-[13px] uppercase text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((ro) => {
                const isExpanded = expandedRows.has(ro.id);
                return (
                  <>
                    <TableRow
                      key={ro.id}
                      className={`hover:bg-bg-hover transition-smooth border-b border-border group ${
                        ro.isOverdue ? "bg-danger/5 hover:bg-danger/10" : ""
                      } ${
                        selectedRONumbers.includes(ro.roNumber) ? "bg-bright-blue/5" : ""
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRONumbers.includes(ro.roNumber)}
                          onCheckedChange={() => handleToggleSelect(ro.roNumber)}
                          aria-label={`Select RO ${ro.roNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(ro.id)}
                          className="p-0 h-auto hover:bg-transparent"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {ro.roNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {ro.partNumber}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-muted-foreground">
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
                        <div className="text-foreground">
                          {formatDate(ro.nextDateToUpdate)}
                        </div>
                        {ro.isOverdue && (
                          <div className="text-xs font-semibold text-danger flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            {ro.daysOverdue} days overdue
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={`sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] ${
                        ro.isOverdue ? "bg-danger/5 hover:bg-danger/10" : selectedRONumbers.includes(ro.roNumber) ? "bg-bright-blue/5" : "bg-background"
                      }`}>
                        <div className="flex items-center justify-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-foreground hover:bg-secondary"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setSelectedRO(ro)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingRO(ro)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEmailRO(ro)}>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeletingRO(ro)}
                                className="text-danger focus:text-danger"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${ro.id}-expanded`} className="bg-secondary/30 hover:bg-secondary/30">
                        <TableCell colSpan={8} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Part Information */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                Part Information
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Part #:</span>
                                  <span className="font-medium text-foreground">{ro.partNumber}</span>
                                </div>
                                {ro.serialNumber && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Serial #:</span>
                                    <span className="font-medium text-foreground">{ro.serialNumber}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Description:</span>
                                  <span className="font-medium text-foreground text-right max-w-[200px]">{ro.partDescription}</span>
                                </div>
                              </div>
                            </div>

                            {/* Shop & Logistics */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                Shop & Logistics
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Shop:</span>
                                  <span className="font-medium text-foreground">{ro.shopName}</span>
                                </div>
                                {ro.shopReferenceNumber && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shop Ref #:</span>
                                    <span className="font-medium text-foreground">{ro.shopReferenceNumber}</span>
                                  </div>
                                )}
                                {ro.terms && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Terms:</span>
                                    <span className="font-medium text-foreground">{ro.terms}</span>
                                  </div>
                                )}
                                {ro.trackingNumber && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tracking #:</span>
                                    <span className="font-medium text-foreground">{ro.trackingNumber}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                Timeline
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Created:</span>
                                  <span className="font-medium text-foreground">{formatDate(ro.dateMade)}</span>
                                </div>
                                {ro.dateDroppedOff && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Dropped Off:</span>
                                    <span className="font-medium text-foreground">{formatDate(ro.dateDroppedOff)}</span>
                                  </div>
                                )}
                                {ro.estimatedDeliveryDate && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Est. Delivery:</span>
                                    <span className="font-medium text-foreground">{formatDate(ro.estimatedDeliveryDate)}</span>
                                  </div>
                                )}
                                {ro.lastDateUpdated && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Last Updated:</span>
                                    <span className="font-medium text-foreground">{formatDate(ro.lastDateUpdated)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Financials */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                Financials
                              </h4>
                              <div className="space-y-1 text-sm">
                                {ro.estimatedCost && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Estimated Cost:</span>
                                    <span className="font-medium text-foreground">{formatCurrency(ro.estimatedCost)}</span>
                                  </div>
                                )}
                                {ro.finalCost && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Final Cost:</span>
                                    <span className="font-semibold text-foreground">{formatCurrency(ro.finalCost)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status Tracking */}
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                Status Tracking
                              </h4>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Current Status:</span>
                                  <StatusBadge status={ro.currentStatus} isOverdue={ro.isOverdue} />
                                </div>
                                {ro.currentStatusDate && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status Date:</span>
                                    <span className="font-medium text-foreground">{formatDate(ro.currentStatusDate)}</span>
                                  </div>
                                )}
                                {ro.genThrustStatus && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Genthrust Status:</span>
                                    <span className="font-medium text-foreground">{ro.genThrustStatus}</span>
                                  </div>
                                )}
                                {ro.shopStatus && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Shop Status:</span>
                                    <span className="font-medium text-foreground">{ro.shopStatus}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Additional Information */}
                            {(ro.requiredWork || ro.notes) && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-1">
                                  Additional
                                </h4>
                                <div className="space-y-1 text-sm">
                                  {ro.requiredWork && (
                                    <div>
                                      <span className="text-muted-foreground">Required Work:</span>
                                      <p className="font-medium text-foreground mt-1">{ro.requiredWork}</p>
                                    </div>
                                  )}
                                  {ro.notes && (
                                    <div>
                                      <span className="text-muted-foreground">Notes:</span>
                                      <p className="font-medium text-foreground mt-1">{ro.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
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
