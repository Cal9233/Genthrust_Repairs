import { describe, it, expect } from 'vitest';
import { detectCarrier, getTrackingInfo } from '../../src/lib/trackingUtils';

describe('trackingUtils', () => {
  describe('detectCarrier', () => {
    describe('UPS tracking numbers', () => {
      it('should detect valid UPS tracking numbers starting with 1Z', () => {
        const upsNumbers = [
          '1Z999AA10123456784',
          '1Z999AA12345678901',
          '1ZA12345AB12345678',
        ];

        upsNumbers.forEach((trackingNumber) => {
          expect(detectCarrier(trackingNumber)).toBe('UPS');
        });
      });

      it('should handle lowercase UPS tracking numbers', () => {
        expect(detectCarrier('1z999aa10123456784')).toBe('UPS');
      });

      it('should reject UPS-like numbers with incorrect length', () => {
        expect(detectCarrier('1Z999AA1012345678')).toBe('Unknown'); // Too short
        expect(detectCarrier('1Z999AA101234567890')).toBe('Unknown'); // Too long
      });
    });

    describe('FedEx tracking numbers', () => {
      it('should detect 12-digit FedEx tracking numbers', () => {
        const fedExNumbers = [
          '123456789012',
          '986578901234',
          '771234567890',
        ];

        fedExNumbers.forEach((trackingNumber) => {
          expect(detectCarrier(trackingNumber)).toBe('FedEx');
        });
      });

      it('should detect 15-digit FedEx tracking numbers', () => {
        const fedExNumbers = [
          '123456789012345',
          '986578901234567',
        ];

        fedExNumbers.forEach((trackingNumber) => {
          expect(detectCarrier(trackingNumber)).toBe('FedEx');
        });
      });

      it('should detect 20-digit FedEx tracking numbers', () => {
        const fedExNumbers = [
          '12345678901234567890',
          '98657890123456789012',
        ];

        fedExNumbers.forEach((trackingNumber) => {
          expect(detectCarrier(trackingNumber)).toBe('FedEx');
        });
      });

      it('should detect FedEx SmartPost tracking numbers starting with 96', () => {
        const smartPostNumbers = [
          '9612345678901234567890',
          '96123456789012345678901234',
        ];

        smartPostNumbers.forEach((trackingNumber) => {
          expect(detectCarrier(trackingNumber)).toBe('FedEx');
        });
      });
    });

    describe('Unknown tracking numbers', () => {
      it('should return Unknown for empty or invalid tracking numbers', () => {
        expect(detectCarrier('')).toBe('Unknown');
        expect(detectCarrier('   ')).toBe('Unknown');
        expect(detectCarrier('INVALID123')).toBe('Unknown');
        expect(detectCarrier('12345')).toBe('Unknown');
      });

      it('should return Unknown for tracking numbers with invalid formats', () => {
        expect(detectCarrier('ABC123456789')).toBe('Unknown');
        expect(detectCarrier('2Z999AA10123456784')).toBe('Unknown'); // Starts with 2Z, not 1Z
      });
    });

    describe('Edge cases', () => {
      it('should handle tracking numbers with whitespace', () => {
        expect(detectCarrier(' 1Z999AA10123456784 ')).toBe('UPS');
        expect(detectCarrier(' 123456789012 ')).toBe('FedEx');
      });

      it('should handle mixed case tracking numbers', () => {
        expect(detectCarrier('1z999Aa10123456784')).toBe('UPS');
      });
    });
  });

  describe('getTrackingInfo', () => {
    it('should return correct URL for UPS tracking numbers', () => {
      const trackingNumber = '1Z999AA10123456784';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('UPS');
      expect(info.url).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
    });

    it('should return correct URL for FedEx 12-digit tracking numbers', () => {
      const trackingNumber = '123456789012';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('FedEx');
      expect(info.url).toBe('https://www.fedex.com/fedextrack/?trknbr=123456789012');
    });

    it('should return correct URL for FedEx 15-digit tracking numbers', () => {
      const trackingNumber = '123456789012345';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('FedEx');
      expect(info.url).toBe('https://www.fedex.com/fedextrack/?trknbr=123456789012345');
    });

    it('should return correct URL for FedEx 20-digit tracking numbers', () => {
      const trackingNumber = '12345678901234567890';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('FedEx');
      expect(info.url).toBe('https://www.fedex.com/fedextrack/?trknbr=12345678901234567890');
    });

    it('should return correct URL for FedEx SmartPost tracking numbers', () => {
      const trackingNumber = '9612345678901234567890';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('FedEx');
      expect(info.url).toBe('https://www.fedex.com/fedextrack/?trknbr=9612345678901234567890');
    });

    it('should default to UPS URL for unknown tracking numbers', () => {
      const trackingNumber = 'UNKNOWN123';
      const info = getTrackingInfo(trackingNumber);

      expect(info.carrier).toBe('Unknown');
      expect(info.url).toBe('https://www.ups.com/track?tracknum=UNKNOWN123');
    });

    it('should properly encode special characters in URLs', () => {
      const trackingNumber = '1Z999AA&1012345678';
      const info = getTrackingInfo(trackingNumber);

      expect(info.url).toContain(encodeURIComponent('&'));
    });
  });
});
