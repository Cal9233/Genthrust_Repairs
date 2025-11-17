/**
 * Microsoft Graph API Type Definitions
 *
 * Comprehensive type definitions for Graph API responses used throughout the application.
 * These types eliminate the need for "as any" assertions and provide full IDE autocomplete.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/overview
 */

/**
 * Common Graph API response wrapper
 */
export interface GraphAPIResponse<T> {
  value: T[];
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
}

/**
 * SharePoint Site response
 */
export interface GraphSiteResponse {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

/**
 * OneDrive/SharePoint Drive response
 */
export interface GraphDriveResponse {
  id: string;
  driveType: string;
  name: string;
  owner: {
    user?: {
      displayName: string;
      email?: string;
    };
  };
  quota?: {
    total: number;
    used: number;
    remaining: number;
  };
}

/**
 * File/DriveItem response from search or direct access
 */
export interface GraphFileResponse {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  '@microsoft.graph.downloadUrl'?: string;
  file?: {
    mimeType: string;
    hashes?: {
      sha1Hash?: string;
      quickXorHash?: string;
    };
  };
  createdBy?: {
    user: {
      displayName: string;
      email?: string;
    };
  };
  lastModifiedBy?: {
    user: {
      displayName: string;
      email?: string;
    };
  };
}

/**
 * Excel Workbook response
 */
export interface GraphWorkbookResponse {
  id: string;
  name: string;
  '@odata.context': string;
}

/**
 * Excel Worksheet response
 */
export interface GraphWorksheetResponse {
  id: string;
  name: string;
  position: number;
  visibility: 'Visible' | 'Hidden' | 'VeryHidden';
}

/**
 * Excel Table response
 */
export interface GraphTableResponse {
  id: string;
  name: string;
  showHeaders: boolean;
  showTotals: boolean;
  style: string;
  rowCount?: number;
}

/**
 * Excel Table Column response
 */
export interface GraphTableColumnResponse {
  id: string;
  name: string;
  index: number;
  values?: unknown[][];
}

/**
 * Excel Table Row response
 *
 * @description
 * The values property is a 2D array where:
 * - First dimension: always has one element (the row)
 * - Second dimension: contains the cell values for that row
 *
 * @example
 * {
 *   index: 0,
 *   values: [["RO-12345", "2025-01-15", "Duncan Aviation", ...]]
 * }
 */
export interface GraphTableRowResponse {
  index: number;
  values: unknown[][]; // 2D array: values[0] contains the row data
}

/**
 * Excel Session response (for workbook sessions)
 */
export interface GraphSessionResponse {
  id: string;
  persistChanges: boolean;
}

/**
 * Excel Range response
 */
export interface GraphRangeResponse {
  address: string;
  addressLocal: string;
  cellCount: number;
  columnCount: number;
  rowCount: number;
  columnIndex: number;
  rowIndex: number;
  values: unknown[][];
  formulas?: unknown[][];
  formulasLocal?: unknown[][];
  formulasR1C1?: unknown[][];
  numberFormat?: unknown[][];
  text?: unknown[][];
  valueTypes?: unknown[][];
}

/**
 * Graph API error response
 */
export interface GraphAPIError {
  error: {
    code: string;
    message: string;
    innerError?: {
      'request-id': string;
      date: string;
    };
  };
}

/**
 * Type guard to check if response is a Graph API error
 */
export function isGraphAPIError(response: unknown): response is GraphAPIError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as GraphAPIError).error === 'object' &&
    'code' in (response as GraphAPIError).error &&
    'message' in (response as GraphAPIError).error
  );
}

/**
 * Enhanced Error class for Graph API errors with status code
 */
export class GraphAPIException extends Error {
  public readonly status: number;
  public readonly statusCode: number;
  public readonly response: GraphAPIError | string;

  constructor(status: number, message: string, response: GraphAPIError | string) {
    super(message);
    this.name = 'GraphAPIException';
    this.status = status;
    this.statusCode = status;
    this.response = response;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphAPIException);
    }
  }
}

/**
 * Helper type for worksheet/table data structures used in inventory file hook
 */
export interface WorksheetData {
  name: string;
  position: number;
  visibility: string;
  tables: TableData[];
}

export interface TableData {
  name: string;
  rowCount?: number;
  columns: ColumnData[];
}

export interface ColumnData {
  name: string;
  index: number;
}
