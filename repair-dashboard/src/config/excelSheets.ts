/**
 * Excel Sheets Configuration
 *
 * Defines all sheets and tables used in the repair orders workbook
 */

export interface SheetConfig {
  sheetName: string;
  tableName: string;
  description: string;
}

export const EXCEL_SHEETS = {
  // Main active repairs
  ACTIVE: {
    sheetName: 'Active',
    tableName: 'Repairs',
    description: 'Active repair orders'
  },

  // Paid and received
  PAID: {
    sheetName: 'Paid',
    tableName: 'Approved_Paid',
    description: 'Paid ROs that have been received'
  },

  // NET (received but not paid)
  NET: {
    sheetName: 'NET',
    tableName: 'Approved_Net',
    description: 'NET ROs that have been received'
  },

  // Returns (BER/RAI/Cancelled)
  RETURNS: {
    sheetName: 'Returns',
    tableName: 'Approved_Cancel',
    description: 'Cancelled/BER/RAI ROs that have been received'
  }
} as const;

export type SheetType = keyof typeof EXCEL_SHEETS;

/**
 * Determine which final sheet an RO should go to based on its status
 */
export function getFinalSheetForStatus(status: string): SheetConfig | null {
  const upperStatus = status.toUpperCase();

  if (upperStatus.includes('PAID')) {
    return EXCEL_SHEETS.PAID;
  }

  if (upperStatus === 'NET' || upperStatus.includes('NET')) {
    return EXCEL_SHEETS.NET;
  }

  if (upperStatus === 'BER' || upperStatus === 'RAI' || upperStatus.includes('CANCEL')) {
    return EXCEL_SHEETS.RETURNS;
  }

  return null;
}

/**
 * Check if a status requires approval before moving to final sheet
 */
export function statusRequiresApproval(status: string): boolean {
  return getFinalSheetForStatus(status) !== null;
}

/**
 * Get friendly name for the approval dialog
 */
export function getApprovalMessage(status: string): string {
  const sheet = getFinalSheetForStatus(status);

  if (!sheet) {
    return '';
  }

  switch (sheet.sheetName) {
    case 'Paid':
      return 'Have you received this part? It will be moved to the Paid archive.';
    case 'NET':
      return 'Have you received this part? It will be moved to the NET archive.';
    case 'Returns':
      return 'Have you received this part? It will be moved to the Returns archive.';
    default:
      return 'Have you received this part? It will be archived.';
  }
}
