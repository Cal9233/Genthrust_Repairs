import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "../lib/msalConfig";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const WORKBOOK_ID = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;
const INDEX_TABLE = 'InventoryIndexTable';
const TRANSACTIONS_TABLE = 'InventoryTransactionsTable';
const LOW_STOCK_THRESHOLD = 2;

export interface InventorySearchResult {
  indexId: string;
  partNumber: string;
  tableName: string;
  rowId: string;
  serialNumber: string;
  qty: number;
  condition: string;
  location: string;
  description: string;
  lastSeen: string;
}

export interface InventoryDecrementResult {
  success: boolean;
  newQty: number;
  isLowStock: boolean;
  message: string;
}

export interface InventoryTransaction {
  transactionId: string;
  timestamp: string;
  action: 'DECREMENT' | 'INCREMENT' | 'ADJUST';
  partNumber: string;
  tableName: string;
  rowId: string;
  delta: number;
  oldQty: number;
  newQty: number;
  roNumber?: string;
  user: string;
  notes?: string;
}

class InventoryService {
  private msalInstance: IPublicClientApplication | null = null;
  private driveId: string | null = null;
  private sessionId: string | null = null;

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
  }

  private getCurrentUser(): string {
    if (!this.msalInstance) {
      return "Unknown User";
    }

    let account = this.msalInstance.getActiveAccount();
    if (!account) {
      const accounts = this.msalInstance.getAllAccounts();
      account = accounts[0];
    }

    if (!account) {
      return "Unknown User";
    }

    return account.name || account.username || "Unknown User";
  }

  private async getAccessToken(): Promise<string> {
    if (!this.msalInstance) {
      throw new Error("MSAL instance not set");
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error("No active account");
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    } catch (silentError) {
      console.log("[Inventory Service] Silent token acquisition failed, using popup");
      const response = await this.msalInstance.acquireTokenPopup({
        ...loginRequest,
        account,
      });
      return response.accessToken;
    }
  }

  private async callGraphAPI(endpoint: string, method = "GET", body?: any) {
    const token = await this.getAccessToken();

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Inventory Service] ${method} ${endpoint} failed:`, errorText);
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getDriveId(): Promise<string> {
    if (this.driveId) {
      return this.driveId;
    }

    const url = new URL(SITE_URL);
    const hostname = url.hostname;
    const sitePath = url.pathname;

    // Get site ID
    const siteResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
    );

    // Get drive ID
    const driveResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    this.driveId = driveResponse.id;
    return driveResponse.id;
  }

  /**
   * Normalize part number for consistent searching
   * - Convert to uppercase
   * - Remove whitespace only (spaces, tabs, newlines)
   * - KEEP dashes and hyphens (they indicate part variants!)
   */
  private normalizePartNumber(partNumber: string): string {
    return partNumber
      .toUpperCase()
      .replace(/\s+/g, '') // Remove whitespace only, NOT dashes
      .trim();
  }

  /**
   * Search inventory by part number
   * Returns all matching entries across all inventory tables
   */
  async searchInventory(partNumber: string): Promise<InventorySearchResult[]> {
    if (!partNumber || partNumber.trim() === '') {
      return [];
    }

    console.log(`[Inventory Service] Searching for part: ${partNumber}`);

    const driveId = await this.getDriveId();
    const normalizedPN = this.normalizePartNumber(partNumber);

    // Get all rows from index table
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows`
    );

    const rows = response.value || [];
    const results: InventorySearchResult[] = [];

    // Filter rows where normalized part number matches
    for (const row of rows) {
      const values = row.values[0];
      const indexedPN = String(values[1] || ''); // PartNumber is column index 1

      if (indexedPN === normalizedPN) {
        results.push({
          indexId: String(values[0] || ''),
          partNumber: indexedPN,
          tableName: String(values[2] || ''),
          rowId: String(values[3] || ''),
          serialNumber: String(values[4] || ''),
          qty: Number(values[5]) || 0,
          condition: String(values[6] || ''),
          location: String(values[7] || ''),
          description: String(values[8] || ''),
          lastSeen: String(values[9] || ''),
        });
      }
    }

    console.log(`[Inventory Service] Found ${results.length} matches for ${partNumber}`);
    return results;
  }

  /**
   * Get full details for a specific inventory item from its source table
   */
  async getInventoryDetails(tableName: string, rowId: string): Promise<any> {
    console.log(`[Inventory Service] Getting details from ${tableName}, row ${rowId}`);

    const driveId = await this.getDriveId();

    // Get the specific row from the source table
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/rows/itemAt(index=${rowId})`
    );

    return response.values[0];
  }

  /**
   * Get column headers for a specific inventory table
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    const driveId = await this.getDriveId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/columns`
    );

    return response.value.map((col: any) => col.name);
  }

  /**
   * Create a workbook session for batch operations
   */
  private async createSession(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId;
    }

    const driveId = await this.getDriveId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/createSession`,
      "POST",
      { persistChanges: true }
    );

    this.sessionId = response.id;
    return response.id;
  }

  /**
   * Close the workbook session
   */
  private async closeSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      const driveId = await this.getDriveId();
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/closeSession`,
        "POST",
        {}
      );
      this.sessionId = null;
    } catch (error) {
      console.error("[Inventory Service] Failed to close session:", error);
      this.sessionId = null;
    }
  }

  /**
   * Log an inventory transaction to InventoryTransactionsTable
   */
  async logInventoryTransaction(transaction: Omit<InventoryTransaction, 'transactionId' | 'timestamp' | 'user'>): Promise<void> {
    console.log("[Inventory Service] Logging transaction:", transaction);

    const driveId = await this.getDriveId();
    const user = this.getCurrentUser();
    const timestamp = new Date().toISOString();
    const transactionId = crypto.randomUUID();

    const row = [
      transactionId,
      timestamp,
      transaction.action,
      transaction.partNumber,
      transaction.tableName,
      String(transaction.rowId),
      transaction.delta,
      transaction.oldQty,
      transaction.newQty,
      transaction.roNumber || '',
      user,
      transaction.notes || '',
    ];

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${TRANSACTIONS_TABLE}/rows/add`,
      "POST",
      { values: [row] }
    );

    console.log("[Inventory Service] Transaction logged successfully");
  }

  /**
   * Decrement inventory quantity
   * - Updates source table
   * - Updates index table
   * - Logs transaction
   */
  async decrementInventory(
    indexId: string,
    partNumber: string,
    tableName: string,
    rowId: string,
    roNumber?: string,
    notes?: string
  ): Promise<InventoryDecrementResult> {
    console.log(`[Inventory Service] Decrementing inventory: ${partNumber} in ${tableName}`);

    const driveId = await this.getDriveId();

    try {
      // Create session for atomic operations
      await this.createSession();

      // Get current row from source table
      const rowResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/rows/itemAt(index=${rowId})`
      );

      const rowValues = rowResponse.values[0];

      // Get column headers to find qty column
      const columnsResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/columns`
      );

      const headers = columnsResponse.value.map((col: any) => col.name);

      // Find qty column (use same detection as index builder)
      const qtyIndex = headers.findIndex((h: string) => {
        if (!h) return false;
        const header = String(h).toUpperCase();
        return header.includes('QTY') || header.includes('QUANTITY');
      });

      if (qtyIndex === -1) {
        throw new Error(`Could not find quantity column in table ${tableName}`);
      }

      const currentQty = Number(rowValues[qtyIndex]) || 0;

      if (currentQty < 1) {
        return {
          success: false,
          newQty: currentQty,
          isLowStock: true,
          message: "Insufficient quantity - cannot decrement below 0",
        };
      }

      const newQty = currentQty - 1;

      // Update source table
      rowValues[qtyIndex] = newQty;

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${tableName}/rows/itemAt(index=${rowId})`,
        "PATCH",
        { values: [rowValues] }
      );

      // Update index table
      const indexResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows`
      );

      const indexRows = indexResponse.value || [];
      const indexRow = indexRows.find((row: any) => row.values[0][0] === indexId);

      if (indexRow) {
        const indexValues = indexRow.values[0];
        indexValues[5] = newQty; // Qty is column index 5

        await this.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${WORKBOOK_ID}/workbook/tables/${INDEX_TABLE}/rows/itemAt(index=${indexRow.index})`,
          "PATCH",
          { values: [indexValues] }
        );
      }

      // Log transaction
      await this.logInventoryTransaction({
        action: 'DECREMENT',
        partNumber,
        tableName,
        rowId,
        delta: -1,
        oldQty: currentQty,
        newQty,
        roNumber,
        notes,
      });

      // Close session
      await this.closeSession();

      const isLowStock = newQty < LOW_STOCK_THRESHOLD;

      return {
        success: true,
        newQty,
        isLowStock,
        message: isLowStock
          ? `✅ Decremented to ${newQty} - LOW STOCK WARNING!`
          : `✅ Decremented to ${newQty}`,
      };

    } catch (error) {
      // Try to close session on error
      await this.closeSession();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("[Inventory Service] Decrement failed:", errorMessage);

      throw new Error(`Failed to decrement inventory: ${errorMessage}`);
    }
  }
}

export const inventoryService = new InventoryService();
