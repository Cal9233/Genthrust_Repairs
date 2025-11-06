import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { RepairOrder } from "../types";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;
const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

class ExcelService {
  private msalInstance: IPublicClientApplication | null = null;
  private driveId: string | null = null;

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
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
    }
  }

  private async callGraphAPI(endpoint: string, method = "GET", body?: any) {
    const token = await this.getAccessToken();

    console.log(`[Excel Service] Calling Graph API:`, {
      endpoint,
      method,
      body,
    });

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

    console.log(`[Excel Service] Response:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Excel Service] Error response body:`, errorText);

      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      throw new Error(
        `Graph API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorDetails, null, 2)}`
      );
    }

    return response.json();
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

  async getFileId(): Promise<string> {
    console.log("[Excel Service] Configuration:", {
      SITE_URL,
      FILE_NAME,
      TABLE_NAME,
    });

    // Get site drive
    const siteUrl = new URL(SITE_URL);
    const hostname = siteUrl.hostname; // e.g., genthrustxvii.sharepoint.com
    const sitePath = siteUrl.pathname; // e.g., /sites/PartsQuotationsWebsite

    console.log("[Excel Service] Parsed URL:", { hostname, sitePath });

    const siteResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`
    );

    // Get drive
    const driveResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    // Cache the drive ID for later use
    this.driveId = driveResponse.id;
    console.log("[Excel Service] Cached drive ID:", this.driveId);

    // Search for file
    const searchResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${FILE_NAME}')`
    );

    if (searchResponse.value.length === 0) {
      throw new Error(`File ${FILE_NAME} not found`);
    }

    return searchResponse.value[0].id;
  }

  async getFileInfo(): Promise<any> {
    const fileId = await this.getFileId();

    console.log("[Excel Service] Getting file info for fileId:", fileId);

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}`
    );

    console.log("[Excel Service] File info:", {
      name: response.name,
      size: response.size,
      fileExtension: response.name.split(".").pop(),
      mimeType: response.file?.mimeType,
      webUrl: response.webUrl,
    });

    return response;
  }

  async listTables(): Promise<any[]> {
    const fileId = await this.getFileId();

    console.log(
      "[Excel Service] Listing all tables in workbook for fileId:",
      fileId
    );

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables`
    );

    console.log("[Excel Service] Available tables:", response.value);
    return response.value;
  }

  async getRepairOrders(): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    // Check file info to verify it's a valid Excel file
    await this.getFileInfo();

    // First, list all available tables to help with debugging
    await this.listTables();

    // Get table data
    console.log(`[Excel Service] Attempting to read table: ${TABLE_NAME}`);
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

      return {
        id: `row-${index}`,
        roNumber: values[0] || "",
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
        notes: values[18] || "",
        lastDateUpdated: lastUpdated,
        nextDateToUpdate: nextUpdate,
        checked: values[21] || "",
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
    notes?: string
  ): Promise<void> {
    const fileId = await this.getFileId();
    const today = new Date().toISOString();

    // Get current row data first
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`
    );

    const currentValues = response.values[0];

    // Update specific columns
    currentValues[13] = status; // Current Status
    currentValues[14] = today; // Status Date
    if (notes) {
      currentValues[18] = notes; // Notes
    }
    currentValues[19] = today; // Last Updated

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      { values: [currentValues] }
    );
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
    const today = new Date().toISOString();

    console.log("[Excel Service] Adding new repair order:", data);

    // Create row with all columns (22 columns total based on RepairOrder type)
    const newRow = [
      data.roNumber, // 0: RO Number
      today, // 1: Date Made
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
      "TO SEND", // 13: Current Status
      today, // 14: Current Status Date
      "", // 15: GenThrust Status (empty for now)
      "", // 16: Shop Status (empty for now)
      "", // 17: Tracking Number (empty for now)
      "", // 18: Notes (empty for now)
      today, // 19: Last Date Updated
      "", // 20: Next Date to Update (empty for now)
      "", // 21: Checked (empty for now)
    ];

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/add`,
      "POST",
      {
        values: [newRow],
      }
    );

    console.log("[Excel Service] New repair order added successfully");
  }
}

export const excelService = new ExcelService();
