import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buildShopAnalytics,
  getShopAnalytics,
  getShopsAnalytics,
  getAnalyticsByStatus,
  getAnalyticsByDateRange,
  warmAnalyticsCache,
  type ShopAnalyticsProfile,
} from '../services/analyticsEngine';
import { analyticsCache } from '../services/analyticsCache';
import type { RepairOrder } from '../types';
import { createLogger } from '../utils/logger';

const logger = createLogger('useAnalytics');

/**
 * Hook to get global shop analytics (all shops)
 */
export function useShopAnalytics(repairOrders: RepairOrder[] = []) {
  return useQuery({
    queryKey: ['analytics', 'global'],
    queryFn: () => {
      logger.debug('Building global shop analytics', {
        roCount: repairOrders.length,
      });
      return buildShopAnalytics(repairOrders);
    },
    enabled: repairOrders.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - cache handles staleness
  });
}

/**
 * Hook to get analytics for a specific shop
 */
export function useShopAnalyticsForShop(
  shopName: string,
  repairOrders: RepairOrder[] = []
) {
  return useQuery({
    queryKey: ['analytics', 'shop', shopName],
    queryFn: () => {
      logger.debug('Building shop analytics for specific shop', {
        shopName,
        roCount: repairOrders.length,
      });
      return getShopAnalytics(shopName, repairOrders);
    },
    enabled: !!shopName && repairOrders.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get analytics for multiple shops
 */
export function useShopAnalyticsForShops(
  shopNames: string[],
  repairOrders: RepairOrder[] = []
) {
  return useQuery({
    queryKey: ['analytics', 'shopList', shopNames.sort().join(',')],
    queryFn: () => {
      logger.debug('Building analytics for multiple shops', {
        shopCount: shopNames.length,
        roCount: repairOrders.length,
      });
      return getShopsAnalytics(shopNames, repairOrders);
    },
    enabled: shopNames.length > 0 && repairOrders.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get analytics filtered by status
 */
export function useAnalyticsByStatus(
  status: string,
  repairOrders: RepairOrder[] = []
) {
  return useQuery({
    queryKey: ['analytics', 'status', status],
    queryFn: () => {
      logger.debug('Building analytics by status', {
        status,
        roCount: repairOrders.length,
      });
      return getAnalyticsByStatus(status, repairOrders);
    },
    enabled: !!status && repairOrders.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to get analytics for a date range
 */
export function useAnalyticsByDateRange(
  startDate: string,
  endDate: string,
  repairOrders: RepairOrder[] = []
) {
  return useQuery({
    queryKey: ['analytics', 'dateRange', startDate, endDate],
    queryFn: () => {
      logger.debug('Building analytics by date range', {
        startDate,
        endDate,
        roCount: repairOrders.length,
      });
      return getAnalyticsByDateRange(startDate, endDate, repairOrders);
    },
    enabled: !!startDate && !!endDate && repairOrders.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to warm the analytics cache on initialization
 */
export function useWarmAnalyticsCache(repairOrders: RepairOrder[] = []) {
  return useQuery({
    queryKey: ['analytics', 'warm'],
    queryFn: async () => {
      logger.info('Warming analytics cache', {
        roCount: repairOrders.length,
      });
      await warmAnalyticsCache(repairOrders);
      return true;
    },
    enabled: repairOrders.length > 0,
    staleTime: Infinity, // Only warm once per session
    retry: false,
  });
}

/**
 * Hook to get cache statistics for monitoring
 */
export function useAnalyticsCacheStats() {
  return useQuery({
    queryKey: ['analytics', 'cache-stats'],
    queryFn: () => {
      const stats = analyticsCache.getStats();
      logger.debug('Cache statistics retrieved', {
        hitRate: stats.hitRate.toFixed(2) + '%',
        size: stats.size,
        memoryUsageMB: (stats.memoryUsage / 1024 / 1024).toFixed(2),
      });
      return stats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to invalidate analytics cache (useful for manual invalidation)
 */
export function useInvalidateAnalyticsCache() {
  const queryClient = useQueryClient();

  return () => {
    logger.info('Manually invalidating analytics cache');
    analyticsCache.invalidateAll();
    // Also invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };
}

/**
 * Hook to invalidate cache for specific shops
 */
export function useInvalidateShopAnalytics() {
  const queryClient = useQueryClient();

  return (shopNames: string[]) => {
    logger.info('Invalidating cache for specific shops', {
      shopCount: shopNames.length,
    });

    // Invalidate in our analytics cache
    analyticsCache.invalidate({
      reason: 'update',
      affectedShops: shopNames,
      timestamp: Date.now(),
    });

    // Invalidate React Query cache for affected shops
    shopNames.forEach((shopName) => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'shop', shopName] });
    });

    // Also invalidate global cache
    queryClient.invalidateQueries({ queryKey: ['analytics', 'global'] });
  };
}
