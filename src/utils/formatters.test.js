import { describe, it, expect } from 'vitest';
import { formatPercentChange } from './formatters.js';

describe('formatPercentChange', () => {
  describe('normal cases', () => {
    it('formats positive decimal value', () => {
      expect(formatPercentChange(12.34)).toBe('+12,3%');
    });

    it('formats negative decimal value', () => {
      expect(formatPercentChange(-3.1)).toBe('-3,1%');
    });
  });

  describe('neutral zone (|value| < 1)', () => {
    it('returns "0%" for small positive value', () => {
      expect(formatPercentChange(0.5)).toBe('0%');
    });

    it('returns "0%" for small negative value', () => {
      expect(formatPercentChange(-0.9)).toBe('0%');
    });
  });

  describe('zero', () => {
    it('returns "0%" for zero', () => {
      expect(formatPercentChange(0)).toBe('0%');
    });
  });

  describe('whole numbers', () => {
    it('formats positive whole number without decimal', () => {
      expect(formatPercentChange(5.0)).toBe('+5%');
    });

    it('formats negative whole number without decimal', () => {
      expect(formatPercentChange(-10.0)).toBe('-10%');
    });
  });

  describe('edge cases', () => {
    it('returns "0%" for NaN', () => {
      expect(formatPercentChange(NaN)).toBe('0%');
    });

    it('returns "0%" for Infinity', () => {
      expect(formatPercentChange(Infinity)).toBe('0%');
    });

    it('returns "0%" for -Infinity', () => {
      expect(formatPercentChange(-Infinity)).toBe('0%');
    });
  });

  describe('boundary values', () => {
    it('formats +1.0 as "+1%"', () => {
      expect(formatPercentChange(1.0)).toBe('+1%');
    });

    it('formats -1.0 as "-1%"', () => {
      expect(formatPercentChange(-1.0)).toBe('-1%');
    });
  });

  describe('large values', () => {
    it('formats large positive value', () => {
      expect(formatPercentChange(100)).toBe('+100%');
    });
  });
});
