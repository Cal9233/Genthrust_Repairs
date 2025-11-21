/**
 * MSW (Mock Service Worker) Handlers
 *
 * Intercepts and mocks Microsoft Graph API requests for integration testing.
 * Provides realistic API responses with configurable delays and error scenarios.
 */

import { http, HttpResponse, delay } from 'msw';
import {
  createGraphTableRowsResponse,
  createGraphSessionResponse,
  createGraphFileResponse,
  createGraphSiteResponse,
  createGraphDriveResponse,
  createRepairOrder,
  createRepairOrders,
  createGraphTableRow
} from './factories';

// Base URL for Graph API
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

// In-memory storage for test data
let mockROData = createRepairOrders(5);
let mockSessions: Map<string, string> = new Map(); // sessionId -> fileId
let failureMode: 'none' | 'network' | 'auth' | 'rate-limit' | 'server-error' = 'none';
let networkDelay = 0;

/**
 * Configure mock behavior
 */
export const configureMockAPI = {
  setFailureMode: (mode: typeof failureMode) => {
    failureMode = mode;
  },
  setNetworkDelay: (ms: number) => {
    networkDelay = ms;
  },
  setROData: (data: any[]) => {
    mockROData = data;
  },
  reset: () => {
    failureMode = 'none';
    networkDelay = 0;
    mockROData = createRepairOrders(5);
    mockSessions.clear();
  }
};

/**
 * Helper to apply configured delay
 */
const applyDelay = async () => {
  if (networkDelay > 0) {
    await delay(networkDelay);
  }
};

/**
 * Helper to check for failure mode
 */
const checkFailureMode = () => {
  switch (failureMode) {
    case 'network':
      return HttpResponse.error();
    case 'auth':
      return HttpResponse.json(
        { error: { code: 'Unauthorized', message: 'Invalid authentication token' } },
        { status: 401 }
      );
    case 'rate-limit':
      return HttpResponse.json(
        { error: { code: 'TooManyRequests', message: 'Rate limit exceeded' } },
        { status: 429, headers: { 'Retry-After': '5' } }
      );
    case 'server-error':
      return HttpResponse.json(
        { error: { code: 'InternalServerError', message: 'An internal error occurred' } },
        { status: 500 }
      );
    default:
      return null;
  }
};

/**
 * MSW Request Handlers
 */
export const graphAPIHandlers = [
  // Get SharePoint site (using RegExp to handle colons in SharePoint site paths)
  // SharePoint URLs can be: /sites/hostname.sharepoint.com:/sites/sitename
  // The colon is not a path parameter, so we use RegExp to avoid MSW parsing issues
  http.get(new RegExp(`${GRAPH_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sites/.*`), async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphSiteResponse());
  }),

  // Get site drive
  http.get(`${GRAPH_BASE_URL}/sites/:siteId/drive`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphDriveResponse());
  }),

  // Search for file (using RegExp to handle OData query syntax in parentheses)
  // SharePoint search URLs use: /drives/{driveId}/root/search(q='filename')
  // We use RegExp to properly match the OData query syntax
  http.get(new RegExp(`${GRAPH_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/drives/[^/]+/root/search\\(.*\\)`), async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json({
      value: [createGraphFileResponse('Book.xlsx', 'file-book-xlsx')]
    });
  }),

  // Create workbook session (supports both patterns)
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/createSession`, async ({ params }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const session = createGraphSessionResponse();
    mockSessions.set(session.id, params.fileId as string);
    return HttpResponse.json(session);
  }),

  // Close workbook session (supports both patterns)
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/closeSession`, async ({ request, params }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const sessionId = request.headers.get('workbook-session-id');
    if (sessionId) {
      mockSessions.delete(sessionId);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Get file info (for getFileInfo method)
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId`, async ({ params }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphFileResponse('Book.xlsx', params.fileId as string));
  }),

  // Get workbook tables (for listTables method)
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json({
      value: [
        { id: 'table-1', name: 'RepairTable', rowCount: mockROData.length },
        { id: 'table-2', name: 'Paid', rowCount: 0 },
        { id: 'table-3', name: 'NET', rowCount: 0 },
        { id: 'table-4', name: 'Returns', rowCount: 0 }
      ]
    });
  }),

  // Get table rows (supports both patterns)
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphTableRowsResponse(mockROData));
  }),

  // Get table rows from specific worksheet
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/worksheets/:sheetName/tables/:tableName/rows`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphTableRowsResponse([])); // Archive sheets start empty
  }),

  // Get specific row by index (improved wildcard handling)
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows/*`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const url = new URL(request.url);
    const indexMatch = url.pathname.match(/itemAt\(index=(\d+)\)/);
    const index = indexMatch ? parseInt(indexMatch[1]) : 0;

    if (index >= mockROData.length) {
      return HttpResponse.json(
        { error: { code: 'ItemNotFound', message: 'Row not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json(createGraphTableRow(mockROData[index]));
  }),

  // Add table row (supports standard add endpoint)
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows/add`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const body = await request.json() as any;
    const newRO = createRepairOrder();
    mockROData.push(newRO);

    return HttpResponse.json(createGraphTableRow(newRO), { status: 201 });
  }),

  // Add table row to specific worksheet
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/worksheets/:sheetName/tables/:tableName/rows/add`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const body = await request.json() as any;
    const newRO = createRepairOrder();

    return HttpResponse.json(createGraphTableRow(newRO), { status: 201 });
  }),

  // Update table row (improved wildcard handling)
  http.patch(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows/*`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const url = new URL(request.url);
    const indexMatch = url.pathname.match(/itemAt\(index=(\d+)\)/);
    const index = indexMatch ? parseInt(indexMatch[1]) : 0;

    if (index >= mockROData.length) {
      return HttpResponse.json(
        { error: { code: 'ItemNotFound', message: 'Row not found' } },
        { status: 404 }
      );
    }

    const body = await request.json() as any;
    // Update the mock data (simplified) - Phase 2: Support archiveStatus
    if (body.values && body.values[0]) {
      const values = body.values[0];
      mockROData[index] = {
        ...mockROData[index],
        currentStatus: values[13] || mockROData[index].currentStatus,
        notes: values[18] || mockROData[index].notes,
        archiveStatus: values[21] || mockROData[index].archiveStatus, // Column 21
      };
    }

    return HttpResponse.json(createGraphTableRow(mockROData[index]));
  }),

  // Delete table row (improved wildcard handling)
  http.delete(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows/*`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const url = new URL(request.url);
    const indexMatch = url.pathname.match(/itemAt\(index=(\d+)\)/);
    const index = indexMatch ? parseInt(indexMatch[1]) : 0;

    if (index >= mockROData.length) {
      return HttpResponse.json(
        { error: { code: 'ItemNotFound', message: 'Row not found' } },
        { status: 404 }
      );
    }

    mockROData.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Worksheets endpoint (for AI logging setup)
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/worksheets/:worksheetName`, async ({ params }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    // Return worksheet info if it exists, 404 if not
    if (params.worksheetName === 'Logs') {
      return HttpResponse.json({
        id: 'worksheet-logs',
        name: 'Logs',
        position: 0,
        visibility: 'visible'
      });
    }

    return HttpResponse.json(
      { error: { code: 'ItemNotFound', message: 'Worksheet not found' } },
      { status: 404 }
    );
  }),

  // Add worksheet (for AI logging setup)
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/worksheets/add`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const body = await request.json() as any;
    return HttpResponse.json({
      id: 'worksheet-new',
      name: body.name || 'NewSheet',
      position: 0,
      visibility: 'visible'
    }, { status: 201 });
  }),

  // Inventory search (backend API)
  http.get('http://localhost:3001/api/inventory/search', async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const url = new URL(request.url);
    const partNumber = url.searchParams.get('partNumber') || '';

    // Mock inventory results
    const results = [
      {
        indexId: 1,
        partNumber: partNumber,
        tableName: 'stock_room',
        rowId: 1,
        serialNumber: 'SN-12345',
        qty: 5,
        condition: 'OH',
        location: 'BIN-A1',
        description: 'Test part',
        lastSeen: new Date().toISOString()
      }
    ];

    return HttpResponse.json(results);
  }),

  // Inventory sync status
  http.get('http://localhost:3001/api/inventory/sync-status', async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json({
      lastSync: new Date().toISOString(),
      status: 'success',
      recordsIndexed: 1500
    });
  })
];

/**
 * Error scenario handlers (for testing error handling)
 */
export const errorScenarioHandlers = {
  networkError: () => {
    configureMockAPI.setFailureMode('network');
  },
  authError: () => {
    configureMockAPI.setFailureMode('auth');
  },
  rateLimitError: () => {
    configureMockAPI.setFailureMode('rate-limit');
  },
  serverError: () => {
    configureMockAPI.setFailureMode('server-error');
  },
  reset: () => {
    configureMockAPI.setFailureMode('none');
  }
};
