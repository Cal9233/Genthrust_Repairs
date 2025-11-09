import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shopService } from "../lib/shopService";
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
    onError: (error) => {
      console.error("Add vendor error:", error);
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
    onError: (error) => {
      console.error("Update vendor error:", error);
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
    onError: (error) => {
      console.error("Delete vendor error:", error);
      toast.error("Failed to delete vendor");
    },
  });
}
