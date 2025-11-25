import { useState, useMemo } from "react";
import {
  useROs,
  useArchivedROs,
  useUpdateROStatus,
  useBulkUpdateStatus,
  useDeleteRepairOrder,
} from "../../hooks/useROs";
import { useShops } from "../../hooks/useShops";
import { useROFilters } from "../../hooks/useROFilters";
import { buildShopAnalytics, predictCompletion } from "../../services/analyticsEngine";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RODetailDialog } from "../RODetailDialog";
import { AddRODialog } from "../AddRODialog";
import { EmailComposerDialog } from "../EmailComposerDialog";
import { BulkActionsBar } from "../BulkActionsBar";
import { exportToCSV } from "../../lib/exportUtils";
import { toast } from "sonner";
import type { RepairOrder } from "../../types";
import { ROTableFilters } from "./TableFilters";
import { ROTableHeader } from "./TableHeader";
import { ROTableBody } from "./TableBody";
import { ROTablePagination } from "./TablePagination";
import type { SortColumn, SortDirection } from "./types";

/**
 * ROTable - Main repair order table component
 *
 * A comprehensive table for managing repair orders with:
 * - View selection (Active, Paid Archive, Returns, NET Archive)
 * - Search and smart filters (Overdue, Due This Week, High Value, Waiting Quote)
 * - Sortable columns (RO #, Next Update, Cost)
 * - Expandable rows with detailed information
 * - Bulk selection and actions
 * - Action dropdown menu (View, Edit, Email, Delete)
 * - Pagination controls
 * - Responsive design
 *
 * Refactored into compound components for better maintainability:
 * - ROTableFilters: Search, view selector, filter buttons
 * - ROTableHeader: Sortable table header
 * - ROTableBody: Maps ROs to ROTableRow components
 * - ROTableRow: Individual RO row with expandable details
 * - ROTablePagination: Pagination controls
 *
 * @example
 * ```tsx
 * <ROTable />
 * ```
 */
export function ROTable() {
  // View selection: "active" or archive sheet names
  const [selectedView, setSelectedView] = useState<string>("active");
  const [archiveSheet, setArchiveSheet] = useState<string>("");
  const [archiveTable, setArchiveTable] = useState<string>("");

  // Fetch active ROs
  const { data: ros, isLoading } = useROs();

  // Fetch archived ROs if archive view is selected
  const { data: archivedRos, isLoading: isLoadingArchived } = useArchivedROs(
    archiveSheet,
    archiveTable
  );

  const { data: shops } = useShops();
  const updateStatus = useUpdateROStatus();
  const bulkUpdateStatus = useBulkUpdateStatus();
  const deleteRO = useDeleteRepairOrder();

  // Search and filter state
  const [search, setSearch] = useState("");

  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>("roNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Dialog state
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);
  const [emailRO, setEmailRO] = useState<RepairOrder | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRO, setEditingRO] = useState<RepairOrder | undefined>(undefined);
  const [deletingRO, setDeletingRO] = useState<RepairOrder | undefined>(undefined);

  // Selection state
  const [selectedRONumbers, setSelectedRONumbers] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Determine which RO set to use based on selectedView
  const currentROs = selectedView === "active" ? ros : archivedRos;
  const currentIsLoading = selectedView === "active" ? isLoading : isLoadingArchived;

  // Filters
  const {
    filters,
    setFilter,
    clearFilters,
    filteredROs: filterAppliedROs,
    activeFilterCount,
  } = useROFilters(currentROs || []);

  // Build shop analytics profiles for predictions
  const shopProfiles = useMemo(() => {
    if (!currentROs) return new Map();
    return buildShopAnalytics(currentROs);
  }, [currentROs]);

  // Apply search, sort, and pagination
  const { filteredAndSorted, paginatedROs } = useMemo(() => {
    if (!currentROs) return { filteredAndSorted: [], paginatedROs: [] };

    // Start with filter-applied ROs
    let filtered = filterAppliedROs;

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (ro) =>
          String(ro.roNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.shopName)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.partDescription)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.serialNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.partNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.shopReferenceNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.trackingNumber)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.requiredWork)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.currentStatus)?.toLowerCase().includes(search.toLowerCase()) ||
          String(ro.notes)?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;

      // Special handling for cost column (uses finalCost || estimatedCost)
      if (sortColumn === "finalCost") {
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

    // Apply pagination
    const paginated =
      pageSize === -1
        ? filtered
        : filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    return { filteredAndSorted: filtered, paginatedROs: paginated };
  }, [filterAppliedROs, search, sortColumn, sortDirection, currentPage, pageSize]);

  // Sort handler
  const handleSort = (column: keyof RepairOrder) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

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
    if (!currentROs) return;
    const selectedROs = currentROs.filter((ro) =>
      selectedRONumbers.includes(ro.roNumber)
    );
    exportToCSV(
      selectedROs,
      `selected_ros_${new Date().toISOString().split("T")[0]}.csv`
    );
    toast.success(`Exported ${selectedROs.length} repair orders to CSV`);
  };

  // Handler for changing views
  const handleViewChange = (value: string) => {
    setSelectedView(value);

    // If selecting an archive view, set the sheet and table names
    if (value !== "active") {
      // Parse the value format: "sheetName:tableName"
      const [sheet, table] = value.split(":");
      setArchiveSheet(sheet);
      setArchiveTable(table);
    } else {
      setArchiveSheet("");
      setArchiveTable("");
    }

    // Reset pagination when changing views
    setCurrentPage(0);
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

  // Loading state
  if (currentIsLoading) {
    return <LoadingSpinner size="md" text="Loading repair orders..." />;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filters Section */}
      <ROTableFilters
        search={search}
        onSearchChange={setSearch}
        selectedView={selectedView}
        onViewChange={handleViewChange}
        filters={filters}
        onToggleFilter={(filterKey) => setFilter(filterKey, !filters[filterKey])}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        totalCount={currentROs?.length || 0}
        filteredCount={filteredAndSorted.length}
        showAddButton={selectedView === "active"}
        onClickAdd={() => setShowAddDialog(true)}
        ros={currentROs || []}
        fullFilters={filters}
        setFilter={setFilter}
      />

      {/* Table Section */}
      <div className="border border-border rounded-xl overflow-hidden bg-background shadow-vibrant-lg">
        <div className="overflow-x-auto">
          <Table>
            <ROTableHeader
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onToggleSelectAll={handleToggleSelectAll}
            />
            <ROTableBody
              repairOrders={paginatedROs}
              selectedRONumbers={selectedRONumbers}
              expandedRows={expandedRows}
              shopProfiles={shopProfiles}
              onToggleSelect={handleToggleSelect}
              onToggleExpand={toggleRowExpansion}
              onViewDetails={setSelectedRO}
              onEdit={setEditingRO}
              onSendEmail={setEmailRO}
              onDelete={setDeletingRO}
              predictCompletion={predictCompletion}
            />
          </Table>
        </div>

        {/* Pagination Section */}
        <ROTablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredAndSorted.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Dialogs */}
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
              Are you sure you want to delete RO{" "}
              <strong>{deletingRO?.roNumber}</strong>? This action cannot be
              undone.
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
