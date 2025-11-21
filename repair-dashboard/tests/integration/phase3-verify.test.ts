/**
 * Phase 3 Verification Test
 *
 * Verifies that the frontend is correctly calling the new MySQL Backend API
 * instead of the old Excel-based API.
 *
 * Tests:
 * 1. Read operations call GET /api/ros?archiveStatus=ACTIVE
 * 2. Write operations call POST /api/ros
 * 3. Archive operations call PATCH /api/ros/:id with archiveStatus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../src/test/setup';
import { repairOrderService } from '../../src/services/repairOrderService';
import { createRepairOrder, resetSequence } from '../../src/test/factories';
import type { RepairOrder } from '../../src/types';

// Track API calls
const apiCalls: { method: string; url: string; body?: any }[] = [];

// Helper to record API calls
const recordAPICall = (method: string, url: string, body?: any) => {
  apiCalls.push({ method, url, body });
};

// Mock handlers that record calls (add to existing server)
const verificationHandlers = [
  // GET /api/ros?archiveStatus=ACTIVE
  http.get('*/api/ros', async ({ request }) => {
    const url = new URL(request.url);
    recordAPICall('GET', `/api/ros?${url.searchParams.toString()}`);

    const archiveStatus = url.searchParams.get('archiveStatus') || 'ACTIVE';

    const mockROs = [
      createRepairOrder({
        id: 'test-1',
        roNumber: 'RO-00001',
        archiveStatus: archiveStatus as any
      }),
      createRepairOrder({
        id: 'test-2',
        roNumber: 'RO-00002',
        archiveStatus: archiveStatus as any
      })
    ].map(ro => ({
      ...ro,
      dateMade: ro.dateMade?.toISOString() || null,
      dateDroppedOff: ro.dateDroppedOff?.toISOString() || null,
      estimatedDeliveryDate: ro.estimatedDeliveryDate?.toISOString() || null,
      currentStatusDate: ro.currentStatusDate?.toISOString() || null,
      lastDateUpdated: ro.lastDateUpdated?.toISOString() || null,
      nextDateToUpdate: ro.nextDateToUpdate?.toISOString() || null,
    }));

    return HttpResponse.json(mockROs);
  }),

  // POST /api/ros
  http.post('*/api/ros', async ({ request }) => {
    const body = await request.json();
    recordAPICall('POST', '/api/ros', body);

    const newRO = createRepairOrder({
      id: 'test-new',
      roNumber: (body as any).roNumber,
      shopName: (body as any).shopName,
      partDescription: (body as any).partDescription,
    });

    return HttpResponse.json(
      {
        ...newRO,
        dateMade: newRO.dateMade?.toISOString() || null,
        dateDroppedOff: newRO.dateDroppedOff?.toISOString() || null,
        estimatedDeliveryDate: newRO.estimatedDeliveryDate?.toISOString() || null,
        currentStatusDate: newRO.currentStatusDate?.toISOString() || null,
        lastDateUpdated: newRO.lastDateUpdated?.toISOString() || null,
        nextDateToUpdate: newRO.nextDateToUpdate?.toISOString() || null,
      },
      { status: 201 }
    );
  }),

  // PATCH /api/ros/:id
  http.patch('*/api/ros/:id', async ({ params, request }) => {
    const body = await request.json();
    recordAPICall('PATCH', `/api/ros/${params.id}`, body);

    const updatedRO = createRepairOrder({
      id: params.id as string,
      ...(body as any)
    });

    return HttpResponse.json({
      ...updatedRO,
      dateMade: updatedRO.dateMade?.toISOString() || null,
      dateDroppedOff: updatedRO.dateDroppedOff?.toISOString() || null,
      estimatedDeliveryDate: updatedRO.estimatedDeliveryDate?.toISOString() || null,
      currentStatusDate: updatedRO.currentStatusDate?.toISOString() || null,
      lastDateUpdated: updatedRO.lastDateUpdated?.toISOString() || null,
      nextDateToUpdate: updatedRO.nextDateToUpdate?.toISOString() || null,
    });
  }),

  // DELETE /api/ros/:id
  http.delete('*/api/ros/:id', async ({ params }) => {
    recordAPICall('DELETE', `/api/ros/${params.id}`);

    return HttpResponse.json({
      success: true,
      message: 'Repair order deleted successfully'
    });
  }),

  // GET /api/ros/stats/dashboard
  http.get('*/api/ros/stats/dashboard', async ({ request }) => {
    recordAPICall('GET', '/api/ros/stats/dashboard');

    return HttpResponse.json({
      totalActive: 2,
      overdue: 0,
      waitingQuote: 1,
      approved: 1,
      beingRepaired: 0,
      shipping: 0,
      dueToday: 0,
      overdue30Plus: 0,
      onTrack: 2,
      totalValue: 10000,
      totalEstimatedValue: 10000,
      totalFinalValue: 0,
      approvedPaid: 0,
      approvedNet: 0,
      rai: 0,
      ber: 0,
      cancel: 0,
      scrapped: 0,
    });
  })
];

describe('Phase 3 Verification: MySQL Backend Integration', () => {
  beforeEach(() => {
    // Reset API call tracking
    apiCalls.length = 0;

    // Reset factory sequence
    resetSequence();

    // Add verification handlers to existing global server
    server.use(...verificationHandlers);
  });

  describe('Test 1: Read Operations', () => {
    it('should call GET /api/ros?archiveStatus=ACTIVE when fetching active repair orders', async () => {
      // Act: Call the service method
      const result = await repairOrderService.getRepairOrders('ACTIVE');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'GET',
        url: '/api/ros?archiveStatus=ACTIVE'
      });

      // Assert: Verify data is returned correctly
      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('roNumber');
      expect(result[0]).toHaveProperty('archiveStatus', 'ACTIVE');
    });

    it('should call GET /api/ros?archiveStatus=PAID when fetching archived repair orders', async () => {
      // Act: Fetch archived ROs from PAID sheet
      const result = await repairOrderService.getArchivedROs('Paid');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'GET',
        url: '/api/ros?archiveStatus=PAID'
      });

      // Assert: Verify data is returned
      expect(result).toBeInstanceOf(Array);
    });

    it('should call GET /api/ros?archiveStatus=NET when fetching NET archived repair orders', async () => {
      // Act: Fetch archived ROs from NET sheet
      const result = await repairOrderService.getArchivedROs('NET');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'GET',
        url: '/api/ros?archiveStatus=NET'
      });
    });

    it('should call GET /api/ros?archiveStatus=RETURNED when fetching Returns archived repair orders', async () => {
      // Act: Fetch archived ROs from Returns sheet
      const result = await repairOrderService.getArchivedROs('Returns');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'GET',
        url: '/api/ros?archiveStatus=RETURNED'
      });
    });

    it('should convert ISO date strings to Date objects', async () => {
      // Act: Fetch repair orders
      const result = await repairOrderService.getRepairOrders('ACTIVE');

      // Assert: Verify dates are converted to Date objects
      expect(result[0].dateMade).toBeInstanceOf(Date);
      expect(result[0].currentStatusDate).toBeInstanceOf(Date);
      expect(result[0].lastDateUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Test 2: Write Operations', () => {
    it('should call POST /api/ros when creating a new repair order', async () => {
      // Arrange: Prepare new RO data
      const newROData = {
        roNumber: 'RO-TEST-001',
        shopName: 'Test Shop',
        partDescription: 'Test Part',
        partNumber: 'PN-TEST',
        serialNumber: 'SN-TEST',
        requiredWork: 'Test work',
        estimatedCost: 1000,
        currentStatus: 'TO SEND'
      };

      // Act: Create repair order
      const result = await repairOrderService.addRepairOrder(newROData);

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'POST',
        url: '/api/ros'
      });

      // Assert: Verify request body contains the data
      expect(apiCalls[0].body).toMatchObject({
        roNumber: 'RO-TEST-001',
        shopName: 'Test Shop',
        partDescription: 'Test Part'
      });

      // Assert: Verify returned data
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('roNumber', 'RO-TEST-001');
    });

    it('should call PATCH /api/ros/:id when updating a repair order', async () => {
      // Arrange: Prepare update data
      const updates = {
        currentStatus: 'APPROVED',
        estimatedCost: 2000,
        notes: 'Updated notes'
      };

      // Act: Update repair order
      const result = await repairOrderService.updateRepairOrder('test-123', updates);

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'PATCH',
        url: '/api/ros/test-123'
      });

      // Assert: Verify request body contains the updates
      expect(apiCalls[0].body).toMatchObject({
        currentStatus: 'APPROVED',
        estimatedCost: 2000,
        notes: 'Updated notes'
      });
    });

    it('should call DELETE /api/ros/:id when deleting a repair order', async () => {
      // Act: Delete repair order
      await repairOrderService.deleteRepairOrder('test-456');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'DELETE',
        url: '/api/ros/test-456'
      });
    });

    it('should convert Date objects to ISO strings in POST requests', async () => {
      // Arrange: Create RO with Date objects
      const newROData = {
        roNumber: 'RO-DATE-TEST',
        shopName: 'Test Shop',
        partDescription: 'Test Part',
        dateMade: new Date('2024-01-15'),
        currentStatusDate: new Date('2024-01-20'),
        currentStatus: 'TO SEND'
      };

      // Act: Create repair order
      await repairOrderService.addRepairOrder(newROData);

      // Assert: Verify dates are converted to ISO strings
      expect(apiCalls[0].body.dateMade).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(apiCalls[0].body.currentStatusDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('Test 3: Archive Operations', () => {
    it('should call PATCH /api/ros/:id with archiveStatus=PAID when archiving to PAID', async () => {
      // Act: Archive repair order to PAID
      const result = await repairOrderService.archiveRepairOrder('test-789', 'PAID');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'PATCH',
        url: '/api/ros/test-789'
      });

      // Assert: Verify request body contains archiveStatus
      expect(apiCalls[0].body).toMatchObject({
        archiveStatus: 'PAID'
      });
    });

    it('should call PATCH /api/ros/:id with archiveStatus=NET when archiving to NET', async () => {
      // Act: Archive repair order to NET
      await repairOrderService.archiveRepairOrder('test-101', 'NET');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'PATCH',
        url: '/api/ros/test-101'
      });

      // Assert: Verify request body contains archiveStatus
      expect(apiCalls[0].body).toMatchObject({
        archiveStatus: 'NET'
      });
    });

    it('should call PATCH /api/ros/:id with archiveStatus=RETURNED when archiving to Returns', async () => {
      // Act: Archive repair order to RETURNED
      await repairOrderService.archiveRepairOrder('test-202', 'RETURNED');

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'PATCH',
        url: '/api/ros/test-202'
      });

      // Assert: Verify request body contains archiveStatus
      expect(apiCalls[0].body).toMatchObject({
        archiveStatus: 'RETURNED'
      });
    });
  });

  describe('Test 4: Dashboard Statistics', () => {
    it('should call GET /api/ros/stats/dashboard when fetching dashboard stats', async () => {
      // Act: Fetch dashboard statistics
      const result = await repairOrderService.getDashboardStats();

      // Assert: Verify the correct API endpoint was called
      expect(apiCalls).toHaveLength(1);
      expect(apiCalls[0]).toMatchObject({
        method: 'GET',
        url: '/api/ros/stats/dashboard'
      });

      // Assert: Verify returned stats structure
      expect(result).toHaveProperty('totalActive');
      expect(result).toHaveProperty('overdue');
      expect(result).toHaveProperty('waitingQuote');
      expect(result).toHaveProperty('approved');
      expect(result).toHaveProperty('totalValue');
      expect(result).toHaveProperty('approvedPaid');
      expect(result).toHaveProperty('approvedNet');
    });
  });

  describe('Test 5: NOT calling old Excel API', () => {
    it('should NOT call Microsoft Graph API endpoints', async () => {
      // Act: Perform various operations
      await repairOrderService.getRepairOrders('ACTIVE');

      // Assert: Verify NO Graph API calls were made
      const graphAPICalls = apiCalls.filter(call =>
        call.url.includes('graph.microsoft.com') ||
        call.url.includes('workbook/tables')
      );

      expect(graphAPICalls).toHaveLength(0);
    });

    it('should use database ID format (not "row-X" format)', async () => {
      // Act: Create and fetch repair orders
      const result = await repairOrderService.getRepairOrders('ACTIVE');

      // Assert: Verify IDs do not follow old "row-X" format
      result.forEach(ro => {
        expect(ro.id).not.toMatch(/^row-\d+$/);
      });
    });
  });
});
