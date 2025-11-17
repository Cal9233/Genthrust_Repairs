import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { RepairOrder, StatusHistoryEntry } from "../types";
import type {
  GraphAPIResponse,
  GraphSiteResponse,
  GraphDriveResponse,
  GraphFileResponse,
  GraphTableRowResponse,
  GraphAPIException,
  GraphSessionResponse,
  isGraphAPIError
} from "../types/graphApi";
import { calculateNextUpdateDate } from "./businessRules";
import { reminderService, ReminderService } from "./reminderService";
import { ExcelSessionManager } from "./excelSession";
import { createLogger } from "../utils/logger";

const logger = createLogger('ExcelService');

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;
const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

class ExcelService {
  private msalInstance: IPublicClientApplication | null = null;
  private driveId: string | null = null;
  private fileId: string | null = null;
  private sessionManager: ExcelSessionManager | null = null;

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
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
      // Silent token acquisition failed, using popup
      try {
        const response = await this.msalInstance.acquireTokenPopup({
          ...loginRequest,
        });
        return response.accessToken;
      } catch (popupError) {
        // Popup token acquisition failed
        // If popup fails due to CORS/COOP, try redirect
        const errorMessage = popupError instanceof Error ? popupError.message : String(popupError);
        if (errorMessage.includes("popup") || errorMessage.includes("CORS")) {
          // Using redirect flow
          await this.msalInstance.acquireTokenRedirect({
            ...loginRequest,
            account,
          });
          throw new Error("Redirecting for authentication...");
        }
        throw popupError;
      }
    }
  }

  /**
   * Call Microsoft Graph API with proper error handling and type safety
   *
   * @template T - The expected response type (defaults to unknown)
   * @param endpoint - The Graph API endpoint URL
   * @param method - HTTP method (GET, POST, PATCH, DELETE)
   * @param body - Request body for POST/PATCH requests
   * @param sessionId - Optional Excel workbook session ID
   * @returns The parsed JSON response, or null for empty responses
   * @throws {GraphAPIException} For HTTP errors from the Graph API
   */
  private async callGraphAPI<T = unknown>(
    endpoint: string,
    method = "GET",
    body?: unknown,
    sessionId?: string
  ): Promise<T | null> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Add session header if sessionId provided
    if (sessionId) {
      headers["workbook-session-id"] = sessionId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      // Create properly typed GraphAPIException
      throw new GraphAPIException(
        response.status,
        `Graph API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorDetails, null, 2)}`,
        isGraphAPIError(errorDetails) ? errorDetails : errorText
      );
    }

    // Handle empty responses (like 204 No Content from closeSession)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    // Check if response has content before parsing JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Get or create session manager instance
   */
  private async getSessionManager(): Promise<ExcelSessionManager> {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    // Ensure we have driveId and fileId
    if (!this.fileId) {
      await this.getFileId();
    }

    // Create session manager with bound callGraphAPI
    this.sessionManager = new ExcelSessionManager(
      this.driveId!,
      this.fileId!,
      this.callGraphAPI.bind(this),
      {
        maxRetries: 3,
        retryDelayMs: 1000,
        sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
        persistChanges: true,
      }
    );

    logger.debug('Session manager created', {
      driveId: this.driveId,
      fileId: this.fileId,
    });

    return this.sessionManager;
  }

  private parseExcelDate(value: any): Date | null {
    if (!value) return null;

    // Excel serial date
    if (typeof value === "number") {
      const date = new Date((value - 25569) * 86400 * 1000);
      return date;
    }

    // ISO string
    if (typeof value === "string") {
      return new Date(value);
    }

    return null;
  }

  private parseCurrency(value: any): number | null {
    if (!value) return null;

    if (typeof value === "number") return value;

    if (typeof value === "string") {
      const cleaned = value.replace(/[$,]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  /**
   * Parse notes field containing embedded status history
   *
   * @param notesValue - The notes field value from Excel
   * @returns Parsed notes and status history array
   */
  private parseNotesWithHistory(notesValue: string): { notes: string; statusHistory: StatusHistoryEntry[] } {
    if (!notesValue || typeof notesValue !== "string") {
      return { notes: "", statusHistory: [] };
    }

    // Format: "HISTORY:[json]|NOTES:user notes here"
    const historyMatch = notesValue.match(/HISTORY:(\[.*?\])\|NOTES:(.*)/s);

    if (historyMatch) {
      try {
        const historyJson = historyMatch[1];
        const userNotes = historyMatch[2] || "";
        const historyData = JSON.parse(historyJson) as unknown[];

        // Type guard for status history entries
        const isStatusHistoryEntry = (entry: unknown): entry is Partial<StatusHistoryEntry> => {
          return (
            typeof entry === 'object' &&
            entry !== null &&
            'status' in entry &&
            'date' in entry &&
            'user' in entry
          );
        };

        // Convert date strings back to Date objects with proper typing
        const statusHistory: StatusHistoryEntry[] = historyData
          .filter(isStatusHistoryEntry)
          .map((entry): StatusHistoryEntry => ({
            status: entry.status || '',
            date: entry.date ? new Date(entry.date) : new Date(),
            user: entry.user || 'Unknown',
            ...(entry.cost !== undefined && { cost: entry.cost }),
            ...(entry.notes && { notes: entry.notes }),
            ...(entry.deliveryDate && { deliveryDate: new Date(entry.deliveryDate) }),
          }));

        return { notes: userNotes, statusHistory };
      } catch (error) {
        // Failed to parse status history - returning notes only
        logger.warn('Failed to parse status history from notes', error);
        return { notes: notesValue, statusHistory: [] };
      }
    }

    // No history found, treat entire value as notes
    return { notes: notesValue, statusHistory: [] };
  }

  private serializeNotesWithHistory(notes: string, statusHistory: StatusHistoryEntry[]): string {
    if (!statusHistory || statusHistory.length === 0) {
      return notes;
    }

    // Keep last 20 entries to avoid data bloat
    const limitedHistory = statusHistory.slice(-20);

    // Format dates to MM/DD/YY before serializing
    const formattedHistory = limitedHistory.map(entry => ({
      ...entry,
      date: entry.date instanceof Date
        ? `${entry.date.getMonth() + 1}/${entry.date.getDate()}/${entry.date.getFullYear().toString().slice(-2)}`
        : entry.date,
      deliveryDate: entry.deliveryDate instanceof Date
        ? `${entry.deliveryDate.getMonth() + 1}/${entry.deliveryDate.getDate()}/${entry.deliveryDate.getFullYear().toString().slice(-2)}`
        : entry.deliveryDate
    }));

    const historyJson = JSON.stringify(formattedHistory);
    return `HISTORY:${historyJson}|NOTES:${notes}`;
  }

  private getCurrentUser(): string {
    if (!this.msalInstance) {
      // MSAL instance not available
      return "Unknown User";
    }

    // Try active account first
    let account = this.msalInstance.getActiveAccount();

    // If no active account, try getting all accounts
    if (!account) {
      const accounts = this.msalInstance.getAllAccounts();
      account = accounts[0];
    }

    if (!account) {
      // No account found
      return "Unknown User";
    }

    // Return the best available identifier
    const userName = account.name || account.username || account.idTokenClaims?.preferred_username || "Unknown User";
    return userName;
  }

  /**
   * Get the Excel file ID from SharePoint
   *
   * @returns The file ID
   * @throws {Error} If the file is not found
   */
  async getFileId(): Promise<string> {
    // Return cached file ID if available
    if (this.fileId) {
      return this.fileId;
    }

    // Get site drive
    const siteUrl = new URL(SITE_URL);
    const hostname = siteUrl.hostname;
    const sitePath = siteUrl.pathname;

    const siteResponse = await this.callGraphAPI<GraphSiteResponse>(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
    );

    if (!siteResponse) {
      throw new Error('Failed to get SharePoint site information');
    }

    // Get drive
    const driveResponse = await this.callGraphAPI<GraphDriveResponse>(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    if (!driveResponse) {
      throw new Error('Failed to get SharePoint drive information');
    }

    // Cache the drive ID for later use
    this.driveId = driveResponse.id;

    // Search for file
    const searchResponse = await this.callGraphAPI<GraphAPIResponse<GraphFileResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${FILE_NAME}')`
    );

    if (!searchResponse || searchResponse.value.length === 0) {
      throw new Error(`File ${FILE_NAME} not found`);
    }

    // Cache the file ID for later use
    this.fileId = searchResponse.value[0].id;

    return this.fileId!;
  }

  async getFileInfo(): Promise<any> {
    const fileId = await this.getFileId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}`
    );

    return response;
  }

  async listTables(): Promise<any[]> {
    const fileId = await this.getFileId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables`
    );

    return response.value;
  }

  /**
   * Search for a file by name in the SharePoint drive
   */
  async searchForFile(fileName: string): Promise<{ id: string; name: string; webUrl: string } | null> {
    try {
      // Ensure we have a drive ID
      if (!this.driveId) {
        await this.getFileId(); // This will set this.driveId
      }

      const searchResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${fileName}')`
      );

      if (searchResponse.value.length === 0) {
        // File not found
        return null;
      }

      const file = searchResponse.value[0];
      return {
        id: file.id,
        name: file.name,
        webUrl: file.webUrl
      };
    } catch (error) {
      // Error searching for file
      return null;
    }
  }

  /**
   * Get inventory file info directly using VITE_INVENTORY_WORKBOOK_ID
   * No searching needed - we already know the file ID
   */
  async getInventoryFileInfo(): Promise<{ id: string; name: string; webUrl: string } | null> {
    try {
      const INVENTORY_WORKBOOK_ID = import.meta.env.VITE_INVENTORY_WORKBOOK_ID;

      if (!INVENTORY_WORKBOOK_ID) {
        // VITE_INVENTORY_WORKBOOK_ID not set in environment
        return null;
      }

      // Ensure we have a drive ID
      if (!this.driveId) {
        await this.getFileId(); // This will set this.driveId
      }

      // Fetch file info directly by ID
      const fileInfo = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${INVENTORY_WORKBOOK_ID}`
      );

      return {
        id: fileInfo.id,
        name: fileInfo.name,
        webUrl: fileInfo.webUrl
      };
    } catch (error) {
      // Error fetching inventory file info
      return null;
    }
  }

  /**
   * DEBUG ONLY: List all worksheets and tables for a specific file
   * COMMENTED OUT to prevent console spam - uncomment only for troubleshooting
   */
  /*
  async listFileStructure(fileId: string, fileName: string): Promise<void> {
    try {
      const worksheetsResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets`
      );

      console.log("========================================");
      console.log(`[Excel Service] WORKBOOK STRUCTURE: ${fileName}`);
      console.log("========================================");
      console.log(`Total Worksheets: ${worksheetsResponse.value.length}`);
      console.log("");

      for (const worksheet of worksheetsResponse.value) {
        console.log(`📄 WORKSHEET: "${worksheet.name}"`);
        console.log(`   - Position: ${worksheet.position}`);
        console.log(`   - Visibility: ${worksheet.visibility}`);

        try {
          const tablesResponse = await this.callGraphAPI(
            `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/${worksheet.name}/tables`
          );

          if (tablesResponse.value.length > 0) {
            console.log(`   - Tables (${tablesResponse.value.length}):`);
            for (const table of tablesResponse.value) {
              console.log(`     📊 TABLE: "${table.name}"`);
              try {
                const columnsResponse = await this.callGraphAPI(
                  `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${table.name}/columns`
                );
                console.log(`        - Row Count: ${table.rowCount || 'Unknown'}`);
                console.log(`        - Columns (${columnsResponse.value.length}):`);
                columnsResponse.value.forEach((col: any, idx: number) => {
                  console.log(`          [${idx}] ${col.name}`);
                });
              } catch (error) {
                console.log(`        - Could not fetch columns: ${error}`);
              }
            }
          } else {
            console.log(`   - No tables in this worksheet`);
          }
        } catch (error) {
          console.log(`   - Error fetching tables: ${error}`);
        }
        console.log("");
      }
      console.log("========================================");
    } catch (error) {
      console.error(`[Excel Service] Error listing file structure:`, error);
    }
  }
  */

  /**
   * DEBUG ONLY: List all worksheets and tables
   * COMMENTED OUT to prevent console spam - uncomment only for troubleshooting
   */
  /*
  async listAllWorksheetsAndTables(): Promise<void> {
    const fileId = await this.getFileId();
    const worksheetsResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets`
    );

    console.log("========================================");
    console.log("[Excel Service] WORKBOOK STRUCTURE");
    console.log("========================================");
    console.log(`Total Worksheets: ${worksheetsResponse.value.length}`);
    console.log("");

    for (const worksheet of worksheetsResponse.value) {
      console.log(`📄 WORKSHEET: "${worksheet.name}"`);
      console.log(`   - Position: ${worksheet.position}`);
      console.log(`   - Visibility: ${worksheet.visibility}`);

      try {
        const tablesResponse = await this.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/${worksheet.name}/tables`
        );

        if (tablesResponse.value.length > 0) {
          console.log(`   - Tables (${tablesResponse.value.length}):`);
          for (const table of tablesResponse.value) {
            console.log(`     📊 TABLE: "${table.name}"`);
            try {
              const columnsResponse = await this.callGraphAPI(
                `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${table.name}/columns`
              );
              console.log(`        - Row Count: ${table.rowCount || 'Unknown'}`);
              console.log(`        - Columns (${columnsResponse.value.length}):`);
              columnsResponse.value.forEach((col: any, idx: number) => {
                console.log(`          [${idx}] ${col.name}`);
              });
            } catch (error) {
              console.log(`        - Could not fetch columns: ${error}`);
            }
          }
        } else {
          console.log(`   - No tables in this worksheet`);
        }
      } catch (error) {
        console.log(`   - Error fetching tables: ${error}`);
      }
      console.log("");
    }
    console.log("========================================");
  }
  */

  /**
   * Get all repair orders from the main table
   *
   * @returns Array of repair orders with computed fields
   */
  async getRepairOrders(): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    // Debug code removed - was causing console spam on every load
    // Uncomment only for troubleshooting:
    // try {
    //   await this.listAllWorksheetsAndTables();
    // } catch (error) {
    //   // Debug error
    // }

    const response = await this.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`
    );

    if (!response) {
      logger.warn('Empty response when fetching repair orders');
      return [];
    }

    const rows = response.value;

    return rows.map((row, index): RepairOrder => {
      const values = row.values[0]; // First array contains the row data

      const lastUpdated = this.parseExcelDate(values[19]);
      const nextUpdate = this.parseExcelDate(values[20]);
      const today = new Date();

      let daysOverdue = 0;
      let isOverdue = false;

      if (nextUpdate) {
        const diffTime = today.getTime() - nextUpdate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysOverdue > 0;
      }

      // Parse notes and status history
      const { notes, statusHistory } = this.parseNotesWithHistory(
        typeof values[18] === 'string' ? values[18] : ""
      );

      return {
        id: `row-${index}`,
        roNumber: String(values[0] ?? ""),
        dateMade: this.parseExcelDate(values[1]),
        shopName: typeof values[2] === 'string' ? values[2] : "",
        partNumber: typeof values[3] === 'string' ? values[3] : "",
        serialNumber: typeof values[4] === 'string' ? values[4] : "",
        partDescription: typeof values[5] === 'string' ? values[5] : "",
        requiredWork: typeof values[6] === 'string' ? values[6] : "",
        dateDroppedOff: this.parseExcelDate(values[7]),
        estimatedCost: this.parseCurrency(values[8]),
        finalCost: this.parseCurrency(values[9]),
        terms: typeof values[10] === 'string' ? values[10] : "",
        shopReferenceNumber: typeof values[11] === 'string' ? values[11] : "",
        estimatedDeliveryDate: this.parseExcelDate(values[12]),
        currentStatus: typeof values[13] === 'string' ? values[13] : "",
        currentStatusDate: this.parseExcelDate(values[14]),
        genThrustStatus: typeof values[15] === 'string' ? values[15] : "",
        shopStatus: typeof values[16] === 'string' ? values[16] : "",
        trackingNumber: typeof values[17] === 'string' ? values[17] : "",
        notes,
        lastDateUpdated: lastUpdated,
        nextDateToUpdate: nextUpdate,
        checked: typeof values[21] === 'string' ? values[21] : "",
        statusHistory,
        daysOverdue,
        isOverdue,
      };
    });
  }

  /**
   * Get repair orders from a specific sheet and table (e.g., archive sheets)
   *
   * @param sheetName - The worksheet name
   * @param tableName - The table name within the worksheet
   * @returns Array of repair orders
   */
  async getRepairOrdersFromSheet(sheetName: string, tableName: string): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    const response = await this.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/${sheetName}/tables/${tableName}/rows`
    );

    if (!response) {
      logger.warn('Empty response when fetching repair orders from sheet', { sheetName, tableName });
      return [];
    }

    const rows = response.value;

    return rows.map((row, index): RepairOrder => {
      const values = row.values[0]; // First array contains the row data

      const lastUpdated = this.parseExcelDate(values[19]);
      const nextUpdate = this.parseExcelDate(values[20]);
      const today = new Date();

      let daysOverdue = 0;
      let isOverdue = false;

      if (nextUpdate) {
        const diffTime = today.getTime() - nextUpdate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isOverdue = daysOverdue > 0;
      }

      // Parse notes and status history
      const { notes, statusHistory } = this.parseNotesWithHistory(
        typeof values[18] === 'string' ? values[18] : ""
      );

      return {
        id: `row-${index}`,
        roNumber: String(values[0] ?? ""),
        dateMade: this.parseExcelDate(values[1]),
        shopName: typeof values[2] === 'string' ? values[2] : "",
        partNumber: typeof values[3] === 'string' ? values[3] : "",
        serialNumber: typeof values[4] === 'string' ? values[4] : "",
        partDescription: typeof values[5] === 'string' ? values[5] : "",
        requiredWork: typeof values[6] === 'string' ? values[6] : "",
        dateDroppedOff: this.parseExcelDate(values[7]),
        estimatedCost: this.parseCurrency(values[8]),
        finalCost: this.parseCurrency(values[9]),
        terms: typeof values[10] === 'string' ? values[10] : "",
        shopReferenceNumber: typeof values[11] === 'string' ? values[11] : "",
        estimatedDeliveryDate: this.parseExcelDate(values[12]),
        currentStatus: typeof values[13] === 'string' ? values[13] : "",
        currentStatusDate: this.parseExcelDate(values[14]),
        genThrustStatus: typeof values[15] === 'string' ? values[15] : "",
        shopStatus: typeof values[16] === 'string' ? values[16] : "",
        trackingNumber: typeof values[17] === 'string' ? values[17] : "",
        notes,
        lastDateUpdated: lastUpdated,
        nextDateToUpdate: nextUpdate,
        checked: typeof values[21] === 'string' ? values[21] : "",
        statusHistory,
        daysOverdue,
        isOverdue,
      };
    });
  }

  async updateRow(
    rowIndex: number,
    _columnIndex: number,
    value: any
  ): Promise<void> {
    const fileId = await this.getFileId();

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      {
        values: [[value]], // Single cell update
      }
    );
  }

  async updateROStatus(
    rowIndex: number,
    status: string,
    statusNotes?: string,
    cost?: number,
    deliveryDate?: Date,
    trackingNumber?: string
  ): Promise<void> {
    const fileId = await this.getFileId();
    const today = new Date();
    const todayISO = today.toISOString();

    // Get current user
    const currentUser = this.getCurrentUser();

    const sessionManager = await this.getSessionManager();

    await sessionManager.withSession(async (sessionId) => {
      // Get current row data first
      const response = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        sessionId
      );

      const currentValues = response.values[0];

      // Get payment terms from current row (column 10)
      const paymentTerms = currentValues[10] || "";

      // Calculate next update date based on new status and payment terms
      const nextUpdateDate = calculateNextUpdateDate(status, today, paymentTerms);
      const nextUpdateISO = nextUpdateDate ? nextUpdateDate.toISOString() : "";

      // Parse existing notes and history
      const { notes, statusHistory } = this.parseNotesWithHistory(currentValues[18] || "");

      // Create new status history entry
      const newHistoryEntry: StatusHistoryEntry = {
        status,
        date: today,
        user: currentUser,
        ...(cost !== undefined && { cost }),
        ...(statusNotes && { notes: statusNotes }),
        ...(deliveryDate && { deliveryDate }),
      };

      // Append to status history
      const updatedHistory = [...statusHistory, newHistoryEntry];

      // Serialize back to notes field
      const serializedNotes = this.serializeNotesWithHistory(notes, updatedHistory);

      // Update specific columns
      currentValues[13] = status; // Current Status
      currentValues[14] = todayISO; // Status Date
      currentValues[18] = serializedNotes; // Notes with status history
      currentValues[19] = todayISO; // Last Updated
      currentValues[20] = nextUpdateISO; // Next Date to Update (auto-calculated)

      // Update cost columns if provided
      if (cost !== undefined) {
        // Determine which cost column to update based on status
        // For final statuses (PAID, SHIPPING), update Final Cost
        // Otherwise, update Estimated Cost
        const isFinalStatus = status.includes("PAID") || status.includes("SHIPPING");

        if (isFinalStatus) {
          currentValues[9] = cost; // Final Cost (column 9)
        } else {
          currentValues[8] = cost; // Estimated Cost (column 8)
        }
      }

      // Update tracking number if provided
      if (trackingNumber !== undefined) {
        currentValues[17] = trackingNumber; // Tracking Number (column 17)
      }

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [currentValues] },
        sessionId
      );

      // Create payment due calendar event for NET payment terms
      // Do this after the Excel update succeeds
      const isFinalStatus = status.includes("PAID") || status.includes("SHIPPING");
      if (isFinalStatus && cost !== undefined && paymentTerms) {
        const netDays = ReminderService.extractNetDays(paymentTerms);
        if (netDays) {
          // Get RO number from current values (column 0)
          const roNumber = currentValues[0];
          // Get shop name from current values (column 2)
          const shopName = currentValues[2];

          // Create calendar event asynchronously (don't block on failure)
          reminderService.createPaymentDueCalendarEvent({
            roNumber,
            shopName,
            invoiceDate: today,
            amount: cost,
            netDays
          }).catch(() => {
            // Failed to create payment due calendar event - non-critical error
            // Don't throw - we don't want to fail the whole update if calendar creation fails
          });
        }
      }
    });
  }

  async addRepairOrder(data: {
    roNumber: string;
    shopName: string;
    partNumber: string;
    serialNumber: string;
    partDescription: string;
    requiredWork: string;
    estimatedCost?: number;
    terms?: string;
    shopReferenceNumber?: string;
  }): Promise<void> {
    const fileId = await this.getFileId();
    const today = new Date();
    const todayISO = today.toISOString();

    // Calculate next update date based on initial status and payment terms
    const initialStatus = "TO SEND";
    const nextUpdateDate = calculateNextUpdateDate(initialStatus, today, data.terms);
    const nextUpdateISO = nextUpdateDate ? nextUpdateDate.toISOString() : "";

    // Get current user
    const currentUser = this.getCurrentUser();

    // Initialize status history with first entry
    const initialHistory: StatusHistoryEntry[] = [{
      status: initialStatus,
      date: today,
      user: currentUser,
      notes: "Repair order created",
    }];

    const serializedNotes = this.serializeNotesWithHistory("", initialHistory);

    const sessionManager = await this.getSessionManager();

    await sessionManager.withSession(async (sessionId) => {
      // Create row with all columns (22 columns total based on RepairOrder type)
      const newRow = [
        data.roNumber, // 0: RO Number
        todayISO, // 1: Date Made
        data.shopName, // 2: Shop Name
        data.partNumber, // 3: Part Number
        data.serialNumber, // 4: Serial Number
        data.partDescription, // 5: Part Description
        data.requiredWork, // 6: Required Work
        "", // 7: Date Dropped Off (empty for now)
        data.estimatedCost || "", // 8: Estimated Cost
        "", // 9: Final Cost (empty for now)
        data.terms || "", // 10: Terms
        data.shopReferenceNumber || "", // 11: Shop Reference Number
        "", // 12: Estimated Delivery Date (empty for now)
        initialStatus, // 13: Current Status
        todayISO, // 14: Current Status Date
        "", // 15: GenThrust Status (empty for now)
        "", // 16: Shop Status (empty for now)
        "", // 17: Tracking Number (empty for now)
        serializedNotes, // 18: Notes with initial status history
        todayISO, // 19: Last Date Updated
        nextUpdateISO, // 20: Next Date to Update (auto-calculated)
        "", // 21: Checked (empty for now)
      ];

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/add`,
        "POST",
        {
          values: [newRow],
        },
        sessionId
      );
    });
  }

  async updateRepairOrder(
    rowIndex: number,
    data: {
      roNumber: string;
      shopName: string;
      partNumber: string;
      serialNumber: string;
      partDescription: string;
      requiredWork: string;
      estimatedCost?: number;
      terms?: string;
      shopReferenceNumber?: string;
    }
  ): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const fileId = await this.getFileId();
    const sessionManager = await this.getSessionManager();

    await sessionManager.withSession(async (sessionId) => {
      // Get current row to preserve other fields
      const response = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        sessionId
      );

      const currentValues = response.values[0];
      const today = new Date().toISOString();

      // Update only the editable fields, preserve all others
      currentValues[0] = data.roNumber;
      currentValues[2] = data.shopName;
      currentValues[3] = data.partNumber;
      currentValues[4] = data.serialNumber;
      currentValues[5] = data.partDescription;
      currentValues[6] = data.requiredWork;
      currentValues[8] = data.estimatedCost || "";
      currentValues[10] = data.terms || "";
      currentValues[11] = data.shopReferenceNumber || "";
      currentValues[19] = today; // Last Date Updated

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [currentValues] },
        sessionId
      );
    });
  }

  async deleteRepairOrder(rowIndex: number): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const fileId = await this.getFileId();
    const sessionManager = await this.getSessionManager();

    await sessionManager.withSession(async (sessionId) => {
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "DELETE",
        undefined,
        sessionId
      );
    });
  }

  /**
   * Move an RO from the active sheet to a final archive sheet
   * @param rowIndex - The row index in the active table
   * @param targetSheetName - The target sheet name (e.g., 'Paid', 'NET', 'Returns')
   * @param targetTableName - The target table name (e.g., 'Approved_Paid')
   */
  async moveROToArchive(
    rowIndex: number,
    targetSheetName: string,
    targetTableName: string
  ): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const fileId = await this.getFileId();
    const sessionManager = await this.getSessionManager();

    await sessionManager.withSession(async (sessionId) => {
      // Step 1: Get the row data from the active table
      const rowResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        sessionId
      );

      const rowData = rowResponse.values[0];

      // Step 2: Add the row to the target table
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/${targetSheetName}/tables/${targetTableName}/rows/add`,
        "POST",
        {
          values: [rowData],
        },
        sessionId
      );

      // Step 3: Delete the row from the active table
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "DELETE",
        undefined,
        sessionId
      );
    });
  }

  /**
   * Get rows from a specific sheet/table
   * @param sheetName - The sheet name
   * @param tableName - The table name
   */
  async getRowsFromTable(sheetName: string, tableName: string): Promise<any[]> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const fileId = await this.getFileId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/${sheetName}/tables/${tableName}/rows`
    );

    return response.value || [];
  }

  /**
   * AI Logging Methods - Store AI conversation logs in Excel
   */

  /**
   * Ensure the Logs worksheet exists
   */
  private async ensureLogsWorksheetExists(): Promise<void> {
    const fileId = await this.getFileId();

    try {
      // Try to get the Logs worksheet
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs`
      );
      // Logs worksheet already exists
    } catch (error) {
      // Worksheet doesn't exist, create it
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/add`,
        'POST',
        { name: 'Logs' }
      );
    }
  }

  /**
   * Ensure the AILogs table exists in the Logs worksheet
   */
  private async ensureAILogsTableExists(): Promise<void> {
    const fileId = await this.getFileId();

    await this.ensureLogsWorksheetExists();

    try {
      // Try to get the AILogs table
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs`
      );
      // AILogs table already exists
    } catch (error) {
      // Table doesn't exist, create it

      // Step 1: Write header row to cells first
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/range(address='A1:J1')`,
        'PATCH',
        {
          values: [[
            'Timestamp',
            'Date',
            'User',
            'User Message',
            'AI Response',
            'Context',
            'Model',
            'Duration (ms)',
            'Success',
            'Error'
          ]]
        }
      );

      // Step 2: Create table with the header row (A1:J1 range)
      // Using proper Excel table creation - must include at least the header row
      const createTableResponse = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/add`,
        'POST',
        {
          address: 'Logs!A1:J1',
          hasHeaders: true
        }
      );

      // Step 3: Set the table name to 'AILogs'
      const tableId = createTableResponse.id;
      if (tableId) {
        await this.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${tableId}`,
          'PATCH',
          { name: 'AILogs' }
        );
      }
    }
  }

  /**
   * Add a log entry to the Excel AILogs table
   */
  async addLogToExcelTable(entry: {
    timestamp: Date;
    date: string;
    user: string;
    userMessage: string;
    aiResponse: string;
    context?: string;
    model?: string;
    duration?: number;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      const fileId = await this.getFileId();

      // Ensure table exists
      await this.ensureAILogsTableExists();

      const sessionManager = await this.getSessionManager();

      await sessionManager.withSession(async (sessionId) => {
        // Prepare row data
        const rowData = [
          entry.timestamp.toISOString(),
          entry.date,
          entry.user,
          entry.userMessage,
          entry.aiResponse,
          entry.context || '',
          entry.model || '',
          entry.duration || '',
          entry.success ? 'Yes' : 'No',
          entry.error || ''
        ];

        // Add row to table
        await this.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs/rows/add`,
          'POST',
          { values: [rowData] },
          sessionId
        );
      });
    } catch (error) {
      // Failed to log to Excel table - logging failures shouldn't break the app
    }
  }

  /**
   * AI log entry interface
   */
  interface AILogEntry {
    id: string;
    timestamp: Date;
    date: string;
    user: string;
    userMessage: string;
    aiResponse: string;
    context?: string;
    model?: string;
    duration?: number;
    success: boolean;
    error?: string;
  }

  /**
   * Get all log entries from the Excel AILogs table
   *
   * @returns Array of log entries, sorted by timestamp (newest first)
   */
  async getLogsFromExcelTable(): Promise<AILogEntry[]> {
    try {
      const fileId = await this.getFileId();

      // Ensure table exists
      await this.ensureAILogsTableExists();

      // Get all rows
      const response = await this.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs/rows`
      );

      if (!response) {
        logger.warn('Empty response when fetching AI logs');
        return [];
      }

      const rows = response.value || [];

      const logs: AILogEntry[] = rows.map((row, index): AILogEntry => {
        const values = row.values[0];

        return {
          id: `log-${index}`,
          timestamp: new Date(String(values[0])),
          date: typeof values[1] === 'string' ? values[1] : '',
          user: typeof values[2] === 'string' ? values[2] : '',
          userMessage: typeof values[3] === 'string' ? values[3] : '',
          aiResponse: typeof values[4] === 'string' ? values[4] : '',
          context: values[5] ? String(values[5]) : undefined,
          model: values[6] ? String(values[6]) : undefined,
          duration: values[7] ? Number(values[7]) : undefined,
          success: values[8] === 'Yes',
          error: values[9] ? String(values[9]) : undefined
        };
      });

      // Sort by timestamp, newest first
      return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      // Failed to get logs from Excel table
      logger.error('Failed to get logs from Excel table', error);
      return [];
    }
  }

  /**
   * Delete a log entry from Excel by row index
   */
  async deleteExcelLog(rowIndex: number): Promise<void> {
    try {
      const fileId = await this.getFileId();
      const sessionManager = await this.getSessionManager();

      await sessionManager.withSession(async (sessionId) => {
        await this.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs/rows/itemAt(index=${rowIndex})`,
          'DELETE',
          undefined,
          sessionId
        );
      });
    } catch (error) {
      // Failed to delete Excel log entry
      throw error;
    }
  }
}

export const excelService = new ExcelService();
