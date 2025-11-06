import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopService } from "../lib/shopService";
import type { Shop } from "../types";
import { toast } from "sonner";

export function useShops() {
  return useQuery({
    queryKey: ["shops"],
    queryFn: () => shopService.getShops(),
  });
}

export function useAddShop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      shopName: string;
      contactName: string;
      email: string;
      phone: string;
      defaultTerms: string;
      typicalTAT: number;
      notes?: string;
    }) => shopService.addShop(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Shop added successfully");
    },
    onError: (error) => {
      console.error("Add shop error:", error);
      toast.error("Failed to add shop");
    },
  });
}

export function useUpdateShop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rowIndex,
      data,
    }: {
      rowIndex: number;
      data: {
        shopName: string;
        contactName: string;
        email: string;
        phone: string;
        defaultTerms: string;
        typicalTAT: number;
        notes: string;
        active: boolean;
      };
    }) => shopService.updateShop(rowIndex, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Shop updated successfully");
    },
    onError: (error) => {
      console.error("Update shop error:", error);
      toast.error("Failed to update shop");
    },
  });
}
