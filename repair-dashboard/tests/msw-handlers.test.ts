/**
 * MSW (Mock Service Worker) Handlers
 *
 * Intercepts and mocks Microsoft Graph API requests for integration testing.
 * Updated for Phase 1 Architecture (GraphClient & Repository).
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
  // Get SharePoint site - Fixed Wildcard
  http.get(`${GRAPH_BASE_URL}/sites/*`, async () => {
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

  // Search for file - Fixed Wildcard
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/root/search*`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json({
      value: [createGraphFileResponse('Book.xlsx', 'file-book-xlsx')]
    });
  }),

  // Create workbook session - Updated Path to /drives/:id
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/createSession`, async ({ params }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const session = createGraphSessionResponse();
    mockSessions.set(session.id, params.fileId as string);
    return HttpResponse.json(session);
  }),

  // Close workbook session - Updated Path
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/closeSession`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const sessionId = request.headers.get('workbook-session-id');
    if (sessionId) {
      mockSessions.delete(sessionId);
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Get table rows - Updated Path
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows`, async () => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    return HttpResponse.json(createGraphTableRowsResponse(mockROData));
  }),

  // Get specific row - Fixed Wildcard & Path
  http.get(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows/*`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    // Extract index manually since wildcards are tricky
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

  // Add table row - Updated Path
  http.post(`${GRAPH_BASE_URL}/drives/:driveId/items/:fileId/workbook/tables/:tableName/rows`, async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const newRO = createRepairOrder();
    mockROData.push(newRO);

    return HttpResponse.json(createGraphTableRow(newRO), { status: 201 });
  }),

  // Update table row - Updated Path
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
    if (body.values && body.values[0]) {
      const values = body.values[0];
      // Simple update simulation
      mockROData[index] = {
        ...mockROData[index],
        currentStatus: values[13] || mockROData[index].currentStatus
      };
    }

    return HttpResponse.json(createGraphTableRow(mockROData[index]));
  }),

  // Inventory search (backend API)
  http.get('http://localhost:3001/api/inventory/search', async ({ request }) => {
    await applyDelay();
    const failure = checkFailureMode();
    if (failure) return failure;

    const url = new URL(request.url);
    const partNumber = url.searchParams.get('partNumber') || '';

    const results = [
      {
        indexId: 1,
        partNumber: partNumber || 'PN-123',
        tableName: 'stock_room',
        qty: 5,
        description: 'Test part',
        lastSeen: new Date().toISOString()
      }
    ];

    return HttpResponse.json(results);
  })
];

export const errorScenarioHandlers = {
  networkError: () => configureMockAPI.setFailureMode('network'),
  authError: () => configureMockAPI.setFailureMode('auth'),
  rateLimitError: () => configureMockAPI.setFailureMode('rate-limit'),
  serverError: () => configureMockAPI.setFailureMode('server-error'),
  reset: () => configureMockAPI.setFailureMode('none')
};