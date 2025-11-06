export interface RepairOrder {
  id: string; // Generated from row index
  roNumber: string;
  dateMade: Date | null;
  shopName: string;
  partNumber: string;
  serialNumber: string;
  partDescription: string;
  requiredWork: string;
  dateDroppedOff: Date | null;
  estimatedCost: number | null;
  finalCost: number | null;
  terms: string;
  shopReferenceNumber: string;
  estimatedDeliveryDate: Date | null;
  currentStatus: string;
  currentStatusDate: Date | null;
  genThrustStatus: string;
  shopStatus: string;
  trackingNumber: string;
  notes: string;
  lastDateUpdated: Date | null;
  nextDateToUpdate: Date | null;
  checked: string;

  // Computed
  daysOverdue: number;
  isOverdue: boolean;
}

export interface DashboardStats {
  totalActive: number;
  overdue: number;
  waitingQuote: number;
  approved: number;
  beingRepaired: number;
  shipping: number;
  totalValue: number;
}
