export interface StatusHistoryEntry {
  status: string;
  date: Date;
  user: string; // from Azure AD auth
  cost?: number; // if quote received
  notes?: string;
  deliveryDate?: Date; // if approved
}

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
  statusHistory: StatusHistoryEntry[];

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
  dueToday: number;
  overdue30Plus: number;
  onTrack: number;
}

export interface Shop {
  id: string; // Generated from row index
  shopName: string;
  contactName: string;
  email: string;
  phone: string;
  defaultTerms: string; // "COD", "NET 30", etc.
  typicalTAT: number; // days
  notes: string;
  active: boolean;
}
