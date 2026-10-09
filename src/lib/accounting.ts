/**
 * Accounting utilities for shared expenses.
 * All amounts are stored as bigint representing paise (1/100 INR).
 */

/**
 * Split a total amount equally among a number of beneficiaries.
 * Uses deterministic remainder allocation: the first `remainder` beneficiaries get an extra paise.
 *
 * @param totalPaise - total amount in paise (bigint)
 * @param beneficiaryCount - number of beneficiaries (must be > 0)
 * @returns array of shares (bigint) length = beneficiaryCount, sum equals totalPaise
 */
export function splitEqualPaise(
  totalPaise: bigint,
  beneficiaryCount: number
): bigint[] {
  if (beneficiaryCount <= 0) {
    throw new Error('beneficiaryCount must be positive');
  }
  const base = totalPaise / BigInt(beneficiaryCount);
  const remainder = Number(totalPaise % BigInt(beneficiaryCount)); // remainder < beneficiaryCount
  const shares: bigint[] = [];
  for (let i = 0; i < beneficiaryCount; i++) {
    shares.push(base + (i < remainder ? 1n : 0n));
  }
  return shares;
}

/**
 * Calculate net balance for each member.
 * @param payments - map of memberId -> total amount they have paid (bigint)
 * @param responsibilities - map of memberId -> total amount they owe (bigint)
 * @returns map of memberId -> net balance (payments - responsibilities)
 */
export function calculateNetBalance(
  payments: Record<string, bigint>,
  responsibilities: Record<string, bigint>
): Record<string, bigint> {
  const allIds = new Set([...Object.keys(payments), ...Object.keys(responsibilities)]);
  const result: Record<string, bigint> = {};
  allIds.forEach((id) => {
    const paid = payments[id] ?? 0n;
    const owe = responsibilities[id] ?? 0n;
    result[id] = paid - owe;
  });
  return result;
}

/**
 * Suggest minimal settlement transfers to settle balances.
 * Implements a greedy algorithm: match largest creditor with largest debtor.
 *
 * @param balances - map of memberId -> net balance (positive = should receive, negative = owes)
 * @returns array of transfers {from, to, amount}
 */
export function suggestSettlements(
  balances: Record<string, bigint>
): Array<{ from: string; to: string; amount: bigint }> {
  // Prepare lists of creditors and debtors
  const creditors: Array<{ id: string; amount: bigint }> = [];
  const debtors: Array<{ id: string; amount: bigint }> = [];
  for (const [id, bal] of Object.entries(balances)) {
    if (bal > 0n) creditors.push({ id, amount: bal });
    else if (bal < 0n) debtors.push({ id, amount: -bal }); // store as positive owed amount
  }
  // Sort descending by amount
  creditors.sort((a, b) => Number(b.amount - a.amount));
  debtors.sort((a, b) => Number(b.amount - a.amount));
  const transfers: Array<{ from: string; to: string; amount: bigint }> = [];

  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const cred = creditors[i];
    const debt = debtors[j];
    const settle = cred.amount < debt.amount ? cred.amount : debt.amount;
    transfers.push({ from: debt.id, to: cred.id, amount: settle });
    cred.amount -= settle;
    debt.amount -= settle;
    if (cred.amount === 0n) i++;
    if (debt.amount === 0n) j++;
  }
  return transfers;
}
