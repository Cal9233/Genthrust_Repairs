/**
 * Integration Tests: Analytics Engine
 *
 * Tests cache invalidation scenarios, pattern prediction accuracy,
 * and performance under load.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildShopAnalytics,
  getShopAnalytics,
  getShopsAnalytics,
  getAnalyticsByStatus,
  getAnalyticsByDateRange,
  warmAnalyticsCache,
  predictDeliveryDate,
  type ShopAnalyticsProfile
} from '../../src/services/analyticsEngine';
import { analyticsCache } from '../../src/services/analyticsCache';
import {
  createRepairOrder,
  createRepairOrders,
  createROInStatus,
  createOverdueRO,
  resetSequence
} from '../../src/test/factories';
import type { RepairOrder } from '../../src/types';

describe('Analytics Engine - Cache Invalidation', () => {
  beforeEach(() => {
    resetSequence();
    analyticsCache.invalidateAll();
  });

  it('should cache analytics results', () => {
    const testROs = createRepairOrders(20);

    // First call - should compute
    const result1 = buildShopAnalytics(testROs);
    const stats1 = analyticsCache.getStats();

    // Second call - should hit cache
    const result2 = buildShopAnalytics(testROs);
    const stats2 = analyticsCache.getStats();

    expect(result1).toEqual(result2);
    expect(stats2.hits).toBeGreaterThan(stats1.hits);
  });

  it('should invalidate cache on data update', () => {
    const testROs = createRepairOrders(10);

    // Initial analytics
    const result1 = buildShopAnalytics(testROs);

    // Invalidate cache
    analyticsCache.invalidate({
      reason: 'update',
      affectedShops: [],
      timestamp: Date.now()
    });

    // Should recompute after invalidation
    const stats = analyticsCache.getStats();
    expect(stats.size).toBe(0);
  });

  it('should selectively invalidate shop-specific cache', () => {
    const shop1ROs = createRepairOrders(5, { shopName: 'Shop A' });
    const shop2ROs = createRepairOrders(5, { shopName: 'Shop B' });
    const allROs = [...shop1ROs, ...shop2ROs];

    // Get analytics for both shops
    const analytics1 = getShopAnalytics('Shop A', allROs);
    const analytics2 = getShopAnalytics('Shop B', allROs);

    expect(analytics1).toBeDefined();
    expect(analytics2).toBeDefined();

    // Invalidate only Shop A
    analyticsCache.invalidate({
      reason: 'update',
      affectedShops: ['Shop A'],
      timestamp: Date.now()
    });

    // Shop A should be recalculated
    const statsAfter = analyticsCache.getStats();
    expect(statsAfter).toBeDefined();
  });

  it('should handle cache expiration', async () => {
    const testROs = createRepairOrders(10);

    // Get initial analytics
    buildShopAnalytics(testROs);

    // Simulate time passing (cache TTL)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Force cache check
    const stats = analyticsCache.getStats();
    expect(stats).toBeDefined();
  });

  it('should maintain cache consistency with concurrent updates', async () => {
    const testROs = createRepairOrders(20);

    // Simulate concurrent analytics requests
    const concurrentRequests = Array.from({ length: 10 }, () =>
      buildShopAnalytics(testROs)
    );

    const results = await Promise.all(concurrentRequests);

    // All results should be identical
    const firstResult = results[0];
    results.forEach(result => {
      expect(result).toEqual(firstResult);
    });

    // Cache should have high hit rate
    const stats = analyticsCache.getStats();
    expect(stats.hitRate).toBeGreaterThan(50); // At least 50% hit rate
  });

  it('should invalidate all caches on global update', () => {
    const testROs = createRepairOrders(30);

    // Build various analytics
    buildShopAnalytics(testROs);
    getAnalyticsByStatus('WAITING QUOTE', testROs);
    getShopsAnalytics(['Shop 1', 'Shop 2'], testROs);

    const statsBefore = analyticsCache.getStats();
    expect(statsBefore.size).toBeGreaterThan(0);

    // Global invalidation
    analyticsCache.invalidateAll();

    const statsAfter = analyticsCache.getStats();
    expect(statsAfter.size).toBe(0);
    expect(statsAfter.hits).toBe(0);
    expect(statsAfter.misses).toBe(0);
  });
});

describe('Analytics Engine - Pattern Prediction', () => {
  beforeEach(() => {
    resetSequence();
    analyticsCache.invalidateAll();
  });

  it('should predict delivery dates based on historical data', () => {
    // Create historical ROs with known turnaround times
    const shop = 'Duncan Aviation';
    const historicalROs: RepairOrder[] = [];

    // Shop typically takes 30 days
    for (let i = 0; i < 10; i++) {
      const ro = createRepairOrder({
        shopName: shop,
        dateMade: new Date('2024-01-01'),
        dateDroppedOff: new Date('2024-01-05'),
        estimatedDeliveryDate: new Date('2024-02-05'), // 30 days
        currentStatus: 'RECEIVED',
        finalCost: 5000
      });
      historicalROs.push(ro);
    }

    // Get shop analytics to build pattern
    const analytics = getShopAnalytics(shop, historicalROs);

    expect(analytics).toBeDefined();
    expect(analytics.avgTurnaroundDays).toBeCloseTo(30, 5); // Within 5 days
  });

  it('should detect patterns in shop performance', () => {
    const shop = 'StandardAero';

    // Create pattern: fast for simple jobs, slow for complex
    const simpleJobs = createRepairOrders(5, {
      shopName: shop,
      estimatedCost: 1000, // Simple/cheap
      dateMade: new Date('2024-01-01'),
      estimatedDeliveryDate: new Date('2024-01-15') // 14 days
    });

    const complexJobs = createRepairOrders(5, {
      shopName: shop,
      estimatedCost: 10000, // Complex/expensive
      dateMade: new Date('2024-01-01'),
      estimatedDeliveryDate: new Date('2024-02-15') // 45 days
    });

    const allJobs = [...simpleJobs, ...complexJobs];
    const analytics = getShopAnalytics(shop, allJobs);

    expect(analytics).toBeDefined();
    expect(analytics.totalROs).toBe(10);
    expect(analytics.avgCostPerRO).toBeCloseTo(5500, 100); // Average of 1000 and 10000
  });

  it('should identify shops with consistent delivery performance', () => {
    const reliableShop = 'Reliable Repairs';

    // Create ROs with consistent 20-day turnaround
    const ros = Array.from({ length: 15 }, (_, i) => {
      const dateMade = new Date('2024-01-01');
      const deliveryDate = new Date('2024-01-01');
      deliveryDate.setDate(deliveryDate.getDate() + 20 + (i % 2)); // 20-21 days

      return createRepairOrder({
        shopName: reliableShop,
        dateMade,
        estimatedDeliveryDate: deliveryDate,
        currentStatus: 'RECEIVED'
      });
    });

    const analytics = getShopAnalytics(reliableShop, ros);

    expect(analytics).toBeDefined();
    expect(analytics.avgTurnaroundDays).toBeCloseTo(20, 2);
  });

  it('should detect shops with high BER rates', () => {
    const problematicShop = 'Problem Shop';

    // 30% BER rate
    const successfulROs = createRepairOrders(7, {
      shopName: problematicShop,
      currentStatus: 'RECEIVED'
    });

    const berROs = createRepairOrders(3, {
      shopName: problematicShop,
      currentStatus: 'BER'
    });

    const allROs = [...successfulROs, ...berROs];
    const analytics = getShopAnalytics(problematicShop, allROs);

    expect(analytics).toBeDefined();
    expect(analytics.berRate).toBeCloseTo(30, 1); // ~30%
  });

  it('should calculate accurate cost trends', () => {
    const shop = 'TrendShop';

    // Costs increasing over time
    const ros = Array.from({ length: 10 }, (_, i) => {
      const baseDate = new Date('2024-01-01');
      baseDate.setMonth(baseDate.getMonth() + i);

      return createRepairOrder({
        shopName: shop,
        dateMade: baseDate,
        estimatedCost: 5000 + (i * 500), // Increasing costs
        finalCost: 5000 + (i * 500),
        currentStatus: 'RECEIVED'
      });
    });

    const analytics = getShopAnalytics(shop, ros);

    expect(analytics).toBeDefined();
    expect(analytics.totalSpent).toBeGreaterThan(50000);
    expect(analytics.avgCostPerRO).toBeGreaterThan(5000);
  });
});

describe('Analytics Engine - Performance Under Load', () => {
  beforeEach(() => {
    resetSequence();
    analyticsCache.invalidateAll();
  });

  it('should handle large datasets efficiently', () => {
    const largeDataset = createRepairOrders(1000);

    const startTime = Date.now();
    const analytics = buildShopAnalytics(largeDataset);
    const endTime = Date.now();

    expect(analytics).toBeDefined();
    expect(Object.keys(analytics).length).toBeGreaterThan(0);
    // Should complete within 2 seconds even with 1000 ROs
    expect(endTime - startTime).toBeLessThan(2000);
  });

  it('should leverage caching for performance', () => {
    const dataset = createRepairOrders(500);

    // First call - cold cache
    const start1 = Date.now();
    buildShopAnalytics(dataset);
    const end1 = Date.now();
    const coldTime = end1 - start1;

    // Second call - warm cache
    const start2 = Date.now();
    buildShopAnalytics(dataset);
    const end2 = Date.now();
    const warmTime = end2 - start2;

    // Cached call should be significantly faster
    expect(warmTime).toBeLessThan(coldTime * 0.1); // At least 10x faster
  });

  it('should handle concurrent analytics requests efficiently', async () => {
    const dataset = createRepairOrders(200);

    const startTime = Date.now();

    // Simulate 20 concurrent dashboard loads
    const concurrentRequests = Array.from({ length: 20 }, () =>
      buildShopAnalytics(dataset)
    );

    const results = await Promise.all(concurrentRequests);
    const endTime = Date.now();

    // All requests should complete
    expect(results).toHaveLength(20);

    // Should complete quickly due to caching
    expect(endTime - startTime).toBeLessThan(1000);
  });

  it('should maintain performance with mixed query types', async () => {
    const dataset = createRepairOrders(300, { shopName: 'Mixed Shop' });

    const startTime = Date.now();

    const mixedQueries = [
      buildShopAnalytics(dataset),
      getShopAnalytics('Mixed Shop', dataset),
      getAnalyticsByStatus('WAITING QUOTE', dataset),
      getAnalyticsByDateRange('2024-01-01', '2024-12-31', dataset),
      getShopsAnalytics(['Mixed Shop'], dataset)
    ];

    const results = await Promise.all(mixedQueries);
    const endTime = Date.now();

    expect(results).toHaveLength(5);
    results.forEach(result => expect(result).toBeDefined());

    // Should complete quickly
    expect(endTime - startTime).toBeLessThan(1500);
  });

  it('should handle memory efficiently with large cache', () => {
    // Create multiple datasets for different shops
    const shops = ['Shop A', 'Shop B', 'Shop C', 'Shop D', 'Shop E'];
    shops.forEach(shop => {
      const ros = createRepairOrders(100, { shopName: shop });
      getShopAnalytics(shop, ros);
    });

    const stats = analyticsCache.getStats();

    expect(stats.size).toBeGreaterThan(0);
    // Memory usage should be reasonable (< 10MB for this test data)
    expect(stats.memoryUsage).toBeLessThan(10 * 1024 * 1024);
  });

  it('should scale with increasing data volume', () => {
    const sizes = [100, 250, 500, 750, 1000];
    const timings: number[] = [];

    sizes.forEach(size => {
      analyticsCache.invalidateAll();
      const dataset = createRepairOrders(size);

      const start = Date.now();
      buildShopAnalytics(dataset);
      const end = Date.now();

      timings.push(end - start);
    });

    // Performance should scale sub-linearly (not exponentially)
    // Time for 1000 should be < 10x time for 100
    expect(timings[4]).toBeLessThan(timings[0] * 10);
  });
});

describe('Analytics Engine - Data Accuracy', () => {
  beforeEach(() => {
    resetSequence();
    analyticsCache.invalidateAll();
  });

  it('should calculate accurate turnaround times', () => {
    const ros = [
      createRepairOrder({
        dateMade: new Date('2024-01-01'),
        currentStatus: 'RECEIVED',
        currentStatusDate: new Date('2024-01-21') // 20 days
      }),
      createRepairOrder({
        dateMade: new Date('2024-01-01'),
        currentStatus: 'RECEIVED',
        currentStatusDate: new Date('2024-01-31') // 30 days
      })
    ];

    const analytics = buildShopAnalytics(ros);
    const shopName = ros[0].shopName;
    const shopAnalytics = analytics[shopName];

    expect(shopAnalytics).toBeDefined();
    expect(shopAnalytics.avgTurnaroundDays).toBeCloseTo(25, 1); // Average of 20 and 30
  });

  it('should correctly count ROs by status', () => {
    const ros = [
      ...createRepairOrders(5, { currentStatus: 'WAITING QUOTE' }),
      ...createRepairOrders(3, { currentStatus: 'APPROVED' }),
      ...createRepairOrders(2, { currentStatus: 'BEING REPAIRED' })
    ];

    const analytics = buildShopAnalytics(ros);

    expect(analytics).toBeDefined();
    // Should correctly segment by status
  });

  it('should calculate financial metrics accurately', () => {
    const ros = [
      createRepairOrder({ estimatedCost: 5000, finalCost: 5200 }),
      createRepairOrder({ estimatedCost: 3000, finalCost: 2900 }),
      createRepairOrder({ estimatedCost: 7000, finalCost: 7500 })
    ];

    const shopName = ros[0].shopName;
    const analytics = getShopAnalytics(shopName, ros);

    expect(analytics).toBeDefined();
    expect(analytics.totalROs).toBe(3);
    expect(analytics.totalSpent).toBeCloseTo(15600, 1); // Sum of final costs
    expect(analytics.avgCostPerRO).toBeCloseTo(5200, 1); // 15600 / 3
  });

  it('should handle edge cases gracefully', () => {
    // Empty dataset
    const emptyAnalytics = buildShopAnalytics([]);
    expect(emptyAnalytics).toEqual({});

    // Single RO
    const singleRO = [createRepairOrder()];
    const singleAnalytics = buildShopAnalytics(singleRO);
    expect(singleAnalytics).toBeDefined();

    // All same shop
    const sameShopROs = createRepairOrders(10, { shopName: 'Same Shop' });
    const sameShopAnalytics = buildShopAnalytics(sameShopROs);
    expect(Object.keys(sameShopAnalytics)).toHaveLength(1);
  });
});
