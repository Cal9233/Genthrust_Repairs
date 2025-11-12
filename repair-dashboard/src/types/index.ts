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
  totalEstimatedValue: number;
  totalFinalValue: number;
  dueToday: number;
  overdue30Plus: number;
  onTrack: number;
}

export interface Shop {
  id: string; // Generated from row index
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
  lastSaleDate: Date | null;
  ytdSales: number | null;

  // Computed/legacy fields for backward compatibility
  shopName: string; // alias for businessName
  contactName: string; // alias for contact
  defaultTerms: string; // alias for paymentTerms
}

export interface Attachment {
  id: string; // SharePoint/OneDrive file ID
  name: string; // File name
  size: number; // File size in bytes
  mimeType: string; // File MIME type
  webUrl: string; // URL to open in browser
  downloadUrl: string; // Direct download URL
  createdDateTime: Date; // When uploaded
  createdBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
  lastModifiedDateTime: Date;
  lastModifiedBy: {
    user: {
      displayName: string;
      email: string;
    };
  };
}

export interface AttachmentUploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error';
  error?: string;
}
