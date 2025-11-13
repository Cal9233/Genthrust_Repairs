import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";
import type { DashboardStats } from "../types";
import { toast } from "sonner";
import { isDueToday, isOnTrack } from "../lib/businessRules";

export function useROs() {
  return useQuery({
    queryKey: ["ros"],
    queryFn: () => excelService.getRepairOrders(),
  });
}

export function useArchivedROs(sheetName: string, tableName: string) {
  return useQuery({
    queryKey: ["archived-ros", sheetName, tableName],
    queryFn: () => excelService.getRepairOrdersFromSheet(sheetName, tableName),
    enabled: !!sheetName && !!tableName, // Only run if sheet and table names are provided
  });
}

export function useUpdateROStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      status,
      notes,
      cost,
      deliveryDate,
    }: {
      rowIndex: number;
      status: string;
      notes?: string;
      cost?: number;
      deliveryDate?: Date;
    }) => excelService.updateROStatus(rowIndex, status, notes, cost, deliveryDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update status");
    },
  });
}

export function useAddRepairOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      roNumber: string;
      shopName: string;
      partNumber: string;
      serialNumber: string;
      partDescription: string;
      requiredWork: string;
      estimatedCost?: number;
      terms?: string;
      shopReferenceNumber?: string;
    }) => excelService.addRepairOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Repair order created successfully");
    },
    onError: (error) => {
      console.error("Create error:", error);
      toast.error("Failed to create repair order");
    },
  });
}

export function useUpdateRepairOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      data,
    }: {
      rowIndex: number;
      data: {
        roNumber: string;
        shopName: string;
        partNumber: string;
        serialNumber: string;
        partDescription: string;
        requiredWork: string;
        estimatedCost?: number;
        terms?: string;
        shopReferenceNumber?: string;
      };
    }) => excelService.updateRepairOrder(rowIndex, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Repair order updated successfully");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update repair order");
    },
  });
}

export function useDeleteRepairOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowIndex: number) => excelService.deleteRepairOrder(rowIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Repair order deleted successfully");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete repair order");
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roNumbers,
      newStatus,
    }: {
      roNumbers: string[];
      newStatus: string;
    }) => {
      // Get all ROs to find row indices
      const allROs = await excelService.getRepairOrders();

      // Update each RO
      const updates = roNumbers.map((roNumber) => {
        const ro = allROs.find((r) => r.roNumber === roNumber);
        if (!ro) throw new Error(`RO ${roNumber} not found`);

        const rowIndex = parseInt(ro.id.replace("row-", ""));
        return excelService.updateROStatus(rowIndex, newStatus);
      });

      await Promise.all(updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(
        `Successfully updated ${variables.roNumbers.length} repair order${
          variables.roNumbers.length > 1 ? "s" : ""
        }`
      );
    },
    onError: (error) => {
      console.error("Bulk update error:", error);
      toast.error("Failed to update repair orders");
    },
  });
}

export function useArchiveRO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      targetSheetName,
      targetTableName,
    }: {
      rowIndex: number;
      targetSheetName: string;
      targetTableName: string;
    }) => excelService.moveROToArchive(rowIndex, targetSheetName, targetTableName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Repair order archived successfully");
    },
    onError: (error) => {
      console.error("Archive error:", error);
      toast.error("Failed to archive repair order");
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const ros = await excelService.getRepairOrders();

      const stats: DashboardStats = {
        totalActive: ros.filter(
          (ro) =>
            !ro.currentStatus.includes("PAID") &&
            ro.currentStatus !== "PAYMENT SENT" &&
            ro.currentStatus !== "BER" &&
            !ro.currentStatus.includes("CANCEL") &&
            !ro.currentStatus.includes("RAI")
        ).length,
        overdue: ros.filter((ro) => ro.isOverdue).length,
        waitingQuote: ros.filter((ro) =>
          ro.currentStatus.includes("WAITING QUOTE")
        ).length,
        approved: ros.filter((ro) => ro.currentStatus.includes("APPROVED"))
          .length,
        beingRepaired: ros.filter((ro) =>
          ro.currentStatus.includes("BEING REPAIRED")
        ).length,
        shipping: ros.filter((ro) => ro.currentStatus.includes("SHIPPING"))
          .length,
        totalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || ro.estimatedCost || 0), 0),
        totalEstimatedValue: ros.reduce((sum, ro) => sum + (ro.estimatedCost || 0), 0),
        totalFinalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || 0), 0),
        // New stats
        dueToday: ros.filter((ro) => isDueToday(ro.nextDateToUpdate)).length,
        overdue30Plus: ros.filter((ro) => ro.daysOverdue > 30).length,
        onTrack: ros.filter((ro) => isOnTrack(ro.nextDateToUpdate)).length,
        // Archive stats
        approvedPaid: ros.filter((ro) =>
          ro.currentStatus.includes("PAID") || ro.currentStatus === "PAYMENT SENT"
        ).length,
        rai: ros.filter((ro) => ro.currentStatus.includes("RAI")).length,
        ber: ros.filter((ro) => ro.currentStatus.includes("BER")).length,
        cancel: ros.filter((ro) => ro.currentStatus.includes("CANCEL")).length,
        approvedNet: ros.filter((ro) =>
          ro.currentStatus.includes("NET") || ro.terms?.includes("NET")
        ).length,
      };

      return stats;
    },
  });
}
