import type { RepairOrder } from '../types';
import type { ShopAnalyticsProfile } from './analyticsEngine';
import { createLogger } from '../utils/logger';

const logger = createLogger('AnalyticsCache');

/**
 * Cache key generator for granular cache invalidation
 */
export interface CacheKeyOptions {
  type: 'shop' | 'global' | 'dateRange' | 'status' | 'shopList';
  shopName?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  shopNames?: string[];
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
  size: number; // Approximate size in bytes
  tags: Set<string>; // For granular invalidation
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  entryCount: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  averageEntryAge: number;
  totalEvictions: number;
  memoryUsage: number; // Estimated bytes
}

/**
 * Cache invalidation event
 */
export interface InvalidationEvent {
  reason: 'update' | 'create' | 'delete' | 'manual';
  affectedShops?: string[];
  affectedStatuses?: string[];
  timestamp: number;
}

/**
 * Advanced analytics cache manager with granular invalidation
 *
 * Features:
 * - Granular cache keys (shop, date range, status)
 * - Event-driven invalidation
 * - LRU eviction policy
 * - Cache warming for common queries
 * - Hit rate monitoring
 * - Tag-based invalidation
 */
export class AnalyticsCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;
  private maxMemory: number; // Max memory in bytes
  private ttl: number; // Time to live in ms
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    invalidations: number;
  };

  constructor(
    options: {
      maxSize?: number;
      maxMemory?: number; // In MB
      ttl?: number; // In ms
    } = {}
  ) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 100;
    this.maxMemory = (options.maxMemory || 50) * 1024 * 1024; // Convert MB to bytes
    this.ttl = options.ttl || 10 * 60 * 1000; // 10 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
    };

    logger.info('AnalyticsCache initialized', {
      maxSize: this.maxSize,
      maxMemoryMB: options.maxMemory || 50,
      ttlMinutes: this.ttl / 60000,
    });
  }

  /**
   * Generate cache key from options
   */
  generateKey(options: CacheKeyOptions): string {
    const parts = [options.type];

    switch (options.type) {
      case 'shop':
        parts.push(this.normalizeShopName(options.shopName || ''));
        break;
      case 'dateRange':
        parts.push(options.startDate || '', options.endDate || '');
        break;
      case 'status':
        parts.push(options.status || '');
        break;
      case 'shopList':
        parts.push(
          ...(options.shopNames || []).map(name => this.normalizeShopName(name)).sort()
        );
        break;
      case 'global':
        // No additional parts
        break;
    }

    return parts.join(':');
  }

  /**
   * Generate tags for cache entry (used for invalidation)
   */
  private generateTags(options: CacheKeyOptions): Set<string> {
    const tags = new Set<string>();

    // Add type tag
    tags.add(`type:${options.type}`);

    // Add specific tags
    if (options.shopName) {
      tags.add(`shop:${this.normalizeShopName(options.shopName)}`);
    }

    if (options.shopNames) {
      options.shopNames.forEach(name => {
        tags.add(`shop:${this.normalizeShopName(name)}`);
      });
    }

    if (options.status) {
      tags.add(`status:${options.status}`);
    }

    if (options.startDate || options.endDate) {
      tags.add('hasDateRange');
    }

    return tags;
  }

  /**
   * Normalize shop name for consistent keying
   */
  private normalizeShopName(name: string): string {
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s,]/g, '')
      .replace(/\s*,\s*/g, ',');
  }

  /**
   * Estimate size of data in bytes (approximation)
   */
  private estimateSize(data: any): number {
    const json = JSON.stringify(data);
    return json.length * 2; // UTF-16 characters = 2 bytes each (rough estimate)
  }

  /**
   * Get item from cache
   */
  get<T>(options: CacheKeyOptions): T | null {
    const key = this.generateKey(options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.debug('Cache miss', { key, type: options.type });
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug('Cache expired', { key, age: Date.now() - entry.timestamp });
      return null;
    }

    // Update access metadata
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    logger.debug('Cache hit', {
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp,
    });

    return entry.data as T;
  }

  /**
   * Set item in cache
   */
  set<T>(options: CacheKeyOptions, data: T): void {
    const key = this.generateKey(options);
    const size = this.estimateSize(data);
    const tags = this.generateTags(options);

    // Check memory limits before adding
    if (this.shouldEvict(size)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      hits: 0,
      lastAccessed: Date.now(),
      size,
      tags,
    };

    this.cache.set(key, entry);

    logger.debug('Cache set', {
      key,
      size,
      tags: Array.from(tags),
      totalEntries: this.cache.size,
    });
  }

  /**
   * Check if we should evict based on size/memory limits
   */
  private shouldEvict(newEntrySize: number): boolean {
    if (this.cache.size >= this.maxSize) {
      return true;
    }

    const currentMemory = this.getMemoryUsage();
    if (currentMemory + newEntrySize > this.maxMemory) {
      return true;
    }

    return false;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // Find LRU entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      logger.debug('Evicted LRU entry', {
        key: oldestKey,
        age: Date.now() - oldestTime,
      });
    }
  }

  /**
   * Invalidate cache entries by tags (event-driven)
   */
  invalidate(event: InvalidationEvent): number {
    const tagsToInvalidate = new Set<string>();

    // Build tags to invalidate based on event
    if (event.affectedShops) {
      event.affectedShops.forEach(shop => {
        tagsToInvalidate.add(`shop:${this.normalizeShopName(shop)}`);
      });
    }

    if (event.affectedStatuses) {
      event.affectedStatuses.forEach(status => {
        tagsToInvalidate.add(`status:${status}`);
      });
    }

    // Always invalidate global caches on updates
    if (event.reason === 'update' || event.reason === 'create' || event.reason === 'delete') {
      tagsToInvalidate.add('type:global');
      tagsToInvalidate.add('hasDateRange'); // Date ranges might be affected
    }

    // Find and remove matching entries
    let invalidatedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      // Check if entry has any of the tags to invalidate
      for (const tag of tagsToInvalidate) {
        if (entry.tags.has(tag)) {
          this.cache.delete(key);
          invalidatedCount++;
          break;
        }
      }
    }

    this.stats.invalidations += invalidatedCount;

    logger.info('Cache invalidated', {
      reason: event.reason,
      affectedShops: event.affectedShops,
      entriesInvalidated: invalidatedCount,
      tagsInvalidated: Array.from(tagsToInvalidate),
    });

    return invalidatedCount;
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
    logger.info('All cache entries invalidated', { entriesCleared: size });
  }

  /**
   * Warm cache with common queries
   */
  async warm(
    repairOrders: RepairOrder[],
    computeFn: (options: CacheKeyOptions) => Promise<any>
  ): Promise<void> {
    logger.info('Starting cache warming', { roCount: repairOrders.length });

    // Get unique shop names
    const shopNames = Array.from(new Set(repairOrders.map(ro => ro.shopName).filter(Boolean)));

    // Warm global analytics
    try {
      const globalData = await computeFn({ type: 'global' });
      this.set({ type: 'global' }, globalData);
      logger.debug('Warmed global cache');
    } catch (error) {
      logger.error('Failed to warm global cache', error);
    }

    // Warm top 10 shops (by RO count)
    const shopCounts = shopNames.reduce((acc, shop) => {
      acc[shop!] = repairOrders.filter(ro => ro.shopName === shop).length;
      return acc;
    }, {} as Record<string, number>);

    const topShops = Object.entries(shopCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([shop]) => shop);

    for (const shop of topShops) {
      try {
        const shopData = await computeFn({ type: 'shop', shopName: shop });
        this.set({ type: 'shop', shopName: shop }, shopData);
      } catch (error) {
        logger.error(`Failed to warm cache for shop: ${shop}`, error);
      }
    }

    logger.info('Cache warming completed', {
      globalWarmed: true,
      shopsWarmed: topShops.length,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = Date.now();

    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const totalRequests = totalHits + totalMisses;

    const ages = entries.map(e => now - e.timestamp);
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      size: this.cache.size,
      entryCount: this.cache.size,
      oldestEntry: ages.length > 0 ? Math.max(...ages) : null,
      newestEntry: ages.length > 0 ? Math.min(...ages) : null,
      averageEntryAge: avgAge,
      totalEvictions: this.stats.evictions,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * Get estimated memory usage in bytes
   */
  private getMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; hits: number; age: number; tags: string[] }> {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: now - entry.timestamp,
      tags: Array.from(entry.tags),
    }));
  }

  /**
   * Clear cache (for testing/admin purposes)
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared manually');
  }
}

// Singleton instance
export const analyticsCache = new AnalyticsCache({
  maxSize: 100,
  maxMemory: 50, // 50 MB
  ttl: 10 * 60 * 1000, // 10 minutes
});

/**
 * Helper: Create invalidation event for RO updates
 */
export function createInvalidationEvent(
  reason: InvalidationEvent['reason'],
  affectedROs: RepairOrder[]
): InvalidationEvent {
  const affectedShops = Array.from(new Set(affectedROs.map(ro => ro.shopName).filter(Boolean)));
  const affectedStatuses = Array.from(
    new Set(affectedROs.map(ro => ro.currentStatus).filter(Boolean))
  );

  return {
    reason,
    affectedShops: affectedShops as string[],
    affectedStatuses: affectedStatuses as string[],
    timestamp: Date.now(),
  };
}

/**
 * Helper: Invalidate cache when RO is updated
 */
export function invalidateCacheForRO(ro: RepairOrder, reason: InvalidationEvent['reason'] = 'update'): void {
  const event = createInvalidationEvent(reason, [ro]);
  analyticsCache.invalidate(event);
}

/**
 * Helper: Invalidate cache when multiple ROs are updated
 */
export function invalidateCacheForROs(
  ros: RepairOrder[],
  reason: InvalidationEvent['reason'] = 'update'
): void {
  const event = createInvalidationEvent(reason, ros);
  analyticsCache.invalidate(event);
}
