import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopService } from "../lib/shopService";
import { toast } from "sonner";
import { createLogger } from '@/utils/logger';

const logger = createLogger('useShops');

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
      customerNumber?: string;
      businessName: string;
      addressLine1?: string;
      addressLine2?: string;
      addressLine3?: string;
      addressLine4?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      phone?: string;
      tollFree?: string;
      fax?: string;
      email?: string;
      website?: string;
      contact?: string;
      paymentTerms?: string;
      ilsCode?: string;
    }) => shopService.addShop(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Vendor added successfully");
    },
    onError: (error, variables) => {
      logger.error('Add vendor error', error as Error, {
        businessName: variables.businessName,
        customerNumber: variables.customerNumber
      });
      toast.error("Failed to add vendor");
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
        customerNumber: string;
        businessName: string;
        addressLine1: string;
        addressLine2: string;
        addressLine3: string;
        addressLine4: string;
        city: string;
        state: string;
        zip: string;
        country: string;
        phone: string;
        tollFree: string;
        fax: string;
        email: string;
        website: string;
        contact: string;
        paymentTerms: string;
        ilsCode: string;
      };
    }) => shopService.updateShop(rowIndex, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Vendor updated successfully");
    },
    onError: (error, variables) => {
      logger.error('Update vendor error', error as Error, {
        rowIndex: variables.rowIndex,
        businessName: variables.data.businessName
      });
      toast.error("Failed to update vendor");
    },
  });
}

export function useDeleteShop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowIndex: number) => shopService.deleteShop(rowIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Vendor deleted successfully");
    },
    onError: (error, variables) => {
      logger.error('Delete vendor error', error as Error, {
        rowIndex: variables
      });
      toast.error("Failed to delete vendor");
    },
  });
}
