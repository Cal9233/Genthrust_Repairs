import type { RepairOrder, StatusHistoryEntry } from "../../types";
import type {
  GraphAPIResponse,
  GraphTableRowResponse,
} from "../../types/graphApi";
import { calculateNextUpdateDate } from "../businessRules";
import { reminderService, ReminderService } from "../reminderService";
import { createLogger } from "../../utils/logger";
import type { GraphClient } from "./GraphClient";
import type { SessionManager } from "./SessionManager";

const logger = createLogger('RepairOrderRepository');

const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

/**
 * Repair Order Repository
 *
 * Handles CRUD operations and data mapping for Repair Orders in Excel.
 * Responsibilities:
 * - Excel date/currency parsing
 * - Status history serialization/deserialization
 * - CRUD operations (create, read, update, delete)
 * - Data transformation between Excel and application models
 */
export class RepairOrderRepository {
  constructor(
    private driveId: string,
    private fileId: string,
    private graphClient: GraphClient,
    private sessionManager: SessionManager
  ) {
    logger.debug('RepairOrderRepository initialized', {
      driveId,
      fileId,
    });
  }

  /**
   * Parse Excel serial date to JavaScript Date
   */
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

  /**
   * Parse currency value from Excel
   */
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

  /**
   * Serialize notes and status history for storage in Excel
   */
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

  /**
   * Map Excel row values to RepairOrder object
   */
  private mapRowToRepairOrder(values: any[], index: number): RepairOrder {
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
      statusHistory,
      daysOverdue,
      isOverdue,
    };
  }

  /**
   * Get all repair orders from the main table
   *
   * @returns Array of repair orders with computed fields
   */
  async getRepairOrders(): Promise<RepairOrder[]> {
    logger.info('Fetching repair orders from main table', { tableName: TABLE_NAME });

    const response = await this.graphClient.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows`
    );

    if (!response) {
      logger.warn('Empty response when fetching repair orders');
      return [];
    }

    const rows = response.value;
    logger.debug(`Fetched ${rows.length} repair orders`);

    return rows.map((row, index): RepairOrder => {
      const values = row.values[0]; // First array contains the row data
      return this.mapRowToRepairOrder(values, index);
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
    logger.info('Fetching repair orders from sheet', { sheetName, tableName });

    const response = await this.graphClient.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/worksheets/${sheetName}/tables/${tableName}/rows`
    );

    if (!response) {
      logger.warn('Empty response when fetching repair orders from sheet', { sheetName, tableName });
      return [];
    }

    const rows = response.value;
    logger.debug(`Fetched ${rows.length} repair orders from ${sheetName}/${tableName}`);

    return rows.map((row, index): RepairOrder => {
      const values = row.values[0]; // First array contains the row data
      return this.mapRowToRepairOrder(values, index);
    });
  }

  /**
   * Add a new repair order to the main table
   */
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
    logger.info('Adding new repair order', { roNumber: data.roNumber });

    const today = new Date();
    const todayISO = today.toISOString();

    // Calculate next update date based on initial status and payment terms
    const initialStatus = "TO SEND";
    const nextUpdateDate = calculateNextUpdateDate(initialStatus, today, data.terms);
    const nextUpdateISO = nextUpdateDate ? nextUpdateDate.toISOString() : "";

    // Get current user
    const currentUser = this.graphClient.getCurrentUser();

    // Initialize status history with first entry
    const initialHistory: StatusHistoryEntry[] = [{
      status: initialStatus,
      date: today,
      user: currentUser,
      notes: "Repair order created",
    }];

    const serializedNotes = this.serializeNotesWithHistory("", initialHistory);

    await this.sessionManager.withSession(async (sessionId) => {
      // Create row with all columns (21 columns total matching Excel table structure)
      const newRow = [
        data.roNumber, // 0: RO #
        todayISO, // 1: DATE MADE
        data.shopName, // 2: SHOP NAME
        data.partNumber, // 3: PART #
        data.serialNumber, // 4: SERIAL #
        data.partDescription, // 5: PART DESCRIPTION
        data.requiredWork, // 6: REQ WORK
        "", // 7: DATE DROPPED OFF (empty for now)
        data.estimatedCost || "", // 8: ESTIMATED COST
        "", // 9: FINAL COST (empty for now)
        data.terms || "", // 10: TERMS
        data.shopReferenceNumber || "", // 11: SHOP REF #
        "", // 12: ESTIMATED DELIVERY DATE (empty for now)
        initialStatus, // 13: CURENT STATUS
        todayISO, // 14: CURENT STATUS DATE
        "", // 15: GENTHRUST STATUS (empty for now)
        "", // 16: SHOP STATUS (empty for now)
        "", // 17: TRACKING NUMBER / PICKING UP (empty for now)
        serializedNotes, // 18: NOTES (with initial status history)
        todayISO, // 19: LAST DATE UPDATED
        nextUpdateISO, // 20: NEXT DATE TO UPDATE (auto-calculated)
      ];

      await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/add`,
        "POST",
        {
          values: [newRow],
        },
        sessionId
      );

      logger.info('Repair order added successfully', { roNumber: data.roNumber });
    });
  }

  /**
   * Update a repair order's basic fields
   */
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
    logger.info('Updating repair order', { rowIndex, roNumber: data.roNumber });

    await this.sessionManager.withSession(async (sessionId) => {
      // Get current row to preserve other fields
      const response = await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
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

      await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [currentValues] },
        sessionId
      );

      logger.info('Repair order updated successfully', { rowIndex });
    });
  }

  /**
   * Update repair order status with business logic
   */
  async updateROStatus(
    rowIndex: number,
    status: string,
    statusNotes?: string,
    cost?: number,
    deliveryDate?: Date,
    trackingNumber?: string
  ): Promise<void> {
    logger.info('Updating RO status', { rowIndex, status });

    const today = new Date();
    const todayISO = today.toISOString();

    // Get current user
    const currentUser = this.graphClient.getCurrentUser();

    await this.sessionManager.withSession(async (sessionId) => {
      // Get current row data first
      const response = await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
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

      await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [currentValues] },
        sessionId
      );

      logger.info('RO status updated successfully', { rowIndex, status });

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

  /**
   * Delete a repair order
   */
  async deleteRepairOrder(rowIndex: number): Promise<void> {
    logger.info('Deleting repair order', { rowIndex });

    await this.sessionManager.withSession(async (sessionId) => {
      await this.graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "DELETE",
        undefined,
        sessionId
      );

      logger.info('Repair order deleted successfully', { rowIndex });
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
    logger.info('🔄 Starting archive operation', {
      rowIndex,
      targetSheetName,
      targetTableName,
      activeTableName: TABLE_NAME
    });

    try {
      await this.sessionManager.withSession(async (sessionId) => {
        // Step 1: Get the row data from the active table
        logger.debug('Step 1: Fetching row data from active table', {
          rowIndex,
          activeTable: TABLE_NAME
        });

        const rowResponse = await this.graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
          "GET",
          undefined,
          sessionId
        );

        const rowData = rowResponse.values[0];

        logger.debug('✅ Row data fetched', {
          columnCount: rowData.length,
          rowData: rowData
        });

        // Step 2: Add the row to the target table
        logger.debug('Step 2: Adding row to archive table', {
          targetSheetName,
          targetTableName,
          columnCount: rowData.length
        });

        await this.graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/worksheets/${targetSheetName}/tables/${targetTableName}/rows/add`,
          "POST",
          {
            values: [rowData],
          },
          sessionId
        );

        logger.debug('✅ Row added to archive table');

        // Step 3: Delete the row from the active table
        logger.debug('Step 3: Deleting row from active table', {
          rowIndex,
          activeTable: TABLE_NAME
        });

        await this.graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
          "DELETE",
          undefined,
          sessionId
        );

        logger.info('✅ Archive operation completed successfully');
      });
    } catch (error: any) {
      logger.error('❌ Archive operation failed', error, {
        rowIndex,
        targetSheetName,
        targetTableName,
        activeTableName: TABLE_NAME,
        errorStatus: error.status,
        errorMessage: error.message,
        errorDetails: error.details
      });

      throw error;
    }
  }

  /**
   * Get rows from a specific sheet/table
   * @param sheetName - The sheet name
   * @param tableName - The table name
   */
  async getRowsFromTable(sheetName: string, tableName: string): Promise<any[]> {
    logger.info('Fetching rows from table', { sheetName, tableName });

    const response = await this.graphClient.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/worksheets/${sheetName}/tables/${tableName}/rows`
    );

    return response.value || [];
  }

  /**
   * Update a single row cell (legacy method for backward compatibility)
   */
  async updateRow(
    rowIndex: number,
    _columnIndex: number,
    value: any
  ): Promise<void> {
    logger.info('Updating single row cell', { rowIndex });

    await this.graphClient.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${this.fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      {
        values: [[value]], // Single cell update
      }
    );
  }
}
