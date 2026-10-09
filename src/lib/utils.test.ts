import { describe, it, expect } from 'vitest';
import { formatPaise, parseINRToPaise, getCurrentMonthKolkata, formatDate } from './utils';

describe('formatPaise', () => {
  it('formats positive paise to INR with 2 decimals', () => {
    expect(formatPaise(10000n)).toBe('₹100.00');
    expect(formatPaise(10050n)).toBe('₹100.50');
    expect(formatPaise(5n)).toBe('₹0.05');
    expect(formatPaise(0n)).toBe('₹0.00');
  });

  it('formats thousands and lakhs with Indian grouping', () => {
    expect(formatPaise(10000000n)).toBe('₹1,00,000.00');
    expect(formatPaise(12500050n)).toBe('₹1,25,000.50');
  });

  it('formats negative paise correctly', () => {
    expect(formatPaise(-15000n)).toBe('-₹150.00');
    expect(formatPaise(-75n)).toBe('-₹0.75');
  });

  it('handles number inputs gracefully', () => {
    expect(formatPaise(2500)).toBe('₹25.00');
  });
});

describe('parseINRToPaise', () => {
  it('parses whole rupee strings and numbers', () => {
    expect(parseINRToPaise('100')).toBe(10000n);
    expect(parseINRToPaise(100)).toBe(10000n);
  });

  it('parses decimal rupee strings', () => {
    expect(parseINRToPaise('120.50')).toBe(12050n);
    expect(parseINRToPaise('120.5')).toBe(12050n);
    expect(parseINRToPaise('120.05')).toBe(12005n);
  });

  it('parses comma-separated rupee amounts', () => {
    expect(parseINRToPaise('1,500.75')).toBe(150075n);
    expect(parseINRToPaise('1,00,000')).toBe(10000000n);
  });

  it('handles empty or invalid strings', () => {
    expect(parseINRToPaise('')).toBe(0n);
    expect(parseINRToPaise('invalid')).toBe(0n);
  });
});

describe('date utilities', () => {
  it('returns valid YYYY-MM for getCurrentMonthKolkata', () => {
    const month = getCurrentMonthKolkata();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('formats date string into readable Indian format', () => {
    const formatted = formatDate('2026-10-09');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
  });
});
