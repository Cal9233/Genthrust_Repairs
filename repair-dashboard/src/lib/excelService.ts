import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { RepairOrder, StatusHistoryEntry } from "../types";
import { calculateNextUpdateDate } from "./businessRules";
import { reminderService, ReminderService } from "./reminderService";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;
const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

class ExcelService {
  private msalInstance: IPublicClientApplication | null = null;
  private driveId: string | null = null;
  private fileId: string | null = null;
  private sessionId: string | null = null;

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
      console.log("[Excel Service] Silent token acquisition failed, using popup");
      try {
        const response = await this.msalInstance.acquireTokenPopup({
          ...loginRequest,
          account,
        });
        return response.accessToken;
      } catch (popupError: any) {
        console.error("[Excel Service] Popup token acquisition failed:", popupError);
        // If popup fails due to CORS/COOP, try redirect
        if (popupError.message?.includes("popup") || popupError.message?.includes("CORS")) {
          console.log("[Excel Service] Using redirect flow...");
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

  private async callGraphAPI(endpoint: string, method = "GET", body?: any, useSession = false) {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Add session header if using session mode
    if (useSession && this.sessionId) {
      headers["workbook-session-id"] = this.sessionId;
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
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      console.error(`[Excel Service] ${method} ${endpoint} failed:`, errorDetails);

      throw new Error(
        `Graph API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorDetails, null, 2)}`
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

    return JSON.parse(text);
  }

  private async createSession(): Promise<string> {
    if (!this.fileId) {
      this.fileId = await this.getFileId();
    }

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/createSession`,
      "POST",
      {
        persistChanges: true,
      }
    );

    this.sessionId = response.id;
    return response.id;
  }

  private async closeSession(): Promise<void> {
    if (!this.sessionId || !this.fileId) {
      return;
    }

    try {
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/closeSession`,
        "POST",
        {},
        true // use session
      );
      this.sessionId = null;
    } catch (error) {
      console.error("[Excel Service] Failed to close session:", error);
      // Don't throw - just clear the session ID
      this.sessionId = null;
    }
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
        const historyData = JSON.parse(historyJson);

        // Convert date strings back to Date objects
        const statusHistory = historyData.map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
          deliveryDate: entry.deliveryDate ? new Date(entry.deliveryDate) : undefined,
        }));

        return { notes: userNotes, statusHistory };
      } catch (error) {
        console.error("[Excel Service] Failed to parse status history:", error);
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

    const historyJson = JSON.stringify(limitedHistory);
    return `HISTORY:${historyJson}|NOTES:${notes}`;
  }

  private getCurrentUser(): string {
    if (!this.msalInstance) {
      console.warn("[ExcelService] MSAL instance not available for getCurrentUser");
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
      console.warn("[ExcelService] No account found");
      return "Unknown User";
    }

    // Return the best available identifier
    const userName = account.name || account.username || account.idTokenClaims?.preferred_username || "Unknown User";
    console.log("[ExcelService] Current user:", userName);
    return userName;
  }

  async getFileId(): Promise<string> {
    // Return cached file ID if available
    if (this.fileId) {
      return this.fileId;
    }

    // Get site drive
    const siteUrl = new URL(SITE_URL);
    const hostname = siteUrl.hostname;
    const sitePath = siteUrl.pathname;

    const siteResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
    );

    // Get drive
    const driveResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    // Cache the drive ID for later use
    this.driveId = driveResponse.id;

    // Search for file
    const searchResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${FILE_NAME}')`
    );

    if (searchResponse.value.length === 0) {
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

    console.log("[Excel Service] Available tables in workbook:", response.value);
    return response.value;
  }

  async getRepairOrders(): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    // Debug: List available tables
    try {
      await this.listTables();
    } catch (error) {
      console.error("[Excel Service] Could not list tables:", error);
    }

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`
    );

    const rows = response.value;

    return rows.map((row: any, index: number) => {
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
      const { notes, statusHistory } = this.parseNotesWithHistory(values[18] || "");

      return {
        id: `row-${index}`,
        roNumber: String(values[0] ?? ""),
        dateMade: this.parseExcelDate(values[1]),
        shopName: values[2] || "",
        partNumber: values[3] || "",
        serialNumber: values[4] || "",
        partDescription: values[5] || "",
        requiredWork: values[6] || "",
        dateDroppedOff: this.parseExcelDate(values[7]),
        estimatedCost: this.parseCurrency(values[8]),
        finalCost: this.parseCurrency(values[9]),
        terms: values[10] || "",
        shopReferenceNumber: values[11] || "",
        estimatedDeliveryDate: this.parseExcelDate(values[12]),
        currentStatus: values[13] || "",
        currentStatusDate: this.parseExcelDate(values[14]),
        genThrustStatus: values[15] || "",
        shopStatus: values[16] || "",
        trackingNumber: values[17] || "",
        notes,
        lastDateUpdated: lastUpdated,
        nextDateToUpdate: nextUpdate,
        checked: values[21] || "",
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
    deliveryDate?: Date
  ): Promise<void> {
    const fileId = await this.getFileId();
    const today = new Date();
    const todayISO = today.toISOString();

    // Get current user
    const currentUser = this.getCurrentUser();

    try {
      // Create a workbook session for this operation
      await this.createSession();

      // Get current row data first
      const response = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        true // use session
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

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [currentValues] },
        true // use session
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
          }).catch((error) => {
            console.error('[Excel Service] Failed to create payment due calendar event:', error);
            // Don't throw - we don't want to fail the whole update if calendar creation fails
          });

          console.log(`[Excel Service] Payment due calendar event will be created for RO ${roNumber}: NET ${netDays} (due ${new Date(today.getTime() + netDays * 24 * 60 * 60 * 1000).toLocaleDateString()})`);
        }
      }
    } finally {
      // Always close the session, even if there was an error
      await this.closeSession();
    }
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

    try {
      // Create a workbook session for this operation
      await this.createSession();

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
        true // use session
      );
    } finally {
      // Always close the session, even if there was an error
      await this.closeSession();
    }
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

    try {
      await this.createSession();

      // Get current row to preserve other fields
      const response = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        true
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
        true
      );
    } finally {
      await this.closeSession();
    }
  }

  async deleteRepairOrder(rowIndex: number): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const fileId = await this.getFileId();

    try {
      await this.createSession();

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "DELETE",
        undefined,
        true
      );
    } finally {
      await this.closeSession();
    }
  }
}

export const excelService = new ExcelService();
