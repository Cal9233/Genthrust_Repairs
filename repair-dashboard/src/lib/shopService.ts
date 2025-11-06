import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import type { Shop } from "../types";

const SITE_URL = import.meta.env.VITE_SHAREPOINT_SITE_URL;
const SHOP_FILE_NAME = "ShopDirectory.xlsx"; // Separate file for shop data
const SHOP_TABLE_NAME = "ShopTable";

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
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup(loginRequest);
      return response.accessToken;
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

      console.error(`[Shop Service] ${method} ${endpoint} failed:`, errorDetails);

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
      console.error("[Shop Service] Failed to close session:", error);
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

  async getShops(): Promise<Shop[]> {
    const fileId = await this.getFileId();

    const response = await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/drives/${this.driveId}/items/${fileId}/workbook/tables/${SHOP_TABLE_NAME}/rows`
    );

    const rows = response.value;

    return rows.map((row: any, index: number) => {
      const values = row.values[0];

      return {
        id: `shop-${index}`,
        shopName: values[0] || "",
        contactName: values[1] || "",
        email: values[2] || "",
        phone: values[3] || "",
        defaultTerms: values[4] || "",
        typicalTAT: typeof values[5] === "number" ? values[5] : 0,
        notes: values[6] || "",
        active: values[7] === true || values[7] === "true" || values[7] === "TRUE",
      };
    });
  }

  async addShop(data: {
    shopName: string;
    contactName: string;
    email: string;
    phone: string;
    defaultTerms: string;
    typicalTAT: number;
    notes?: string;
  }): Promise<void> {
    const fileId = await this.getFileId();

    try {
      await this.createSession();

      const newRow = [
        data.shopName,
        data.contactName,
        data.email,
        data.phone,
        data.defaultTerms,
        data.typicalTAT,
        data.notes || "",
        true, // active by default
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
      shopName: string;
      contactName: string;
      email: string;
      phone: string;
      defaultTerms: string;
      typicalTAT: number;
      notes: string;
      active: boolean;
    }
  ): Promise<void> {
    const fileId = await this.getFileId();

    try {
      await this.createSession();

      const updatedRow = [
        data.shopName,
        data.contactName,
        data.email,
        data.phone,
        data.defaultTerms,
        data.typicalTAT,
        data.notes,
        data.active,
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
}

export const shopService = new ShopService();
