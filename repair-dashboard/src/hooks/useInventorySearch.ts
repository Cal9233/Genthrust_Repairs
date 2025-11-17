import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryService, type InventorySearchResult } from "../services/inventoryService";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createLogger } from '@/utils/logger';

const logger = createLogger('useInventorySearch');

/**
 * Hook to search inventory with debouncing
 */
export function useInventorySearch(partNumber: string) {
  const [debouncedSearch, setDebouncedSearch] = useState(partNumber);

  // Debounce search input (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(partNumber);
    }, 500);

    return () => clearTimeout(timer);
  }, [partNumber]);

  return useQuery<InventorySearchResult[]>({
    queryKey: ["inventorySearch", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.trim() === '') {
        return [];
      }
      return inventoryService.searchInventory(debouncedSearch);
    },
    enabled: debouncedSearch.trim().length > 0, // Only search if there's input
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to get full details for a specific inventory item
 */
export function useInventoryDetails(tableName: string | null, rowId: string | null) {
  return useQuery({
    queryKey: ["inventoryDetails", tableName, rowId],
    queryFn: async () => {
      if (!tableName || !rowId) {
        return null;
      }
      return inventoryService.getInventoryDetails(tableName, rowId);
    },
    enabled: !!tableName && !!rowId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get column headers for a table
 */
export function useTableColumns(tableName: string | null) {
  return useQuery<string[]>({
    queryKey: ["tableColumns", tableName],
    queryFn: async () => {
      if (!tableName) {
        return [];
      }
      return inventoryService.getTableColumns(tableName);
    },
    enabled: !!tableName,
    staleTime: 30 * 60 * 1000, // Cache for 30 minutes (columns don't change often)
  });
}

/**
 * Hook to decrement inventory quantity
 * - Wraps inventoryService.decrementInventory in React Query mutation
 * - Invalidates inventory search cache on success
 * - Shows toast notifications for success/error
 */
export function useInventoryDecrement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      indexId,
      partNumber,
      tableName,
      rowId,
      roNumber,
      notes,
    }: {
      indexId: string;
      partNumber: string;
      tableName: string;
      rowId: string;
      roNumber?: string;
      notes?: string;
    }) => inventoryService.decrementInventory(indexId, partNumber, tableName, rowId, roNumber, notes),
    onSuccess: (result) => {
      // Invalidate inventory search cache to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["inventorySearch"] });

      // Show success toast with qty info
      if (result.isLowStock) {
        toast.warning(
          `⚠️ Inventory Updated - New quantity: ${result.newQty} (LOW STOCK WARNING!)`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Inventory updated - New quantity: ${result.newQty}`);
      }
    },
    onError: (error, variables) => {
      logger.error('Inventory decrement error', error as Error, {
        indexId: variables.indexId,
        partNumber: variables.partNumber,
        tableName: variables.tableName,
        rowId: variables.rowId,
        roNumber: variables.roNumber
      });
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        `Failed to update inventory: ${errorMessage}`,
        { duration: 5000 }
      );
    },
  });
}
