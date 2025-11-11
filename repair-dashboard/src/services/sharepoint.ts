import type { IPublicClientApplication } from '@azure/msal-browser';
import { loginRequest } from '../lib/msalConfig';
import type { Attachment } from '../types';
import { sharePointConfig } from '../config/sharepoint';

/**
 * SharePoint/OneDrive Service
 *
 * Handles all file operations for repair order attachments using Microsoft Graph API.
 * Supports both SharePoint and OneDrive storage.
 */
class SharePointServiceClass {
  private msalInstance: IPublicClientApplication | null = null;

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
    console.log('[SharePointService] MSAL instance set');
    console.log('[SharePointService] Storage type:', sharePointConfig.storageType);
    console.log('[SharePointService] Site:', sharePointConfig.siteName);
    console.log('[SharePointService] Base path:', sharePointConfig.baseFolderPath);
  }

  private async getAccessToken(): Promise<string> {
    if (!this.msalInstance) {
      throw new Error('MSAL instance not set');
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error('No active account');
    }

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
        scopes: ['Files.ReadWrite', 'Files.ReadWrite.All'],
      });
      return response.accessToken;
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup({
        ...loginRequest,
        scopes: ['Files.ReadWrite', 'Files.ReadWrite.All'],
      });
      return response.accessToken;
    }
  }

  private async graphRequest(endpoint: string, options: RequestInit = {}) {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph API error ${response.status}: ${errorText}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  private getBasePath(): string {
    if (sharePointConfig.storageType === 'sharepoint') {
      if (!sharePointConfig.siteId || sharePointConfig.siteId === 'PASTE_YOUR_SITE_ID_HERE') {
        throw new Error(
          'SharePoint Site ID not configured. Please update src/config/sharepoint.ts with your Site ID. ' +
          'See ATTACHMENTS_README.md for instructions on how to get your Site ID.'
        );
      }
      return `/sites/${sharePointConfig.siteId}/drive/root:${sharePointConfig.baseFolderPath}`;
    } else {
      return `/me/drive/root:${sharePointConfig.baseFolderPath}`;
    }
  }

  private async ensureFolderExists(roNumber: string): Promise<void> {
    const basePath = this.getBasePath();

    try {
      // Check if RO folder exists - needs closing colon for path-based addressing
      console.log('[SharePointService] Checking folder:', `${basePath}/${roNumber}`);
      await this.graphRequest(`${basePath}/${roNumber}:`);
      console.log('[SharePointService] Folder exists');
    } catch (error: any) {
      if (error.message.includes('404')) {
        console.log('[SharePointService] Folder not found, creating...');
        try {
          // Ensure base folder exists
          try {
            await this.graphRequest(`${basePath}:`);
            console.log('[SharePointService] Base folder exists');
          } catch (baseError: any) {
            if (baseError.message.includes('404')) {
              console.log('[SharePointService] Base folder not found, creating...');
              // Base folder doesn't exist, create it
              const driveRoot =
                sharePointConfig.storageType === 'sharepoint'
                  ? `/sites/${sharePointConfig.siteId}/drive/root`
                  : '/me/drive/root';

              // Extract folder name from path (e.g., "RO_Attachments" from "/Shared Documents/RO_Attachments")
              const folderName = sharePointConfig.baseFolderPath.split('/').filter(Boolean).pop();

              // Get parent path (e.g., "/Shared Documents")
              const parentPath = sharePointConfig.baseFolderPath.substring(0, sharePointConfig.baseFolderPath.lastIndexOf('/'));

              const createEndpoint = parentPath
                ? `${driveRoot}:${parentPath}:/children`
                : `${driveRoot}/children`;

              await this.graphRequest(createEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: folderName,
                  folder: {},
                  '@microsoft.graph.conflictBehavior': 'fail',
                }),
              });
              console.log('[SharePointService] Base folder created');
            }
          }

          // Create RO folder - needs closing colon
          console.log('[SharePointService] Creating RO folder:', roNumber);
          await this.graphRequest(`${basePath}:/children`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: roNumber,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'fail',
            }),
          });
          console.log('[SharePointService] RO folder created');
        } catch (createError: any) {
          // 409 means folder already exists (race condition), which is fine
          if (!createError.message.includes('409')) {
            console.error('[SharePointService] Failed to create folder:', createError);
            throw createError;
          }
          console.log('[SharePointService] Folder already exists (409)');
        }
      } else {
        throw error;
      }
    }
  }

  async uploadFile(roNumber: string, file: File): Promise<Attachment> {
    await this.ensureFolderExists(roNumber);

    const basePath = this.getBasePath();
    const token = await this.getAccessToken();

    // Encode the filename to handle special characters like #, &, etc.
    const encodedFileName = encodeURIComponent(file.name);

    // For files < 4MB, use simple upload
    const uploadUrl = `https://graph.microsoft.com/v1.0${basePath}/${roNumber}/${encodedFileName}:/content`;

    console.log('[SharePointService] Uploading file:', file.name, 'to:', uploadUrl);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SharePointService] Upload failed:', error);
      throw new Error(`Upload failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('[SharePointService] Upload successful:', result.name);
    return this.mapToAttachment(result);
  }

  async getAttachments(roNumber: string): Promise<Attachment[]> {
    try {
      const basePath = this.getBasePath();
      // Path-based addressing needs closing colon before query params
      const response = await this.graphRequest(
        `${basePath}/${roNumber}:/children?$select=id,name,size,file,webUrl,createdDateTime,createdBy,lastModifiedDateTime,lastModifiedBy`
      );

      return response.value.map((item: any) => this.mapToAttachment(item));
    } catch (error: any) {
      if (error.message.includes('404')) {
        return [];
      }
      throw error;
    }
  }

  async getDownloadUrl(fileId: string): Promise<string> {
    const driveBasePath =
      sharePointConfig.storageType === 'sharepoint'
        ? `/sites/${sharePointConfig.siteId}/drive`
        : '/me/drive';

    const response = await this.graphRequest(`${driveBasePath}/items/${fileId}?$select=@microsoft.graph.downloadUrl`);

    return response['@microsoft.graph.downloadUrl'];
  }

  async deleteFile(fileId: string): Promise<void> {
    const driveBasePath =
      sharePointConfig.storageType === 'sharepoint'
        ? `/sites/${sharePointConfig.siteId}/drive`
        : '/me/drive';

    await this.graphRequest(`${driveBasePath}/items/${fileId}`, {
      method: 'DELETE',
    });
  }

  async getFolderUrl(roNumber: string): Promise<string> {
    await this.ensureFolderExists(roNumber);

    const basePath = this.getBasePath();
    // Path-based addressing needs closing colon before query params
    const response = await this.graphRequest(`${basePath}/${roNumber}:?$select=webUrl`);

    return response.webUrl;
  }

  private mapToAttachment(item: any): Attachment {
    return {
      id: item.id,
      name: item.name,
      size: item.size,
      mimeType: item.file?.mimeType || 'application/octet-stream',
      webUrl: item.webUrl,
      downloadUrl: item['@microsoft.graph.downloadUrl'] || '',
      createdDateTime: new Date(item.createdDateTime),
      createdBy: {
        user: {
          displayName: item.createdBy?.user?.displayName || 'Unknown',
          email: item.createdBy?.user?.email || '',
        },
      },
      lastModifiedDateTime: new Date(item.lastModifiedDateTime),
      lastModifiedBy: {
        user: {
          displayName: item.lastModifiedBy?.user?.displayName || 'Unknown',
          email: item.lastModifiedBy?.user?.email || '',
        },
      },
    };
  }
}

export const sharePointService = new SharePointServiceClass();
