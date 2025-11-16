import { median, medianAbsoluteDeviation } from 'simple-statistics';
import type { RepairOrder } from '../types';

// State center coordinates for distance calculation
const STATE_COORDS: Record<string, { lat: number; lon: number }> = {
  AL: { lat: 32.806671, lon: -86.791130 }, AK: { lat: 61.370716, lon: -152.404419 },
  AZ: { lat: 33.729759, lon: -111.431221 }, AR: { lat: 34.969704, lon: -92.373123 },
  CA: { lat: 36.116203, lon: -119.681564 }, CO: { lat: 39.059811, lon: -105.311104 },
  CT: { lat: 41.597782, lon: -72.755371 }, DE: { lat: 39.318523, lon: -75.507141 },
  FL: { lat: 27.766279, lon: -81.686783 }, GA: { lat: 33.040619, lon: -83.643074 },
  HI: { lat: 21.094318, lon: -157.498337 }, ID: { lat: 44.240459, lon: -114.478828 },
  IL: { lat: 40.349457, lon: -88.986137 }, IN: { lat: 39.849426, lon: -86.258278 },
  IA: { lat: 42.011539, lon: -93.210526 }, KS: { lat: 38.526600, lon: -96.726486 },
  KY: { lat: 37.668140, lon: -84.670067 }, LA: { lat: 31.169546, lon: -91.867805 },
  ME: { lat: 44.693947, lon: -69.381927 }, MD: { lat: 39.063946, lon: -76.802101 },
  MA: { lat: 42.230171, lon: -71.530106 }, MI: { lat: 43.326618, lon: -84.536095 },
  MN: { lat: 45.694454, lon: -93.900192 }, MS: { lat: 32.741646, lon: -89.678696 },
  MO: { lat: 38.456085, lon: -92.288368 }, MT: { lat: 46.921925, lon: -110.454353 },
  NE: { lat: 41.125370, lon: -98.268082 }, NV: { lat: 38.313515, lon: -117.055374 },
  NH: { lat: 43.452492, lon: -71.563896 }, NJ: { lat: 40.298904, lon: -74.521011 },
  NM: { lat: 34.840515, lon: -106.248482 }, NY: { lat: 42.165726, lon: -74.948051 },
  NC: { lat: 35.630066, lon: -79.806419 }, ND: { lat: 47.528912, lon: -99.784012 },
  OH: { lat: 40.388783, lon: -82.764915 }, OK: { lat: 35.565342, lon: -96.928917 },
  OR: { lat: 44.572021, lon: -122.070938 }, PA: { lat: 40.590752, lon: -77.209755 },
  RI: { lat: 41.680893, lon: -71.511780 }, SC: { lat: 33.856892, lon: -80.945007 },
  SD: { lat: 44.299782, lon: -99.438828 }, TN: { lat: 35.747845, lon: -86.692345 },
  TX: { lat: 31.054487, lon: -97.563461 }, UT: { lat: 40.150032, lon: -111.862434 },
  VT: { lat: 44.045876, lon: -72.710686 }, VA: { lat: 37.769337, lon: -78.169968 },
  WA: { lat: 47.400902, lon: -121.490494 }, WV: { lat: 38.491226, lon: -80.954453 },
  WI: { lat: 44.268543, lon: -89.616508 }, WY: { lat: 42.755966, lon: -107.302490 },
};

// GenThrust headquarters (Florida)
const GENTHRUST_HQ = { lat: 27.766279, lon: -81.686783 };

export interface ShopAnalyticsProfile {
  shopName: string;
  state: string;

  shippingDays: {
    avg: number;
    min: number;
    max: number;
  };

  // Core metrics
  medianTurnaround: number;
  medianSegmentTimes: {
    send_to_inshop: number;
    inshop_to_completed: number;
    completed_to_received: number;
  };
  statusVelocity: Record<string, number>;
  variance: number;

  // Trend indicator
  trend: 'improving' | 'stable' | 'declining';
  recentMedian: number;
  overallMedian: number;

  // Activity
  activeROs: string[];
  totalROs: number;
}

export interface PredictionResult {
  estimatedDate: Date;
  confidenceDays: number;
  status: 'on-track' | 'at-risk' | 'overdue';
}

// Cache for shop analytics profiles
interface CacheEntry {
  profiles: Map<string, ShopAnalyticsProfile>;
  timestamp: number;
}

let analyticsCache: CacheEntry | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize shop name to handle duplicates with slight variations
 */
function normalizeShopName(name: string): string {
  if (!name) return '';

  return name
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')      // Multiple spaces → single space
    .replace(/[^\w\s,]/g, '')  // Remove special characters except comma (for state)
    .replace(/\s*,\s*/g, ','); // Normalize comma spacing
}

/**
 * Calculate Haversine distance between two points in miles
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate shipping time based on distance buckets
 */
function estimateShippingTime(state: string): { avg: number; min: number; max: number } {
  const coords = STATE_COORDS[state];

  if (!coords) {
    // Default for unknown states
    return { avg: 3, min: 2, max: 4 };
  }

  const distance = haversineDistance(
    GENTHRUST_HQ.lat,
    GENTHRUST_HQ.lon,
    coords.lat,
    coords.lon
  );

  if (distance < 400) {
    return { avg: 1.5, min: 1, max: 2 };
  } else if (distance < 900) {
    return { avg: 2.5, min: 2, max: 3 };
  } else if (distance < 1500) {
    return { avg: 3.5, min: 3, max: 4 };
  } else {
    return { avg: 5, min: 4, max: 6 };
  }
}

/**
 * Calculate turnaround time for a completed RO in days
 */
function calculateTurnaround(ro: RepairOrder): number | null {
  if (!ro.dateDroppedOff || !ro.currentStatusDate) {
    return null;
  }

  const start = new Date(ro.dateDroppedOff).getTime();
  const end = new Date(ro.currentStatusDate).getTime();

  if (isNaN(start) || isNaN(end)) {
    return null;
  }

  return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since a specific date
 */
function daysSince(date: Date | null): number | null {
  if (!date) return null;
  const start = new Date(date).getTime();
  if (isNaN(start)) return null;
  return Math.max(0, (Date.now() - start) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate trend: improving/stable/declining
 */
function calculateTrend(
  recentMedian: number,
  overallMedian: number
): 'improving' | 'stable' | 'declining' {
  if (recentMedian < overallMedian * 0.9) return 'improving';
  if (recentMedian > overallMedian * 1.1) return 'declining';
  return 'stable';
}

/**
 * Build analytics profile for a single shop
 */
function buildShopProfile(
  shopName: string,
  ros: RepairOrder[]
): ShopAnalyticsProfile | null {
  if (ros.length === 0) return null;

  // Extract state from first RO
  const state = ros[0].shopName?.split(',')[1]?.trim() || '';

  // Calculate shipping estimates
  const shippingDays = estimateShippingTime(state);

  // Calculate turnaround times for completed ROs
  const completedROs = ros.filter((ro) => ro.currentStatus?.includes('COMPLETED') || ro.currentStatus?.includes('RECEIVED'));
  const turnarounds = completedROs
    .map(calculateTurnaround)
    .filter((t): t is number => t !== null && t > 0);

  let medianTurnaround = 0;
  let variance = 0;

  if (turnarounds.length > 0) {
    // Use actual completed RO data
    medianTurnaround = median(turnarounds);
    variance = turnarounds.length > 1 ? medianAbsoluteDeviation(turnarounds) : 0;
  } else {
    // Fallback: Calculate elapsed time for active ROs (for shops with no completed ROs yet)
    const activeElapsedTimes = ros
      .filter((ro) => !ro.currentStatus?.includes('COMPLETED') && !ro.currentStatus?.includes('RECEIVED'))
      .map((ro) => daysSince(ro.dateDroppedOff))
      .filter((t): t is number => t !== null && t > 0);

    if (activeElapsedTimes.length > 0) {
      medianTurnaround = median(activeElapsedTimes);
      variance = activeElapsedTimes.length > 1 ? medianAbsoluteDeviation(activeElapsedTimes) : 0;
    }
  }

  // Calculate recent median (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTurnarounds = ros
    .filter((ro) => {
      const statusDate = ro.currentStatusDate ? new Date(ro.currentStatusDate).getTime() : 0;
      return statusDate > thirtyDaysAgo && (ro.currentStatus?.includes('COMPLETED') || ro.currentStatus?.includes('RECEIVED'));
    })
    .map(calculateTurnaround)
    .filter((t): t is number => t !== null);

  const recentMedian = recentTurnarounds.length > 0 ? median(recentTurnarounds) : medianTurnaround;
  const overallMedian = medianTurnaround;

  // Calculate trend
  const trend = calculateTrend(recentMedian, overallMedian);

  // Calculate segment times (simplified - using status history if available)
  const medianSegmentTimes = {
    send_to_inshop: 0,
    inshop_to_completed: 0,
    completed_to_received: 0,
  };

  // Calculate status velocity (days per status)
  const statusVelocity: Record<string, number> = {};
  const statusGroups = ros.reduce((acc, ro) => {
    const status = ro.currentStatus || 'UNKNOWN';
    if (!acc[status]) acc[status] = [];
    const days = daysSince(ro.currentStatusDate);
    if (days !== null) acc[status].push(days);
    return acc;
  }, {} as Record<string, number[]>);

  for (const [status, days] of Object.entries(statusGroups)) {
    statusVelocity[status] = days.length > 0 ? median(days) : 0;
  }

  // Active ROs
  const activeROs = ros
    .filter((ro) => !ro.currentStatus?.includes('COMPLETED') && !ro.currentStatus?.includes('RECEIVED'))
    .map((ro) => ro.roNumber);

  return {
    shopName,
    state,
    shippingDays,
    medianTurnaround,
    medianSegmentTimes,
    statusVelocity,
    variance,
    trend,
    recentMedian,
    overallMedian,
    activeROs,
    totalROs: ros.length,
  };
}

/**
 * Build analytics profiles for all shops (with caching)
 */
export function buildShopAnalytics(
  repairOrders: RepairOrder[],
  forceRefresh = false
): Map<string, ShopAnalyticsProfile> {
  const now = Date.now();

  // Return cached data if valid
  if (!forceRefresh && analyticsCache && now - analyticsCache.timestamp < CACHE_TTL) {
    return analyticsCache.profiles;
  }

  // Group ROs by normalized shop name (to consolidate duplicates)
  const normalizedGroups = new Map<string, {
    ros: RepairOrder[];
    originalNames: Map<string, number>; // Track original name frequencies
  }>();

  for (const ro of repairOrders) {
    const originalName = ro.shopName || 'Unknown';
    const normalizedName = normalizeShopName(originalName);

    if (!normalizedGroups.has(normalizedName)) {
      normalizedGroups.set(normalizedName, {
        ros: [],
        originalNames: new Map(),
      });
    }

    const group = normalizedGroups.get(normalizedName)!;
    group.ros.push(ro);
    group.originalNames.set(originalName, (group.originalNames.get(originalName) || 0) + 1);
  }

  // Build profiles using consolidated groups
  const profiles = new Map<string, ShopAnalyticsProfile>();

  for (const group of normalizedGroups.values()) {
    // Choose the most common original name (or the longest one if tied)
    let displayName = 'Unknown';
    let maxCount = 0;
    for (const [name, count] of group.originalNames.entries()) {
      if (count > maxCount || (count === maxCount && name.length > displayName.length)) {
        displayName = name;
        maxCount = count;
      }
    }

    const profile = buildShopProfile(displayName, group.ros);
    if (profile) {
      profiles.set(displayName, profile);
    }
  }

  // Update cache
  analyticsCache = {
    profiles,
    timestamp: now,
  };

  return profiles;
}

/**
 * Invalidate analytics cache (call on RO updates)
 */
export function invalidateAnalyticsCache(): void {
  analyticsCache = null;
}

/**
 * Predict completion date for an active RO (O(1) with cached profiles)
 */
export function predictCompletion(
  ro: RepairOrder,
  profiles: Map<string, ShopAnalyticsProfile>
): PredictionResult | null {
  const profile = profiles.get(ro.shopName || '');

  if (!profile || !ro.dateDroppedOff) {
    return null;
  }

  // Calculate base prediction
  const daysSinceDropoff = daysSince(ro.dateDroppedOff) || 0;
  const expectedTurnaround = profile.medianTurnaround + profile.shippingDays.avg;
  const daysRemaining = Math.max(0, expectedTurnaround - daysSinceDropoff);

  const estimatedDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
  const confidenceDays = Math.ceil(profile.variance + profile.shippingDays.max - profile.shippingDays.min);

  // Determine status
  let status: 'on-track' | 'at-risk' | 'overdue' = 'on-track';

  if (daysSinceDropoff > expectedTurnaround + confidenceDays) {
    status = 'overdue';
  } else if (daysSinceDropoff > expectedTurnaround) {
    status = 'at-risk';
  }

  return {
    estimatedDate,
    confidenceDays,
    status,
  };
}
