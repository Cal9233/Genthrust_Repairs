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
import { Search, ArrowUpDown } from "lucide-react";
import type { RepairOrder } from "../types";

export function ROTable() {
  const { data: ros, isLoading } = useROs();
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof RepairOrder>("roNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedRO, setSelectedRO] = useState<RepairOrder | null>(null);

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
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (isLoading) {
    return <div className="p-8">Loading repair orders...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ROs, shops, parts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredAndSorted.length} of {ros?.length || 0} ROs
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("roNumber")}
                  className="hover:bg-transparent"
                >
                  RO #
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("nextDateToUpdate")}
                  className="hover:bg-transparent"
                >
                  Next Update
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.map((ro) => (
              <TableRow key={ro.id} className={ro.isOverdue ? "bg-red-50" : ""}>
                <TableCell className="font-medium">{ro.roNumber}</TableCell>
                <TableCell>{ro.shopName}</TableCell>
                <TableCell>
                  <div className="max-w-xs truncate">{ro.partDescription}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={ro.currentStatus}
                    isOverdue={ro.isOverdue}
                  />
                </TableCell>
                <TableCell>
                  <div>{formatDate(ro.nextDateToUpdate)}</div>
                  {ro.isOverdue && (
                    <div className="text-xs text-red-600">
                      {ro.daysOverdue} days overdue
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(ro.finalCost)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRO(ro)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedRO && (
        <RODetailDialog
          ro={selectedRO}
          open={!!selectedRO}
          onClose={() => setSelectedRO(null)}
        />
      )}
    </div>
  );
}
