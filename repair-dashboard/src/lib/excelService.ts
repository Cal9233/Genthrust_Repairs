import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { RepairOrder } from "../types";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME;
const TABLE_NAME = import.meta.env.VITE_EXCEL_TABLE_NAME;

class ExcelService {
  private msalInstance: IPublicClientApplication | null = null;

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
      throw new Error(`Graph API error: ${response.statusText}`);
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
    // Get site drive
    const sitePath = new URL(SITE_URL).pathname;
    const siteResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/root:${sitePath}`
    );

    // Get drive
    const driveResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/sites/${siteResponse.id}/drive`
    );

    // Search for file
    const searchResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${driveResponse.id}/root/search(q='${FILE_NAME}')`
    );

    if (searchResponse.value.length === 0) {
      throw new Error(`File ${FILE_NAME} not found`);
    }

    return searchResponse.value[0].id;
  }

  async getRepairOrders(): Promise<RepairOrder[]> {
    const fileId = await this.getFileId();

    // Get table data
    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows`
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
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
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
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`
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
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
      "PATCH",
      { values: [currentValues] }
    );
  }
}

export const excelService = new ExcelService();
