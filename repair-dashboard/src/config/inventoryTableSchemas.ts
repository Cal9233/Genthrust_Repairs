/**
 * Inventory Table Schemas
 * Maps column indices for each inventory table
 *
 * NOTE: These are best-guess mappings based on common patterns.
 * The buildInventoryIndex.js script will auto-detect actual column indices.
 */

export interface TableSchema {
  tableName: string;
  displayName: string;
  indices: {
    partNumber: number | null;
    serial: number | null;
    qty: number | null;
    condition: number | null;
    location: number | null;
    description: number | null;
  };
}

// Best-guess schema mappings (will be auto-detected by index builder)
export const tableSchemas: Record<string, Partial<TableSchema>> = {
  BinsInventoryTable: {
    tableName: 'BinsInventoryTable',
    displayName: 'Bins Inventory',
  },

  StockRoomInventoryTable: {
    tableName: 'StockRoomInventoryTable',
    displayName: 'Stock Room',
  },

  MD82PartsTable: {
    tableName: 'MD82PartsTable',
    displayName: 'MD82 Parts',
  },

  Inventory_727PartsTable: {
    tableName: 'Inventory_727PartsTable',
    displayName: '727 Parts',
  },

  TERRAInventoryTable: {
    tableName: 'TERRAInventoryTable',
    displayName: 'TERRA',
  },

  BER_RAI_Table: {
    tableName: 'BER_RAI_Table',
    displayName: 'BER/RAI',
  },

  ASIS_AR_PARTS_Table: {
    tableName: 'ASIS_AR_PARTS_Table',
    displayName: 'ASIS AR Parts',
  },

  PARTS_AR_ASIA_SANFORD_Table: {
    tableName: 'PARTS_AR_ASIA_SANFORD_Table',
    displayName: 'AR Asia Sanford',
  },

  BOLIVIA_PART_TABLE: {
    tableName: 'BOLIVIA_PART_TABLE',
    displayName: 'Bolivia Parts',
  },

  DELTA_APA_TABLE: {
    tableName: 'DELTA_APA_TABLE',
    displayName: 'Delta APA',
  },

  APA_SANFORD_757_TABLE: {
    tableName: 'APA_SANFORD_757_TABLE',
    displayName: 'APA Sanford 757',
  },
};

/**
 * Get display name for a table
 */
export function getTableDisplayName(tableName: string): string {
  return tableSchemas[tableName]?.displayName || tableName;
}

/**
 * All inventory table names (excluding index and transactions tables)
 */
export const INVENTORY_TABLE_NAMES = Object.keys(tableSchemas);
