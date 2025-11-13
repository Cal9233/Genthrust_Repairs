# Tracking Number Carrier Detection

This document explains how the application automatically detects whether a tracking number belongs to UPS or FedEx and generates the correct tracking URL.

## Overview

The tracking system automatically identifies the carrier based on the tracking number format and generates the appropriate tracking URL. The carrier name is also displayed next to the tracking link.

## Detection Rules

### UPS Tracking Numbers
- **Format**: Starts with "1Z" followed by 16 alphanumeric characters (18 total)
- **Pattern**: `1Z[A-Z0-9]{16}`
- **Examples**:
  - `1Z999AA10123456784`
  - `1Z999AA12345678901`
  - `1ZA12345AB12345678`
- **URL**: `https://www.ups.com/track?tracknum={tracking_number}`

### FedEx Tracking Numbers
FedEx uses multiple tracking number formats:

#### 12-Digit (Express and Ground)
- **Format**: 12 numeric digits
- **Pattern**: `\d{12}`
- **Example**: `123456789012`

#### 15-Digit (Ground and SmartPost)
- **Format**: 15 numeric digits
- **Pattern**: `\d{15}`
- **Example**: `123456789012345`

#### 20-Digit (Express, Ground, and SmartPost)
- **Format**: 20 numeric digits
- **Pattern**: `\d{20}`
- **Example**: `12345678901234567890`

#### SmartPost (Starting with 96)
- **Format**: Starts with "96" followed by 20+ numeric digits
- **Pattern**: `96\d{20,}`
- **Example**: `9612345678901234567890`

**FedEx URL**: `https://www.fedex.com/fedextrack/?trknbr={tracking_number}`

### Unknown Format
If a tracking number doesn't match any of the above patterns, it defaults to UPS tracking URL but displays "(Unknown)" as the carrier.

## Usage

### In the UI
When viewing a repair order with a tracking number, the tracking link will:
1. Automatically use the correct carrier's tracking URL
2. Display the carrier name in parentheses next to the link
3. Example display: `1Z999AA10123456784 (UPS)`

### Programmatically

```typescript
import { getTrackingInfo, detectCarrier } from '@/lib/trackingUtils';

// Get complete tracking information
const info = getTrackingInfo('1Z999AA10123456784');
console.log(info.carrier); // "UPS"
console.log(info.url);     // "https://www.ups.com/track?tracknum=1Z999AA10123456784"

// Or just detect the carrier
const carrier = detectCarrier('123456789012');
console.log(carrier); // "FedEx"
```

## Implementation Details

### Files Modified
1. **`src/lib/trackingUtils.ts`** - New utility file containing carrier detection logic
2. **`src/components/RODetailDialog.tsx`** - Updated to use the carrier detection
3. **`src/lib/trackingUtils.test.ts`** - Comprehensive test coverage
4. **`src/components/RODetailDialog.test.tsx`** - Updated component tests

### Functions

#### `detectCarrier(trackingNumber: string): Carrier`
Analyzes a tracking number and returns the detected carrier.

**Parameters:**
- `trackingNumber` - The tracking number to analyze

**Returns:**
- `'UPS'` | `'FedEx'` | `'Unknown'`

#### `getTrackingInfo(trackingNumber: string): TrackingInfo`
Returns complete tracking information including carrier and URL.

**Parameters:**
- `trackingNumber` - The tracking number to analyze

**Returns:**
```typescript
{
  carrier: 'UPS' | 'FedEx' | 'Unknown',
  url: string
}
```

## Testing

The system includes comprehensive tests covering:
- Valid UPS tracking numbers (including case variations)
- All FedEx tracking number formats (12, 15, 20 digits, SmartPost)
- Invalid formats
- Edge cases (whitespace, special characters)
- URL encoding

Run tests with:
```bash
npm test -- trackingUtils.test.ts
```

## Future Enhancements

Potential future improvements:
- Support for additional carriers (USPS, DHL, etc.)
- Barcode scanning integration
- Tracking status webhooks
- Automatic tracking number validation during data entry
