/**
 * Tracking number utilities for detecting carriers and generating tracking URLs
 */

export type Carrier = 'UPS' | 'FedEx' | 'Unknown';

export interface TrackingInfo {
  carrier: Carrier;
  url: string;
}

/**
 * Detects the carrier from a tracking number based on format patterns
 *
 * Detection Rules:
 * - UPS: Starts with "1Z" followed by 16 more characters (18 total)
 * - FedEx: 12 digits, 15 digits, 20 digits, or starts with "96" (SmartPost)
 *
 * Note: Spaces and dashes are automatically removed before detection
 *
 * @param trackingNumber - The tracking number to analyze (spaces/dashes allowed)
 * @returns The detected carrier: 'UPS', 'FedEx', or 'Unknown'
 */
export function detectCarrier(trackingNumber: string): Carrier {
  if (!trackingNumber) {
    return 'Unknown';
  }

  // Remove all spaces, dashes, and other common separators
  const normalized = trackingNumber.trim().replace(/[\s\-]/g, '').toUpperCase();

  // UPS: Starts with "1Z" and has 18 total characters
  if (/^1Z[A-Z0-9]{16}$/i.test(normalized)) {
    return 'UPS';
  }

  // FedEx patterns:
  // - 12 digits: Express and Ground
  // - 15 digits: Ground and SmartPost
  // - 20 digits: Express, Ground, and SmartPost
  // - Starts with "96" and 20+ digits: SmartPost
  // Note: FedEx tracking numbers are numeric only (no letters)
  if (
    /^\d{12}$/.test(normalized) ||
    /^\d{15}$/.test(normalized) ||
    /^\d{20}$/.test(normalized) ||
    /^96\d{20,}$/.test(normalized)
  ) {
    return 'FedEx';
  }

  // Default to Unknown if no pattern matches
  return 'Unknown';
}

/**
 * Generates the appropriate tracking URL based on the carrier
 *
 * @param trackingNumber - The tracking number
 * @returns Object containing the detected carrier and tracking URL
 */
export function getTrackingInfo(trackingNumber: string): TrackingInfo {
  const carrier = detectCarrier(trackingNumber);

  let url: string;

  switch (carrier) {
    case 'UPS':
      url = `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
      break;
    case 'FedEx':
      url = `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
      break;
    case 'Unknown':
      // Default to UPS for unknown formats
      url = `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
      break;
  }

  return { carrier, url };
}
