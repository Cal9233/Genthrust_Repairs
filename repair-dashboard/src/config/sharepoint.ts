/**
 * SharePoint Configuration
 *
 * This file contains configuration for SharePoint document storage.
 * You can configure it to use either SharePoint or OneDrive.
 */

export interface SharePointConfig {
  // Storage type
  storageType: 'sharepoint' | 'onedrive';

  // SharePoint site details (only needed if using SharePoint)
  siteId?: string; // Can be obtained from SharePoint site settings
  siteName?: string; // e.g., 'RepairOrders'
  documentLibrary?: string; // e.g., 'Documents' or 'Shared Documents'

  // Base folder path for RO attachments
  baseFolderPath: string; // e.g., '/RepairOrders' or '/Shared Documents/RepairOrders'
}

/**
 * Default configuration - Uses OneDrive for simplicity
 *
 * To switch to SharePoint:
 * 1. Create a SharePoint site
 * 2. Get the site ID from: https://graph.microsoft.com/v1.0/sites/{your-domain}.sharepoint.com:/sites/{site-name}
 * 3. Update the config below
 */
export const sharePointConfig: SharePointConfig = {
  // TEMPORARY: Using OneDrive until Site ID is obtained
  // To switch to SharePoint: Get Site ID and update below
  storageType: 'onedrive',

  // SharePoint configuration (for when you have Site ID):
  siteId: 'PASTE_YOUR_SITE_ID_HERE', // Get this from Graph Explorer
  siteName: 'PartsQuotationsWebsite',
  documentLibrary: 'Shared Documents',
  baseFolderPath: '/RO_Attachments', // OneDrive path (simpler for now)
};

/**
 * Helper function to get the base API path based on storage type
 */
export function getStorageBasePath(config: SharePointConfig): string {
  if (config.storageType === 'sharepoint') {
    if (!config.siteId) {
      throw new Error('SharePoint site ID is required when using SharePoint storage');
    }
    return `/sites/${config.siteId}/drive/root:${config.baseFolderPath}`;
  } else {
    // OneDrive
    return `/me/drive/root:${config.baseFolderPath}`;
  }
}

/**
 * Helper to construct folder path for an RO
 */
export function getROFolderPath(roNumber: string): string {
  return `${sharePointConfig.baseFolderPath}/${roNumber}`;
}
