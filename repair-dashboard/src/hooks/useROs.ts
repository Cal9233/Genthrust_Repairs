import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repairOrderService } from "../services/repairOrderService";
import type { DashboardStats } from "../types";
import { toast } from "sonner";
import { analyticsCache, createInvalidationEvent } from "../services/analyticsCache";
import { createLogger } from "../utils/logger";

const logger = createLogger('useROs');

export function useROs() {
  return useQuery({
    queryKey: ["ros"],
    queryFn: () => repairOrderService.getRepairOrders('ACTIVE'),
  });
}

export function useArchivedROs(sheetName: string, tableName: string) {
  return useQuery({
    queryKey: ["archived-ros", sheetName, tableName],
    queryFn: () => repairOrderService.getArchivedROs(sheetName as 'Paid' | 'NET' | 'Returns'),
    enabled: !!sheetName, // Only run if sheet name is provided
  });
}

export function useUpdateROStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
      cost,
      deliveryDate,
    }: {
      id: string;
      status: string;
      notes?: string;
      cost?: number;
      deliveryDate?: Date;
    }) => repairOrderService.updateROStatus(id, status, notes, cost, deliveryDate),
    onSuccess: async (updatedRO) => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate analytics cache for the affected shop
      try {
        const event = createInvalidationEvent('update', [updatedRO]);
        analyticsCache.invalidate(event);
        logger.debug('Analytics cache invalidated after status update', {
          roNumber: updatedRO.roNumber,
          shopName: updatedRO.shopName,
        });
      } catch (error) {
        logger.error('Failed to invalidate analytics cache', error);
      }

      toast.success("Status updated successfully");
    },
    onError: (error) => {
      logger.error("Update error", error);
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
    }) => repairOrderService.addRepairOrder(data),
    onSuccess: (createdRO) => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate analytics cache for the affected shop
      analyticsCache.invalidate({
        reason: 'create',
        affectedShops: [createdRO.shopName],
        timestamp: Date.now(),
      });
      logger.debug('Analytics cache invalidated after RO creation', {
        roNumber: createdRO.roNumber,
        shopName: createdRO.shopName,
      });

      toast.success("Repair order created successfully");
    },
    onError: (error) => {
      logger.error("Create error", error);
      toast.error("Failed to create repair order");
    },
  });
}

export function useUpdateRepairOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
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
    }) => repairOrderService.updateRepairOrder(id, data),
    onSuccess: (updatedRO) => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate analytics cache for the affected shop
      analyticsCache.invalidate({
        reason: 'update',
        affectedShops: [updatedRO.shopName],
        timestamp: Date.now(),
      });
      logger.debug('Analytics cache invalidated after RO update', {
        roNumber: updatedRO.roNumber,
        shopName: updatedRO.shopName,
      });

      toast.success("Repair order updated successfully");
    },
    onError: (error) => {
      logger.error("Update error", error);
      toast.error("Failed to update repair order");
    },
  });
}

export function useDeleteRepairOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => repairOrderService.deleteRepairOrder(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate all analytics cache on delete (we don't know which shop was affected)
      analyticsCache.invalidateAll();
      logger.debug('All analytics cache invalidated after RO deletion');

      toast.success("Repair order deleted successfully");
    },
    onError: (error) => {
      logger.error("Delete error", error);
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
      // Get all ROs to find IDs
      const allROs = await repairOrderService.getRepairOrders('ACTIVE');

      // Update each RO
      const updates = roNumbers.map((roNumber) => {
        const ro = allROs.find((r) => r.roNumber === roNumber);
        if (!ro) throw new Error(`RO ${roNumber} not found`);

        return repairOrderService.updateROStatus(ro.id, newStatus);
      });

      await Promise.all(updates);
      return allROs.filter((ro) => roNumbers.includes(ro.roNumber));
    },
    onSuccess: (affectedROs, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate analytics cache for all affected shops
      if (affectedROs && affectedROs.length > 0) {
        const event = createInvalidationEvent('update', affectedROs);
        analyticsCache.invalidate(event);
        logger.debug('Analytics cache invalidated after bulk update', {
          roCount: affectedROs.length,
          affectedShops: event.affectedShops,
        });
      }

      toast.success(
        `Successfully updated ${variables.roNumbers.length} repair order${
          variables.roNumbers.length > 1 ? "s" : ""
        }`
      );
    },
    onError: (error) => {
      logger.error("Bulk update error", error);
      toast.error("Failed to update repair orders");
    },
  });
}

export function useArchiveRO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      targetSheetName,
    }: {
      id: string;
      targetSheetName: string;
    }) => {
      // Map sheet names to archiveStatus
      const statusMap: Record<string, 'PAID' | 'NET' | 'RETURNED'> = {
        'Paid': 'PAID',
        'NET': 'NET',
        'Returns': 'RETURNED'
      };
      const archiveStatus = statusMap[targetSheetName] || 'PAID';
      return repairOrderService.archiveRepairOrder(id, archiveStatus);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["ros"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });

      // Invalidate all analytics cache on archive (RO removed from active list)
      analyticsCache.invalidateAll();
      logger.debug('All analytics cache invalidated after RO archive');

      toast.success("Repair order archived successfully");
    },
    onError: (error) => {
      logger.error("Archive error", error);
      toast.error("Failed to archive repair order");
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => repairOrderService.getDashboardStats(),
  });
}
