import { describe, it, expect } from 'vitest';
import { splitEqualPaise, calculateNetBalance, suggestSettlements } from './accounting';

describe('Household Accounting Flow & Invariants', () => {
  it('simulates a complete calendar month of shared expenses, personal items, and settlements', () => {
    // 3 roommates
    const members = ['Alice', 'Bob', 'Charlie'];

    // Track total paid by each member (all payments including personal and settlements)
    const totalPaid: Record<string, bigint> = { Alice: 0n, Bob: 0n, Charlie: 0n };
    // Track total liability / fair share by each member
    const totalLiability: Record<string, bigint> = { Alice: 0n, Bob: 0n, Charlie: 0n };
    // Track shared household expense total (excludes personal purchases and settlements)
    let sharedHouseholdSpending = 0n;

    // Helper to log a shared expense
    function addSharedExpense(payer: string, amountPaise: bigint) {
      totalPaid[payer] += amountPaise;
      sharedHouseholdSpending += amountPaise;
      const splits = splitEqualPaise(amountPaise, members.length);
      members.forEach((m, idx) => {
        totalLiability[m] += splits[idx];
      });
    }

    // Helper to log a personal purchase
    function addPersonalExpense(payer: string, amountPaise: bigint) {
      totalPaid[payer] += amountPaise;
      // ONLY the payer has the liability, household shared total does NOT include personal items
      totalLiability[payer] += amountPaise;
    }

    // Helper to log a settlement transfer
    function recordSettlement(payer: string, receiver: string, amountPaise: bigint) {
      // Settlements are direct transfers:
      // Payer gets credit (paid amount increased)
      // Receiver gets debit (liability increased or paid decreased)
      totalPaid[payer] += amountPaise;
      totalLiability[receiver] += amountPaise;
      // Crucial: Settlements do NOT increase shared household spending!
    }

    // 1. Day 1: Alice buys Groceries for ₹1,200.00
    addSharedExpense('Alice', 120000n);

    // 2. Day 5: Bob pays Electricity bill for ₹1,500.00
    addSharedExpense('Bob', 150000n);

    // 3. Day 10: Charlie buys Cleaning Supplies for ₹300.00
    addSharedExpense('Charlie', 30000n);

    // 4. Day 12: Alice buys personal medication for ₹250.00
    addPersonalExpense('Alice', 25000n);

    // Invariant check: Shared spending is exactly ₹3,000.00 (₹1200 + ₹1500 + ₹300)
    expect(sharedHouseholdSpending).toBe(300000n);

    // Check balances before settlement
    let balances = calculateNetBalance(totalPaid, totalLiability);
    // Fair share of 300000 is 100000 each.
    // Alice paid 120000 (shared) + 25000 (personal) = 145000. Liability = 100000 + 25000 = 125000. Net = +20000 (+₹200)
    // Bob paid 150000. Liability = 100000. Net = +50000 (+₹500)
    // Charlie paid 30000. Liability = 100000. Net = -70000 (-₹700)
    expect(balances.Alice).toBe(20000n);
    expect(balances.Bob).toBe(50000n);
    expect(balances.Charlie).toBe(-70000n);
    expect(balances.Alice + balances.Bob + balances.Charlie).toBe(0n);

    // 5. Day 15: Charlie partially settles ₹300.00 to Bob
    recordSettlement('Charlie', 'Bob', 30000n);

    // Shared household spending remains strictly ₹3,000.00
    expect(sharedHouseholdSpending).toBe(300000n);

    // Re-check balances after partial settlement:
    balances = calculateNetBalance(totalPaid, totalLiability);
    // Alice still +₹200 (20000n)
    // Bob was +₹500, received ₹300 -> net now +₹200 (20000n)
    // Charlie was -₹700, paid ₹300 -> net now -₹400 (-40000n)
    expect(balances.Alice).toBe(20000n);
    expect(balances.Bob).toBe(20000n);
    expect(balances.Charlie).toBe(-40000n);
    expect(balances.Alice + balances.Bob + balances.Charlie).toBe(0n);

    // 6. Generate end-of-month suggested settlement transfers
    const suggested = suggestSettlements(balances);
    // Charlie owes 40000, should pay 20000 to Bob and 20000 to Alice
    expect(suggested.length).toBe(2);
    const charliePayments = suggested.filter((s) => s.from === 'Charlie');
    expect(charliePayments.length).toBe(2);
    expect(suggested.reduce((acc, s) => acc + s.amount, 0n)).toBe(40000n);

    // 7. Execute all suggested transfers
    suggested.forEach((s) => {
      recordSettlement(s.from, s.to, s.amount);
    });

    // Balances must now be fully reconciled to zero
    const finalBalances = calculateNetBalance(totalPaid, totalLiability);
    expect(finalBalances.Alice).toBe(0n);
    expect(finalBalances.Bob).toBe(0n);
    expect(finalBalances.Charlie).toBe(0n);
    expect(suggestSettlements(finalBalances)).toEqual([]);
  });

  it('guarantees deterministic remainder allocation preserves the exact total paise down to 1 paise', () => {
    // Test odd prime total paise amounts across 2 and 3 roommates
    const testCases = [
      { amount: 1n, count: 3, expected: [1n, 0n, 0n] },
      { amount: 2n, count: 3, expected: [1n, 1n, 0n] },
      { amount: 3n, count: 3, expected: [1n, 1n, 1n] },
      { amount: 7n, count: 3, expected: [3n, 2n, 2n] },
      { amount: 9999999999n, count: 3, expected: [3333333333n, 3333333333n, 3333333333n] },
    ];

    testCases.forEach(({ amount, count, expected }) => {
      const splits = splitEqualPaise(amount, count);
      expect(splits).toEqual(expected);
      const sum = splits.reduce((a, b) => a + b, 0n);
      expect(sum).toBe(amount);
    });
  });
});
