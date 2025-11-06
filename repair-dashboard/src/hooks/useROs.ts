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

export function useUpdateROStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      status,
      notes,
    }: {
      rowIndex: number;
      status: string;
      notes?: string;
    }) => excelService.updateROStatus(rowIndex, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
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

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      const ros = await excelService.getRepairOrders();

      const stats: DashboardStats = {
        totalActive: ros.filter(
          (ro) => ro.currentStatus !== "PAID >>>>" && ro.currentStatus !== "BER"
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
        totalValue: ros.reduce((sum, ro) => sum + (ro.finalCost || 0), 0),
        // New stats
        dueToday: ros.filter((ro) => isDueToday(ro.nextDateToUpdate)).length,
        overdue30Plus: ros.filter((ro) => ro.daysOverdue > 30).length,
        onTrack: ros.filter((ro) => isOnTrack(ro.nextDateToUpdate)).length,
      };

      return stats;
    },
  });
}
