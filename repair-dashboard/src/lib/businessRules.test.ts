import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateNextUpdateDate,
  calculateDaysInStatus,
  getStatusColor,
  isDueToday,
  isDueWithinDays,
  isOnTrack,
  formatDateForDisplay,
} from './businessRules';

describe('businessRules', () => {
  let baseDate: Date;

  beforeEach(() => {
    // Use a fixed date for consistent testing
    baseDate = new Date('2024-01-15T10:00:00');
  });

  describe('calculateNextUpdateDate', () => {
    it('calculates correct date for TO SEND status (3 days)', () => {
      const result = calculateNextUpdateDate('TO SEND', baseDate);
      const expected = new Date('2024-01-18T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('calculates correct date for WAITING QUOTE status (14 days)', () => {
      const result = calculateNextUpdateDate('WAITING QUOTE', baseDate);
      const expected = new Date('2024-01-29T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('calculates correct date for APPROVED status (7 days)', () => {
      const result = calculateNextUpdateDate('APPROVED', baseDate);
      const expected = new Date('2024-01-22T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('calculates correct date for BEING REPAIRED status (10 days)', () => {
      const result = calculateNextUpdateDate('BEING REPAIRED', baseDate);
      const expected = new Date('2024-01-25T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('calculates correct date for SHIPPING status (3 days)', () => {
      const result = calculateNextUpdateDate('SHIPPING', baseDate);
      const expected = new Date('2024-01-18T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('returns null for PAID status with COD terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'COD');

      expect(result).toBeNull();
    });

    it('returns null for PAID status with PREPAID terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'PREPAID');

      expect(result).toBeNull();
    });

    it('calculates correct date for PAID with NET 30 terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'NET 30');
      const expected = new Date('2024-02-14T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('calculates correct date for PAID with NET 45 terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'NET 45');
      const expected = new Date('2024-02-29T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('returns 3 days for PAID with WIRE terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'WIRE');
      const expected = new Date('2024-01-18T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('returns null for PAID with CREDIT CARD terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'CREDIT CARD');

      expect(result).toBeNull();
    });

    it('defaults to 30 days for PAID with unknown terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate, 'UNKNOWN TERMS');
      const expected = new Date('2024-02-14T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('returns null for PAID status with no terms', () => {
      const result = calculateNextUpdateDate('PAID', baseDate);

      expect(result).toBeNull();
    });

    it('returns null for PAYMENT SENT status', () => {
      const result = calculateNextUpdateDate('PAYMENT SENT', baseDate);

      expect(result).toBeNull();
    });

    it('returns null for BER status', () => {
      const result = calculateNextUpdateDate('BER', baseDate);

      expect(result).toBeNull();
    });

    it('defaults to 7 days for unknown status', () => {
      const result = calculateNextUpdateDate('UNKNOWN STATUS', baseDate);
      const expected = new Date('2024-01-22T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('is case-insensitive', () => {
      const result1 = calculateNextUpdateDate('to send', baseDate);
      const result2 = calculateNextUpdateDate('TO SEND', baseDate);
      const result3 = calculateNextUpdateDate('To Send', baseDate);

      expect(result1?.toDateString()).toBe(result2?.toDateString());
      expect(result2?.toDateString()).toBe(result3?.toDateString());
    });

    it('handles whitespace in status', () => {
      const result = calculateNextUpdateDate('  TO SEND  ', baseDate);
      const expected = new Date('2024-01-18T00:00:00');

      expect(result?.toDateString()).toBe(expected.toDateString());
    });

    it('resets time to start of day', () => {
      const dateWithTime = new Date('2024-01-15T23:59:59');
      const result = calculateNextUpdateDate('TO SEND', dateWithTime);

      expect(result?.getHours()).toBe(0);
      expect(result?.getMinutes()).toBe(0);
      expect(result?.getSeconds()).toBe(0);
    });
  });

  describe('calculateDaysInStatus', () => {
    beforeEach(() => {
      // Mock today's date
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T00:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('calculates correct number of days for past date', () => {
      const statusDate = new Date('2024-01-15T00:00:00');
      const result = calculateDaysInStatus(statusDate);

      expect(result).toBe(5);
    });

    it('returns 0 for today', () => {
      const statusDate = new Date('2024-01-20T00:00:00');
      const result = calculateDaysInStatus(statusDate);

      expect(result).toBe(0);
    });

    it('returns 0 for future dates', () => {
      const statusDate = new Date('2024-01-25T00:00:00');
      const result = calculateDaysInStatus(statusDate);

      expect(result).toBe(0);
    });

    it('ignores time component', () => {
      const statusDate1 = new Date('2024-01-15T08:00:00');
      const statusDate2 = new Date('2024-01-15T22:00:00');

      expect(calculateDaysInStatus(statusDate1)).toBe(calculateDaysInStatus(statusDate2));
    });
  });

  describe('getStatusColor', () => {
    it('returns red colors for overdue status', () => {
      const result = getStatusColor('ANY STATUS', true);

      expect(result.bg).toBe('bg-red-50');
      expect(result.text).toBe('text-red-700');
      expect(result.border).toBe('border-red-200');
    });

    it('returns blue colors for TO SEND', () => {
      const result = getStatusColor('TO SEND', false);

      expect(result.bg).toBe('bg-blue-50');
      expect(result.text).toBe('text-blue-700');
      expect(result.border).toBe('border-blue-200');
    });

    it('returns yellow colors for WAITING QUOTE', () => {
      const result = getStatusColor('WAITING QUOTE', false);

      expect(result.bg).toBe('bg-yellow-50');
      expect(result.text).toBe('text-yellow-700');
      expect(result.border).toBe('border-yellow-200');
    });

    it('returns green colors for APPROVED', () => {
      const result = getStatusColor('APPROVED', false);

      expect(result.bg).toBe('bg-green-50');
      expect(result.text).toBe('text-green-700');
      expect(result.border).toBe('border-green-200');
    });

    it('returns purple colors for BEING REPAIRED', () => {
      const result = getStatusColor('BEING REPAIRED', false);

      expect(result.bg).toBe('bg-purple-50');
      expect(result.text).toBe('text-purple-700');
      expect(result.border).toBe('border-purple-200');
    });

    it('returns indigo colors for SHIPPING', () => {
      const result = getStatusColor('SHIPPING', false);

      expect(result.bg).toBe('bg-indigo-50');
      expect(result.text).toBe('text-indigo-700');
      expect(result.border).toBe('border-indigo-200');
    });

    it('returns gray colors for PAID', () => {
      const result = getStatusColor('PAID', false);

      expect(result.bg).toBe('bg-gray-50');
      expect(result.text).toBe('text-gray-700');
      expect(result.border).toBe('border-gray-200');
    });

    it('returns slate colors for BER', () => {
      const result = getStatusColor('BER', false);

      expect(result.bg).toBe('bg-slate-50');
      expect(result.text).toBe('text-slate-700');
      expect(result.border).toBe('border-slate-200');
    });

    it('returns default gray colors for unknown status', () => {
      const result = getStatusColor('UNKNOWN', false);

      expect(result.bg).toBe('bg-gray-50');
      expect(result.text).toBe('text-gray-700');
      expect(result.border).toBe('border-gray-200');
    });

    it('overdue takes priority over status color', () => {
      const result = getStatusColor('APPROVED', true);

      expect(result.bg).toBe('bg-red-50');
    });
  });

  describe('isDueToday', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T12:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for today\'s date', () => {
      const dueDate = new Date('2024-01-20T00:00:00');
      expect(isDueToday(dueDate)).toBe(true);
    });

    it('returns true for today with different time', () => {
      const dueDate = new Date('2024-01-20T23:59:59');
      expect(isDueToday(dueDate)).toBe(true);
    });

    it('returns false for yesterday', () => {
      const dueDate = new Date('2024-01-19T00:00:00');
      expect(isDueToday(dueDate)).toBe(false);
    });

    it('returns false for tomorrow', () => {
      const dueDate = new Date('2024-01-21T00:00:00');
      expect(isDueToday(dueDate)).toBe(false);
    });

    it('returns false for null date', () => {
      expect(isDueToday(null)).toBe(false);
    });
  });

  describe('isDueWithinDays', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T00:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for date due today', () => {
      const dueDate = new Date('2024-01-20T00:00:00');
      expect(isDueWithinDays(dueDate, 7)).toBe(true);
    });

    it('returns true for date within specified days', () => {
      const dueDate = new Date('2024-01-25T00:00:00');
      expect(isDueWithinDays(dueDate, 7)).toBe(true);
    });

    it('returns true for date exactly at boundary', () => {
      const dueDate = new Date('2024-01-27T00:00:00');
      expect(isDueWithinDays(dueDate, 7)).toBe(true);
    });

    it('returns false for date beyond specified days', () => {
      const dueDate = new Date('2024-01-28T00:00:00');
      expect(isDueWithinDays(dueDate, 7)).toBe(false);
    });

    it('returns false for past dates', () => {
      const dueDate = new Date('2024-01-19T00:00:00');
      expect(isDueWithinDays(dueDate, 7)).toBe(false);
    });

    it('returns false for null date', () => {
      expect(isDueWithinDays(null, 7)).toBe(false);
    });
  });

  describe('isOnTrack', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-20T00:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns true for dates more than 3 days away', () => {
      const dueDate = new Date('2024-01-25T00:00:00');
      expect(isOnTrack(dueDate)).toBe(true);
    });

    it('returns false for dates 3 days or less away', () => {
      const dueDate = new Date('2024-01-23T00:00:00');
      expect(isOnTrack(dueDate)).toBe(false);
    });

    it('returns false for today', () => {
      const dueDate = new Date('2024-01-20T00:00:00');
      expect(isOnTrack(dueDate)).toBe(false);
    });

    it('returns false for past dates', () => {
      const dueDate = new Date('2024-01-19T00:00:00');
      expect(isOnTrack(dueDate)).toBe(false);
    });

    it('returns true for null date', () => {
      expect(isOnTrack(null)).toBe(true);
    });
  });

  describe('formatDateForDisplay', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-15T10:00:00');
      const result = formatDateForDisplay(date);

      expect(result).toBe('Jan 15, 2024');
    });

    it('returns N/A for null', () => {
      expect(formatDateForDisplay(null)).toBe('N/A');
    });

    it('returns N/A for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatDateForDisplay(invalidDate)).toBe('N/A');
    });

    it('handles date strings', () => {
      const dateString = '2024-01-15T00:00:00' as any;
      const result = formatDateForDisplay(dateString);

      // Date strings may shift due to timezone, just verify it's formatted
      expect(result).toMatch(/Jan (14|15), 2024/);
    });
  });
});
