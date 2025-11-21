/**
 * Test Data Factories
 *
 * Provides factory functions to generate realistic test data for integration tests.
 * Follows the Factory pattern to create consistent, randomizable test data.
 */

import type { RepairOrder, Shop, StatusHistoryEntry, InventoryItem } from '../types';

/**
 * Generate a unique ID for test data
 */
let sequenceId = 1;
const generateId = () => `test-${sequenceId++}`;

/**
 * Reset sequence (useful between tests)
 */
export const resetSequence = () => {
  sequenceId = 1;
};

/**
 * Factory for creating RepairOrder test data
 */
export const createRepairOrder = (overrides?: Partial<RepairOrder>): RepairOrder => {
  const id = generateId();
  const baseDate = new Date('2024-01-15');

  return {
    id: `row-${id}`,
    roNumber: `RO-${id.padStart(5, '0')}`,
    dateMade: baseDate,
    shopName: 'Duncan Aviation',
    partNumber: `PN-${id}`,
    serialNumber: `SN-${id}`,
    partDescription: 'Hydraulic Pump Assembly',
    requiredWork: 'Overhaul and test per OEM specs',
    dateDroppedOff: new Date(baseDate.getTime() + 86400000), // +1 day
    estimatedCost: 5000,
    finalCost: null,
    terms: 'NET 30',
    shopReferenceNumber: `SHOP-REF-${id}`,
    estimatedDeliveryDate: new Date(baseDate.getTime() + 30 * 86400000), // +30 days
    currentStatus: 'WAITING QUOTE',
    currentStatusDate: new Date(baseDate.getTime() + 86400000),
    genThrustStatus: 'Active',
    shopStatus: '',
    trackingNumber: '',
    notes: '',
    lastDateUpdated: new Date(baseDate.getTime() + 86400000),
    nextDateToUpdate: new Date(baseDate.getTime() + 14 * 86400000), // +14 days
    statusHistory: [
      {
        status: 'TO SEND',
        date: baseDate,
        user: 'test@genthrust.net',
        notes: 'Initial creation'
      }
    ],
    archiveStatus: 'ACTIVE', // Phase 2: Default to ACTIVE
    isOverdue: false,
    daysOverdue: 0,
    ...overrides
  };
};

/**
 * Factory for creating Shop test data
 */
export const createShop = (overrides?: Partial<Shop>): Shop => {
  const id = generateId();

  return {
    id: `shop-${id}`,
    customerNumber: `CUST-${id.padStart(5, '0')}`,
    businessName: `Test Shop ${id}`,
    shopName: `Test Shop ${id}`,
    addressLine1: `${id} Aviation Way`,
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    country: 'USA',
    phone: '555-0100',
    tollFree: '800-555-0100',
    fax: '555-0101',
    email: `shop${id}@example.com`,
    website: `www.shop${id}.com`,
    contact: 'John Doe',
    contactName: 'John Doe',
    paymentTerms: 'NET 30',
    defaultTerms: 'NET 30',
    ilsCode: `ILS-${id}`,
    lastSaleDate: new Date('2024-01-01'),
    ytdSales: 50000,
    ...overrides
  };
};

/**
 * Factory for creating StatusHistoryEntry test data
 */
export const createStatusHistory = (overrides?: Partial<StatusHistoryEntry>): StatusHistoryEntry => {
  return {
    status: 'WAITING QUOTE',
    date: new Date('2024-01-15'),
    user: 'test@genthrust.net',
    notes: 'Status update',
    ...overrides
  };
};

/**
 * Factory for creating InventoryItem test data
 */
export const createInventoryItem = (overrides?: Partial<InventoryItem>): InventoryItem => {
  const id = generateId();

  return {
    indexId: parseInt(id.replace('test-', '')),
    partNumber: `PN-${id}`,
    tableName: 'stock_room',
    rowId: parseInt(id.replace('test-', '')),
    serialNumber: `SN-${id}`,
    qty: 1,
    condition: 'OH',
    location: `BIN-A${id}`,
    description: 'Test part description',
    lastSeen: new Date('2024-01-01'),
    ...overrides
  };
};

/**
 * Create multiple repair orders at once
 */
export const createRepairOrders = (count: number, overrides?: Partial<RepairOrder>): RepairOrder[] => {
  return Array.from({ length: count }, () => createRepairOrder(overrides));
};

/**
 * Create multiple shops at once
 */
export const createShops = (count: number, overrides?: Partial<Shop>): Shop[] => {
  return Array.from({ length: count }, () => createShop(overrides));
};

/**
 * Create multiple inventory items at once
 */
export const createInventoryItems = (count: number, overrides?: Partial<InventoryItem>): InventoryItem[] => {
  return Array.from({ length: count }, () => createInventoryItem(overrides));
};

/**
 * Create a repair order in specific status
 */
export const createROInStatus = (status: string): RepairOrder => {
  const baseRO = createRepairOrder({ currentStatus: status });

  // Adjust fields based on status
  switch (status) {
    case 'TO SEND':
      return { ...baseRO, dateDroppedOff: null, estimatedCost: null };
    case 'WAITING QUOTE':
      return { ...baseRO, estimatedCost: null };
    case 'APPROVED':
      return { ...baseRO, estimatedCost: 5000 };
    case 'BEING REPAIRED':
      return { ...baseRO, estimatedCost: 5000, currentStatusDate: new Date() };
    case 'RECEIVED':
      return { ...baseRO, finalCost: 5200 };
    case 'PAID':
      return { ...baseRO, finalCost: 5200 };
    default:
      return baseRO;
  }
};

/**
 * Create an overdue repair order
 */
export const createOverdueRO = (): RepairOrder => {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10); // 10 days ago

  return createRepairOrder({
    nextDateToUpdate: pastDate,
    isOverdue: true,
    daysOverdue: 10
  });
};

/**
 * Create Graph API table row response
 */
export const createGraphTableRow = (ro: RepairOrder) => {
  return {
    index: parseInt(ro.id.replace('row-', '')),
    values: [[
      ro.roNumber,                      // 0
      ro.dateMade?.getTime(),           // 1
      ro.shopName,                      // 2
      ro.partNumber,                    // 3
      ro.serialNumber,                  // 4
      ro.partDescription,               // 5
      ro.requiredWork,                  // 6
      ro.dateDroppedOff?.getTime(),     // 7
      ro.estimatedCost,                 // 8
      ro.finalCost,                     // 9
      ro.terms,                         // 10
      ro.shopReferenceNumber,           // 11
      ro.estimatedDeliveryDate?.getTime(), // 12
      ro.currentStatus,                 // 13
      ro.currentStatusDate?.getTime(),  // 14
      ro.genThrustStatus,               // 15
      ro.shopStatus,                    // 16
      ro.trackingNumber,                // 17
      ro.notes,                         // 18
      ro.lastDateUpdated?.getTime(),    // 19
      ro.nextDateToUpdate?.getTime(),   // 20
      ro.archiveStatus,                 // 21 - Phase 2: Archive Status
    ]]
  };
};

/**
 * Create Graph API table rows response
 */
export const createGraphTableRowsResponse = (ros: RepairOrder[]) => {
  return {
    value: ros.map(createGraphTableRow)
  };
};

/**
 * Create Graph API session response
 */
export const createGraphSessionResponse = () => {
  return {
    id: `session-${generateId()}`,
    persistChanges: true
  };
};

/**
 * Create Graph API file response
 */
export const createGraphFileResponse = (fileName: string, fileId?: string) => {
  return {
    id: fileId || `file-${generateId()}`,
    name: fileName,
    webUrl: `https://sharepoint.com/sites/test/${fileName}`,
    '@microsoft.graph.downloadUrl': `https://download.sharepoint.com/${fileName}`
  };
};

/**
 * Create Graph API site response
 */
export const createGraphSiteResponse = () => {
  return {
    id: 'site-123',
    displayName: 'Test Site',
    webUrl: 'https://sharepoint.com/sites/test'
  };
};

/**
 * Create Graph API drive response
 */
export const createGraphDriveResponse = () => {
  return {
    id: 'drive-123',
    name: 'Documents',
    driveType: 'documentLibrary'
  };
};
