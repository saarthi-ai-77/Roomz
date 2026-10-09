'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { calculateNetBalance, suggestSettlements } from '@/lib/accounting';
import { revalidatePath } from 'next/cache';
import type { Settlement, Profile } from '@/types/database';

export async function recordSettlementAction(input: {
  householdId: string;
  fromId: string;
  toId: string;
  amountPaise: bigint;
  notes?: string | null;
}) {
  const { householdId, fromId, toId, amountPaise, notes } = input;

  if (amountPaise <= 0n) {
    return { success: false, error: 'Settlement amount must be greater than zero.' };
  }

  if (fromId === toId) {
    return { success: false, error: 'Sender and receiver cannot be the same member.' };
  }

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Try RPC first
  const { data: settId, error: rpcErr } = await supabase.rpc('record_settlement', {
    p_household_id: householdId,
    p_from_id: fromId,
    p_to_id: toId,
    p_amount: Number(amountPaise),
    p_notes: notes || null,
  });

  if (!rpcErr && settId) {
    revalidatePath('/dashboard');
    revalidatePath('/settlement');
    return { success: true, settlementId: settId };
  }

  // Fallback insert
  const { data: newSett, error: settErr } = await supabase
    .from('settlements')
    .insert({
      household_id: householdId,
      from_id: fromId,
      to_id: toId,
      amount: Number(amountPaise),
      notes: notes || null,
      status: 'completed',
      settled_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (settErr || !newSett) {
    return { success: false, error: settErr?.message || 'Failed to record settlement.' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/settlement');
  return { success: true, settlementId: newSett.id };
}

export async function getSettlementsAction(householdId: string): Promise<Settlement[]> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from('settlements')
      .select(`
        *,
        from_profile:profiles!settlements_from_id_fkey(*),
        to_profile:profiles!settlements_to_id_fkey(*)
      `)
      .eq('household_id', householdId)
      .order('settled_at', { ascending: false });

    if (error) {
      console.error('Error fetching settlements:', error);
      return [];
    }

    return (data || []) as unknown as Settlement[];
  } catch (err) {
    console.error('getSettlementsAction error:', err);
    return [];
  }
}

export interface HouseholdBalanceData {
  members: Profile[];
  memberPayments: Record<string, bigint>;
  memberResponsibilities: Record<string, bigint>;
  netBalances: Record<string, bigint>; // positive = creditor, negative = debtor
  suggestedTransfers: Array<{
    from: string;
    to: string;
    fromProfile?: Profile;
    toProfile?: Profile;
    amount: bigint;
  }>;
  totalSharedSpendingPaise: bigint;
  totalPersonalSpendingPaise: bigint;
  settlementsHistory: Settlement[];
}

export async function calculateHouseholdBalancesAction(
  householdId: string
): Promise<HouseholdBalanceData> {
  const supabase = await getSupabaseServer();

  // 1. Fetch household members
  const { data: rawMembers } = await supabase
    .from('household_members')
    .select('profile:profiles(*)')
    .eq('household_id', householdId);

  const members: Profile[] = (rawMembers || [])
    .map((m: unknown) => (m as { profile: Profile }).profile)
    .filter(Boolean);

  const memberMap = new Map<string, Profile>();
  members.forEach((m) => memberMap.set(m.id, m));

  // 2. Fetch all expenses with splits
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      id,
      payer_id,
      total_amount,
      is_personal,
      splits:expense_splits(beneficiary_id, share_amount)
    `)
    .eq('household_id', householdId);

  // 3. Fetch completed settlements
  const { data: settlements } = await supabase
    .from('settlements')
    .select(`
      *,
      from_profile:profiles!settlements_from_id_fkey(*),
      to_profile:profiles!settlements_to_id_fkey(*)
    `)
    .eq('household_id', householdId)
    .eq('status', 'completed')
    .order('settled_at', { ascending: false });

  const memberPayments: Record<string, bigint> = {};
  const memberResponsibilities: Record<string, bigint> = {};

  members.forEach((m) => {
    memberPayments[m.id] = 0n;
    memberResponsibilities[m.id] = 0n;
  });

  let totalSharedSpendingPaise = 0n;
  let totalPersonalSpendingPaise = 0n;

  interface ExpenseRow {
    id: string;
    payer_id: string;
    total_amount: number;
    is_personal: boolean;
    splits: Array<{ beneficiary_id: string; share_amount: number }>;
  }

  // Process expenses
  ((expenses as unknown as ExpenseRow[]) || []).forEach((exp) => {
    const totalPaise = BigInt(exp.total_amount);
    const isPersonal = Boolean(exp.is_personal);

    if (isPersonal) {
      totalPersonalSpendingPaise += totalPaise;
      // Personal purchases don't alter shared obligations
    } else {
      totalSharedSpendingPaise += totalPaise;
      // Payer contributed to shared spending
      memberPayments[exp.payer_id] = (memberPayments[exp.payer_id] ?? 0n) + totalPaise;

      // Beneficiaries incurred responsibilities
      (exp.splits || []).forEach((split) => {
        const share = BigInt(split.share_amount);
        memberResponsibilities[split.beneficiary_id] =
          (memberResponsibilities[split.beneficiary_id] ?? 0n) + share;
      });
    }
  });

  // Calculate base balances from shared expenses
  const rawBalances = calculateNetBalance(memberPayments, memberResponsibilities);

  // Adjust balances for recorded settlements:
  // When Member A pays Member B ₹500 via settlement:
  // A's debt is reduced (or credit increased): +500
  // B's credit is reduced (or debt increased): -500
  const adjustedBalances: Record<string, bigint> = { ...rawBalances };

  interface SettlementRow {
    from_id: string;
    to_id: string;
    amount: number;
  }

  ((settlements as unknown as SettlementRow[]) || []).forEach((sett) => {
    const amt = BigInt(sett.amount);
    adjustedBalances[sett.from_id] = (adjustedBalances[sett.from_id] ?? 0n) + amt;
    adjustedBalances[sett.to_id] = (adjustedBalances[sett.to_id] ?? 0n) - amt;
  });

  // Suggest minimal transfers
  const transfers = suggestSettlements(adjustedBalances).map((t) => ({
    from: t.from,
    to: t.to,
    fromProfile: memberMap.get(t.from),
    toProfile: memberMap.get(t.to),
    amount: t.amount,
  }));

  return {
    members,
    memberPayments,
    memberResponsibilities,
    netBalances: adjustedBalances,
    suggestedTransfers: transfers,
    totalSharedSpendingPaise,
    totalPersonalSpendingPaise,
    settlementsHistory: (settlements || []) as unknown as Settlement[],
  };
}
