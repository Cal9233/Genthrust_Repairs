import { msalInstance } from '../main';
import { loginRequest } from './authConfig';

class ExcelService {
  constructor() {
    this.baseUrl = 'https://graph.microsoft.com/v1.0';
    this.siteUrl = import.meta.env.VITE_SHAREPOINT_SITE_URL;
    this.fileName = import.meta.env.VITE_EXCEL_FILE_NAME;
    this.siteId = null;
    this.fileId = null;
  }

  async getAccessToken() {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('No active account found');
    }

    const silentRequest = {
      ...loginRequest,
      account,
    };

    try {
      const response = await msalInstance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      console.error('Silent token acquisition failed:', error);
      throw error;
    }
  }

  async makeRequest(url, options = {}) {
    const token = await this.getAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async initializeFileInfo() {
    if (this.siteId && this.fileId) {
      return;
    }

    try {
      const sitePath = new URL(this.siteUrl).pathname;
      const siteData = await this.makeRequest(
        `${this.baseUrl}/sites/root:${sitePath}`
      );
      this.siteId = siteData.id;

      const searchResults = await this.makeRequest(
        `${this.baseUrl}/sites/${this.siteId}/drive/root/search(q='${this.fileName}')`
      );

      if (searchResults.value.length === 0) {
        throw new Error(`Excel file '${this.fileName}' not found in SharePoint`);
      }

      this.fileId = searchResults.value[0].id;
    } catch (error) {
      console.error('Failed to initialize file info:', error);
      throw error;
    }
  }

  async getTables() {
    await this.initializeFileInfo();

    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/drives/${this.siteId.split(',')[1]}/items/${this.fileId}/workbook/tables`
      );

      return response.value.map(table => ({
        id: table.id,
        name: table.name,
        displayName: table.displayName || table.name
      }));
    } catch (error) {
      console.error('Failed to get tables:', error);
      throw error;
    }
  }

  async getTableData(tableName = 'RO Outside') {
    await this.initializeFileInfo();

    try {
      const driveId = this.siteId.split(',')[1];

      const [headerResponse, rowsResponse] = await Promise.all([
        this.makeRequest(
          `${this.baseUrl}/drives/${driveId}/items/${this.fileId}/workbook/tables('${tableName}')/headerRowRange`
        ),
        this.makeRequest(
          `${this.baseUrl}/drives/${driveId}/items/${this.fileId}/workbook/tables('${tableName}')/rows`
        )
      ]);

      const headers = headerResponse.values[0];
      const rows = rowsResponse.value.map(row => row.values[0]);

      return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
    } catch (error) {
      console.error('Failed to get table data:', error);
      throw error;
    }
  }

  async updateRow(tableName, rowIndex, data) {
    await this.initializeFileInfo();

    try {
      const driveId = this.siteId.split(',')[1];
      const response = await this.makeRequest(
        `${this.baseUrl}/drives/${driveId}/items/${this.fileId}/workbook/tables('${tableName}')/rows/itemAt(index=${rowIndex})`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            values: [Object.values(data)]
          })
        }
      );

      return response;
    } catch (error) {
      console.error('Failed to update row:', error);
      throw error;
    }
  }

  async addRow(tableName, data) {
    await this.initializeFileInfo();

    try {
      const driveId = this.siteId.split(',')[1];
      const response = await this.makeRequest(
        `${this.baseUrl}/drives/${driveId}/items/${this.fileId}/workbook/tables('${tableName}')/rows/add`,
        {
          method: 'POST',
          body: JSON.stringify({
            values: [Object.values(data)]
          })
        }
      );

      return response;
    } catch (error) {
      console.error('Failed to add row:', error);
      throw error;
    }
  }
}

export const excelService = new ExcelService();