import { describe, it, expect, beforeEach, vi } from 'vitest';
import { excelService } from '../../src/lib/excelService'; // The Facade
import { resetSequence } from '../../src/test/factories';
import { configureMockAPI } from '../../src/test/msw-handlers';

// Mock MSAL (Authentication)
const mockMSAL = {
  getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@genthrust.net' }]),
  acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'fake-token' }),
  getActiveAccount: vi.fn().mockReturnValue({ username: 'test@genthrust.net' }),
} as any;

describe('Phase 1 Verification: ExcelService Facade', () => {
  beforeEach(() => {
    resetSequence();
    configureMockAPI.reset();
    // Inject the mock auth provider
    excelService.setMsalInstance(mockMSAL);
  });

  it('should successfully fetch Repair Orders via the new internal classes', async () => {
    // 1. Call the public API (Facade)
    const orders = await excelService.getRepairOrders();

    // 2. Verify it returns data (means GraphClient -> Repository connection works)
    expect(orders).toBeDefined();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
    
    // 3. Verify data mapping works (means Repository parsing works)
    const firstOrder = orders[0];
    expect(firstOrder).toHaveProperty('roNumber');
    expect(firstOrder.roNumber).toMatch(/^RO-/);
  });
});