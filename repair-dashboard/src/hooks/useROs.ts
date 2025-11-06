import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { excelService } from "../lib/excelService";
import type { DashboardStats } from "../types";
import { toast } from "sonner";

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
      };

      return stats;
    },
  });
}
