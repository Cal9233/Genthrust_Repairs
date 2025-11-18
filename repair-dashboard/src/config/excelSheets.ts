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
 * Extract NET days from payment terms (e.g., "NET30" returns 30)
 */
export function extractNetDays(terms: string): number | null {
  if (!terms) return null;

  const upperTerms = terms.toUpperCase();
  const netMatch = upperTerms.match(/NET\s*(\d+)/);

  if (netMatch) {
    return parseInt(netMatch[1], 10);
  }

  return null;
}

/**
 * Check if payment terms indicate NET payment
 */
export function isNetPayment(terms: string): boolean {
  return extractNetDays(terms) !== null;
}

/**
 * Determine which final sheet an RO should go to based on status and payment terms
 * Returns 'prompt' if user input is needed
 */
export function getFinalSheetForStatus(
  status: string,
  paymentTerms?: string
): SheetConfig | 'prompt' | null {
  const upperStatus = status.toUpperCase();

  // For RECEIVED status, check payment terms
  if (upperStatus === 'RECEIVED') {
    if (paymentTerms && isNetPayment(paymentTerms)) {
      return EXCEL_SHEETS.NET;
    } else if (paymentTerms) {
      // Has payment terms but not NET - assume regular payment
      return EXCEL_SHEETS.PAID;
    } else {
      // No payment terms - prompt user
      return 'prompt';
    }
  }

  // For PAID status, always go to PAID sheet
  if (upperStatus.includes('PAID') || upperStatus === 'PAYMENT SENT') {
    return EXCEL_SHEETS.PAID;
  }

  // For NET status, always go to NET sheet
  if (upperStatus === 'NET' || upperStatus.includes('NET')) {
    return EXCEL_SHEETS.NET;
  }

  // For returns/cancellations/scrapped
  if (upperStatus === 'BER' || upperStatus === 'RAI' || upperStatus === 'SCRAPPED' || upperStatus.includes('CANCEL')) {
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
export function getApprovalMessage(status: string, paymentTerms?: string): string {
  const sheet = getFinalSheetForStatus(status, paymentTerms);

  if (!sheet || sheet === 'prompt') {
    return '';
  }

  const netDays = extractNetDays(paymentTerms || '');

  switch (sheet.sheetName) {
    case 'Paid':
      return 'Have you received this part? It will be moved to the Paid archive.';
    case 'NET':
      if (netDays) {
        return `Have you received this part? It will be moved to the NET archive and a payment reminder will be created for ${netDays} days from today.`;
      }
      return 'Have you received this part? It will be moved to the NET archive.';
    case 'Returns':
      return 'Have you received this part? It will be moved to the Returns archive.';
    default:
      return 'Have you received this part? It will be archived.';
  }
}
