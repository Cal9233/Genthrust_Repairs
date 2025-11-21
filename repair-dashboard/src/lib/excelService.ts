import type { IPublicClientApplication } from "@azure/msal-browser";
import type { RepairOrder } from "../types";
import type {
  GraphAPIResponse,
  GraphSiteResponse,
  GraphDriveResponse,
  GraphFileResponse,
  GraphTableRowResponse,
} from "../types/graphApi";
import { createLogger } from "../utils/logger";
import { graphClient } from "./excel/GraphClient";
import { SessionManager } from "./excel/SessionManager";
import { RepairOrderRepository } from "./excel/RepairOrderRepository";

const logger = createLogger('ExcelService');

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;

/**
 * AI log entry interface
 */
export interface AILogEntry {
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
 * Excel Service - Facade Pattern
 *
 * This service acts as a facade that coordinates between:
 * - GraphClient: Microsoft Graph API HTTP client
 * - SessionManager: Excel session management
 * - RepairOrderRepository: Repair order CRUD operations
 *
 * Maintains the same public API as before for backward compatibility.
 */
class ExcelService {
  private driveId: string | null = null;
  private fileId: string | null = null;
  private sessionManager: SessionManager | null = null;
  private repairOrderRepository: RepairOrderRepository | null = null;

  /**
   * Set MSAL instance for authentication
   */
  setMsalInstance(instance: IPublicClientApplication) {
    graphClient.setMsalInstance(instance);
    logger.debug('MSAL instance set in ExcelService');
  }

  /**
   * Get or initialize the session manager
   */
  private async getSessionManager(): Promise<SessionManager> {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    // Ensure we have driveId and fileId
    if (!this.fileId) {
      await this.getFileId();
    }

    // Create session manager
    this.sessionManager = new SessionManager(
      this.driveId!,
      this.fileId!,
      graphClient,
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

  /**
   * Get or initialize the repair order repository
   */
  private async getRepairOrderRepository(): Promise<RepairOrderRepository> {
    if (this.repairOrderRepository) {
      return this.repairOrderRepository;
    }

    // Ensure we have driveId, fileId, and sessionManager
    if (!this.fileId) {
      await this.getFileId();
    }

    const sessionManager = await this.getSessionManager();

    // Create repository
    this.repairOrderRepository = new RepairOrderRepository(
      this.driveId!,
      this.fileId!,
      graphClient,
      sessionManager
    );

    logger.debug('RepairOrderRepository created');

    return this.repairOrderRepository;
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

    const siteResponse = await graphClient.callGraphAPI<GraphSiteResponse>(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
    );

    if (!siteResponse) {
      throw new Error('Failed to get SharePoint site information');
    }

    // Get drive
    const driveResponse = await graphClient.callGraphAPI<GraphDriveResponse>(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    if (!driveResponse) {
      throw new Error('Failed to get SharePoint drive information');
    }

    // Cache the drive ID for later use
    this.driveId = driveResponse.id;

    // Search for file
    const searchResponse = await graphClient.callGraphAPI<GraphAPIResponse<GraphFileResponse>>(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${FILE_NAME}')`
    );

    if (!searchResponse || searchResponse.value.length === 0) {
      throw new Error(`File ${FILE_NAME} not found`);
    }

    // Cache the file ID for later use
    this.fileId = searchResponse.value[0].id;

    logger.debug('File ID resolved', {
      driveId: this.driveId,
      fileId: this.fileId,
    });

    return this.fileId!;
  }

  /**
   * Get file information
   */
  async getFileInfo(): Promise<any> {
    const fileId = await this.getFileId();

    const response = await graphClient.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}`
    );

    return response;
  }

  /**
   * List all tables in the workbook
   */
  async listTables(): Promise<any[]> {
    const fileId = await this.getFileId();

    const response = await graphClient.callGraphAPI(
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

      const searchResponse = await graphClient.callGraphAPI(
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
      logger.error('Error searching for file', error, { fileName });
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
      const fileInfo = await graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${INVENTORY_WORKBOOK_ID}`
      );

      return {
        id: fileInfo.id,
        name: fileInfo.name,
        webUrl: fileInfo.webUrl
      };
    } catch (error) {
      // Error fetching inventory file info
      logger.error('Error fetching inventory file info', error);
      return null;
    }
  }

  // =========================================================================
  // Repair Order Operations - Delegated to RepairOrderRepository
  // =========================================================================

  /**
   * Get all repair orders from the main table
   */
  async getRepairOrders(): Promise<RepairOrder[]> {
    const repository = await this.getRepairOrderRepository();
    return repository.getRepairOrders();
  }

  /**
   * Get repair orders from a specific sheet and table (e.g., archive sheets)
   */
  async getRepairOrdersFromSheet(sheetName: string, tableName: string): Promise<RepairOrder[]> {
    const repository = await this.getRepairOrderRepository();
    return repository.getRepairOrdersFromSheet(sheetName, tableName);
  }

  /**
   * Add a new repair order
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
    const repository = await this.getRepairOrderRepository();
    return repository.addRepairOrder(data);
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
    const repository = await this.getRepairOrderRepository();
    return repository.updateRepairOrder(rowIndex, data);
  }

  /**
   * Update repair order status
   */
  async updateROStatus(
    rowIndex: number,
    status: string,
    statusNotes?: string,
    cost?: number,
    deliveryDate?: Date,
    trackingNumber?: string
  ): Promise<void> {
    const repository = await this.getRepairOrderRepository();
    return repository.updateROStatus(rowIndex, status, statusNotes, cost, deliveryDate, trackingNumber);
  }

  /**
   * Delete a repair order
   */
  async deleteRepairOrder(rowIndex: number): Promise<void> {
    const repository = await this.getRepairOrderRepository();
    return repository.deleteRepairOrder(rowIndex);
  }

  /**
   * Move an RO from the active sheet to a final archive sheet
   */
  async moveROToArchive(
    rowIndex: number,
    targetSheetName: string,
    targetTableName: string
  ): Promise<void> {
    const repository = await this.getRepairOrderRepository();
    return repository.moveROToArchive(rowIndex, targetSheetName, targetTableName);
  }

  /**
   * Get rows from a specific sheet/table
   */
  async getRowsFromTable(sheetName: string, tableName: string): Promise<any[]> {
    const repository = await this.getRepairOrderRepository();
    return repository.getRowsFromTable(sheetName, tableName);
  }

  /**
   * Update a single row cell (legacy method)
   */
  async updateRow(
    rowIndex: number,
    columnIndex: number,
    value: any
  ): Promise<void> {
    const repository = await this.getRepairOrderRepository();
    return repository.updateRow(rowIndex, columnIndex, value);
  }

  // =========================================================================
  // AI Logging Methods - Kept in ExcelService
  // =========================================================================

  /**
   * Ensure the Logs worksheet exists
   */
  private async ensureLogsWorksheetExists(): Promise<void> {
    const fileId = await this.getFileId();

    try {
      // Try to get the Logs worksheet
      await graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs`
      );
      // Logs worksheet already exists
    } catch (error) {
      // Worksheet doesn't exist, create it
      await graphClient.callGraphAPI(
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
      await graphClient.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs`
      );
      // AILogs table already exists
    } catch (error) {
      // Table doesn't exist, create it

      // Step 1: Write header row to cells first
      await graphClient.callGraphAPI(
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
      const createTableResponse = await graphClient.callGraphAPI(
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
        await graphClient.callGraphAPI(
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
        await graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs/rows/add`,
          'POST',
          { values: [rowData] },
          sessionId
        );
      });
    } catch (error) {
      // Failed to log to Excel table - logging failures shouldn't break the app
      logger.error('Failed to add log to Excel table', error);
    }
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
      const response = await graphClient.callGraphAPI<GraphAPIResponse<GraphTableRowResponse>>(
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
        await graphClient.callGraphAPI(
          `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Logs/tables/AILogs/rows/itemAt(index=${rowIndex})`,
          'DELETE',
          undefined,
          sessionId
        );
      });
    } catch (error) {
      // Failed to delete Excel log entry
      logger.error('Failed to delete Excel log entry', error);
      throw error;
    }
  }
}

export const excelService = new ExcelService();
