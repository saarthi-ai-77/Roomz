import { describe, it, expect } from 'vitest';
import { splitEqualPaise, calculateNetBalance, suggestSettlements } from './accounting';

describe('splitEqualPaise', () => {
  it('splits evenly when divisible across 3 roommates', () => {
    const total = 3000n; // 3000 paise = ₹30
    const shares = splitEqualPaise(total, 3);
    expect(shares).toEqual([1000n, 1000n, 1000n]);
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(total);
  });

  it('splits across 2 roommates with 1 paise remainder', () => {
    const total = 101n; // ₹1.01
    const shares = splitEqualPaise(total, 2);
    // 101 / 2 = 50, remainder 1 -> first gets 51, second gets 50
    expect(shares).toEqual([51n, 50n]);
    expect(shares.reduce((a, b) => a + b, 0n)).toBe(total);
  });

  it('splits across 3 roommates with remainder 1 and remainder 2', () => {
    // 10000 paise (₹100) / 3 = 3333 with remainder 1
    const shares1 = splitEqualPaise(10000n, 3);
    expect(shares1).toEqual([3334n, 3333n, 3333n]);
    expect(shares1.reduce((a, b) => a + b, 0n)).toBe(10000n);

    // 10001 paise / 3 = 3333 with remainder 2
    const shares2 = splitEqualPaise(10001n, 3);
    expect(shares2).toEqual([3334n, 3334n, 3333n]);
    expect(shares2.reduce((a, b) => a + b, 0n)).toBe(10001n);
  });

  it('handles single beneficiary (personal purchase)', () => {
    const shares = splitEqualPaise(5000n, 1);
    expect(shares).toEqual([5000n]);
  });

  it('throws on non-positive beneficiary count', () => {
    expect(() => splitEqualPaise(1000n, 0)).toThrow('beneficiaryCount must be positive');
    expect(() => splitEqualPaise(1000n, -1)).toThrow('beneficiaryCount must be positive');
  });
});

describe('calculateNetBalance', () => {
  it('computes correct balances with 3 roommates', () => {
    // Household spending ₹3000
    // A paid ₹1800, B paid ₹900, C paid ₹300
    // Each fair share = ₹1000
    const payments = { A: 180000n, B: 90000n, C: 30000n };
    const responsibilities = { A: 100000n, B: 100000n, C: 100000n };
    const balances = calculateNetBalance(payments, responsibilities);
    expect(balances).toEqual({
      A: 80000n,  // +₹800 (creditor)
      B: -10000n, // -₹100 (debtor)
      C: -70000n, // -₹700 (debtor)
    });
  });

  it('personal purchase does not affect other roommates balances', () => {
    // Alice buys ₹500 grocery for household (shared by Alice, Bob, Charlie)
    // Alice also buys ₹200 personal shampoo (only Alice is beneficiary)
    // Alice paid 70000n total.
    // Shared: Alice share = 16667, Bob = 16667, Charlie = 16666
    // Personal: Alice share = 20000, Bob = 0, Charlie = 0
    // Alice total responsibility = 36667n
    // Bob responsibility = 16667n
    // Charlie responsibility = 16666n
    const payments = { Alice: 70000n, Bob: 0n, Charlie: 0n };
    const responsibilities = { Alice: 36667n, Bob: 16667n, Charlie: 16666n };
    const balances = calculateNetBalance(payments, responsibilities);
    expect(balances.Alice).toBe(33333n); // +₹333.33 (reimbursed for Bob and Charlie's grocery share)
    expect(balances.Bob).toBe(-16667n);
    expect(balances.Charlie).toBe(-16666n);
    // Net sum of all balances in closed system is always 0
    expect(balances.Alice + balances.Bob + balances.Charlie).toBe(0n);
  });
});

describe('suggestSettlements', () => {
  it('suggests minimal transfers for 3 roommates', () => {
    // A: +800, B: -100, C: -700
    const balances = { A: 80000n, B: -10000n, C: -70000n };
    const transfers = suggestSettlements(balances);
    expect(transfers).toEqual([
      { from: 'C', to: 'A', amount: 70000n },
      { from: 'B', to: 'A', amount: 10000n },
    ]);
  });

  it('handles multi-creditor multi-debtor scenario', () => {
    // A: +500, B: +300, C: -600, D: -200
    const balances = { A: 50000n, B: 30000n, C: -60000n, D: -20000n };
    const transfers = suggestSettlements(balances);
    // C owes 600, pays A 500 (A settled), remaining C owes 100
    // C pays B 100 (C settled), remaining B needs 200
    // D pays B 200 (both settled)
    const totalTransferred = transfers.reduce((sum, t) => sum + t.amount, 0n);
    expect(totalTransferred).toBe(80000n);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array when already settled', () => {
    const balances = { A: 0n, B: 0n, C: 0n };
    expect(suggestSettlements(balances)).toEqual([]);
  });
});
