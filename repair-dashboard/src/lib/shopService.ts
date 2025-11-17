import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { Shop } from "../types";
import { createLogger } from '@/utils/logger';

const logger = createLogger('ShopService');

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const SHOP_FILE_NAME = import.meta.env.VITE_EXCEL_FILE_NAME; // Use same file as RO data
const SHOP_TABLE_NAME = import.meta.env.VITE_SHOP_TABLE_NAME || "ShopTable"; // Different table/sheet in same workbook

class ShopService {
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
      logger.warn("Silent token acquisition failed, using popup");
      try {
        const response = await this.msalInstance.acquireTokenPopup({
          ...loginRequest,
          account,
        });
        return response.accessToken;
      } catch (popupError: any) {
        logger.error("Popup token acquisition failed", popupError);
        // If popup fails due to CORS/COOP, try redirect
        if (popupError.message?.includes("popup") || popupError.message?.includes("CORS")) {
          logger.info("Using redirect flow");
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

      logger.error(`${method} ${endpoint} failed`, new Error(JSON.stringify(errorDetails)), {
        method,
        endpoint,
        status: response.status,
        statusText: response.statusText
      });

      throw new Error(
        `Graph API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorDetails, null, 2)}`
      );
    }

    // Handle empty responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

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
        true
      );
      this.sessionId = null;
    } catch (error) {
      logger.error("Failed to close session", error);
      this.sessionId = null;
    }
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

    this.driveId = driveResponse.id;

    // Search for file
    const searchResponse = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/root/search(q='${SHOP_FILE_NAME}')`
    );

    if (searchResponse.value.length === 0) {
      throw new Error(`File ${SHOP_FILE_NAME} not found`);
    }

    this.fileId = searchResponse.value[0].id;
    return this.fileId!;
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

  async listTables(): Promise<any[]> {
    const fileId = await this.getFileId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables`
    );

    logger.debug("Available tables in workbook", {
      tableCount: response.value.length,
      tables: response.value.map((t: any) => t.name)
    });
    return response.value;
  }

  async getShops(): Promise<Shop[]> {
    const fileId = await this.getFileId();

    // Debug: List available tables
    try {
      await this.listTables();
    } catch (error) {
      logger.error("Could not list tables", error);
    }

    logger.info("Fetching shops from table", {
      tableName: SHOP_TABLE_NAME
    });

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows`
    );

    const rows = response.value;

    return rows.map((row: any, index: number) => {
      const values = row.values[0];

      const businessName = values[1] || "";
      const contact = values[15] || "";
      const paymentTerms = values[16] || "";

      return {
        id: `shop-${index}`,
        customerNumber: values[0] || "",
        businessName,
        addressLine1: values[2] || "",
        addressLine2: values[3] || "",
        addressLine3: values[4] || "",
        addressLine4: values[5] || "",
        city: values[6] || "",
        state: values[7] || "",
        zip: values[8] || "",
        country: values[9] || "",
        phone: values[10] || "",
        tollFree: values[11] || "",
        fax: values[12] || "",
        email: values[13] || "",
        website: values[14] || "",
        contact,
        paymentTerms,
        ilsCode: values[17] || "",
        lastSaleDate: this.parseExcelDate(values[18]),
        ytdSales: this.parseCurrency(values[19]),

        // Backward compatibility aliases
        shopName: businessName,
        contactName: contact,
        defaultTerms: paymentTerms,
      };
    });
  }

  async addShop(data: {
    customerNumber?: string;
    businessName: string;
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    addressLine4?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    phone?: string;
    tollFree?: string;
    fax?: string;
    email?: string;
    website?: string;
    contact?: string;
    paymentTerms?: string;
    ilsCode?: string;
  }): Promise<void> {
    const fileId = await this.getFileId();

    try {
      await this.createSession();

      const newRow = [
        data.customerNumber || "",
        data.businessName,
        data.addressLine1 || "",
        data.addressLine2 || "",
        data.addressLine3 || "",
        data.addressLine4 || "",
        data.city || "",
        data.state || "",
        data.zip || "",
        data.country || "",
        data.phone || "",
        data.tollFree || "",
        data.fax || "",
        data.email || "",
        data.website || "",
        data.contact || "",
        data.paymentTerms || "",
        data.ilsCode || "",
        "", // Last Sale Date (empty for new shops)
        "", // YTD Sales (empty for new shops)
      ];

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows/add`,
        "POST",
        {
          values: [newRow],
        },
        true
      );
    } finally {
      await this.closeSession();
    }
  }

  async updateShop(
    rowIndex: number,
    data: {
      customerNumber: string;
      businessName: string;
      addressLine1: string;
      addressLine2: string;
      addressLine3: string;
      addressLine4: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      phone: string;
      tollFree: string;
      fax: string;
      email: string;
      website: string;
      contact: string;
      paymentTerms: string;
      ilsCode: string;
    }
  ): Promise<void> {
    const fileId = await this.getFileId();

    try {
      await this.createSession();

      // Get current row to preserve Last Sale Date and YTD Sales
      const response = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "GET",
        undefined,
        true
      );

      const currentValues = response.values[0];

      const updatedRow = [
        data.customerNumber,
        data.businessName,
        data.addressLine1,
        data.addressLine2,
        data.addressLine3,
        data.addressLine4,
        data.city,
        data.state,
        data.zip,
        data.country,
        data.phone,
        data.tollFree,
        data.fax,
        data.email,
        data.website,
        data.contact,
        data.paymentTerms,
        data.ilsCode,
        currentValues[18] || "", // Preserve Last Sale Date
        currentValues[19] || "", // Preserve YTD Sales
      ];

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "PATCH",
        { values: [updatedRow] },
        true
      );
    } finally {
      await this.closeSession();
    }
  }

  async deleteShop(rowIndex: number): Promise<void> {
    const fileId = await this.getFileId();

    try {
      await this.createSession();

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows/itemAt(index=${rowIndex})`,
        "DELETE",
        undefined,
        true
      );
    } finally {
      await this.closeSession();
    }
  }
}

export const shopService = new ShopService();
