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

// Updated schema mappings to use actual Excel table name
export const tableSchemas: Record<string, Partial<TableSchema>> = {
  InventoryIndexTable: {
    tableName: 'InventoryIndexTable',
    displayName: 'Inventory Index',
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
