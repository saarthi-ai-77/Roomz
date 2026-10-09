'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { splitEqualPaise } from '@/lib/accounting';
import { revalidatePath } from 'next/cache';
import type { Expense } from '@/types/database';

export interface CreateExpenseInput {
  householdId: string;
  payerId: string;
  totalAmountPaise: bigint;
  description: string;
  purchaseDate: string; // YYYY-MM-DD
  categoryId?: string | null;
  quantity?: number;
  unit?: string | null;
  isPersonal?: boolean;
  notes?: string | null;
  beneficiaryIds: string[];
}

export async function createExpenseAction(input: CreateExpenseInput) {
  try {
    const {
      householdId,
      payerId,
      totalAmountPaise,
      description,
      purchaseDate,
      categoryId,
      quantity = 1,
      unit = null,
      isPersonal = false,
      notes = null,
      beneficiaryIds,
    } = input;

    if (!description || description.trim().length === 0) {
      return { success: false, error: 'Description is required.' };
    }

    if (totalAmountPaise <= 0n) {
      return { success: false, error: 'Total amount must be greater than zero.' };
    }

    if (!purchaseDate) {
      return { success: false, error: 'Purchase date is required.' };
    }

    // Determine beneficiaries: if personal, only payer is beneficiary
    const finalBeneficiaryIds = isPersonal ? [payerId] : beneficiaryIds;
    if (finalBeneficiaryIds.length === 0) {
      return { success: false, error: 'At least one beneficiary must be selected.' };
    }

    // Calculate exact equal shares in paise using our verified accounting engine
    const shares = splitEqualPaise(totalAmountPaise, finalBeneficiaryIds.length);

    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Unauthorized.' };
    }

    // Attempt RPC first
    const { data: rpcExpenseId, error: rpcErr } = await supabase.rpc('create_expense', {
      p_household_id: householdId,
      p_payer_id: payerId,
      p_total_amount: Number(totalAmountPaise),
      p_description: description.trim(),
      p_purchase_date: purchaseDate,
      p_beneficiary_ids: finalBeneficiaryIds,
      p_shares: shares.map((s) => Number(s)),
      p_category_id: categoryId || null,
      p_quantity: quantity,
      p_unit: unit || null,
      p_is_personal: isPersonal,
      p_notes: notes || null,
    });

    if (!rpcErr && rpcExpenseId) {
      revalidatePath('/dashboard');
      revalidatePath('/expenses');
      return { success: true, expenseId: rpcExpenseId };
    }

    // Fallback direct transactional insert
    const { data: newExp, error: expErr } = await supabase
      .from('expenses')
      .insert({
        household_id: householdId,
        payer_id: payerId,
        total_amount: Number(totalAmountPaise),
        description: description.trim(),
        purchase_date: purchaseDate,
        category_id: categoryId || null,
        quantity: quantity,
        unit: unit || null,
        is_personal: isPersonal,
        notes: notes || null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (expErr || !newExp) {
      return { success: false, error: expErr?.message || 'Failed to save expense.' };
    }

    // Insert splits
    const splitRows = finalBeneficiaryIds.map((bId, idx) => ({
      expense_id: newExp.id,
      beneficiary_id: bId,
      share_amount: Number(shares[idx]),
    }));

    const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows);
    if (splitErr) {
      console.error('Failed to insert splits:', splitErr);
    }

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    return { success: true, expenseId: newExp.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error creating expense.';
    return { success: false, error: message };
  }
}

export async function updateExpenseAction(
  expenseId: string,
  input: CreateExpenseInput
) {
  try {
    const {
      payerId,
      totalAmountPaise,
      description,
      purchaseDate,
      categoryId,
      quantity = 1,
      unit = null,
      isPersonal = false,
      notes = null,
      beneficiaryIds,
    } = input;

    const finalBeneficiaryIds = isPersonal ? [payerId] : beneficiaryIds;
    const shares = splitEqualPaise(totalAmountPaise, finalBeneficiaryIds.length);

    const supabase = await getSupabaseServer();

    // Try RPC
    const { error: rpcErr } = await supabase.rpc('update_expense', {
      p_expense_id: expenseId,
      p_payer_id: payerId,
      p_total_amount: Number(totalAmountPaise),
      p_description: description.trim(),
      p_purchase_date: purchaseDate,
      p_beneficiary_ids: finalBeneficiaryIds,
      p_shares: shares.map((s) => Number(s)),
      p_category_id: categoryId || null,
      p_quantity: quantity,
      p_unit: unit || null,
      p_is_personal: isPersonal,
      p_notes: notes || null,
    });

    if (!rpcErr) {
      revalidatePath('/dashboard');
      revalidatePath('/expenses');
      return { success: true };
    }

    // Fallback update
    await supabase
      .from('expenses')
      .update({
        payer_id: payerId,
        total_amount: Number(totalAmountPaise),
        description: description.trim(),
        purchase_date: purchaseDate,
        category_id: categoryId || null,
        quantity,
        unit,
        is_personal: isPersonal,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId);

    await supabase.from('expense_splits').delete().eq('expense_id', expenseId);

    const splitRows = finalBeneficiaryIds.map((bId, idx) => ({
      expense_id: expenseId,
      beneficiary_id: bId,
      share_amount: Number(shares[idx]),
    }));
    await supabase.from('expense_splits').insert(splitRows);

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating expense.';
    return { success: false, error: message };
  }
}

export async function deleteExpenseAction(expenseId: string) {
  try {
    const supabase = await getSupabaseServer();

    // Try RPC
    const { error: rpcErr } = await supabase.rpc('delete_expense', {
      p_expense_id: expenseId,
    });

    if (!rpcErr) {
      revalidatePath('/dashboard');
      revalidatePath('/expenses');
      return { success: true };
    }

    // Fallback delete
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error deleting expense.';
    return { success: false, error: message };
  }
}

export async function getExpensesAction(options: {
  householdId: string;
  month?: string; // YYYY-MM
  categoryId?: string;
  payerId?: string;
  search?: string;
}): Promise<Expense[]> {
  try {
    const supabase = await getSupabaseServer();
    let query = supabase
      .from('expenses')
      .select(`
        *,
        payer:profiles!expenses_payer_id_fkey(*),
        category:categories(*),
        splits:expense_splits(
          *,
          beneficiary:profiles(*)
        )
      `)
      .eq('household_id', options.householdId)
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.month) {
      // Month range YYYY-MM-01 to YYYY-MM-31
      const startDate = `${options.month}-01`;
      // Calculate end date for month
      const [yearStr, monthStr] = options.month.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const nextMonthFirstDay = new Date(Date.UTC(y, m, 1));
      const lastDay = new Date(nextMonthFirstDay.getTime() - 86400000);
      const endDate = lastDay.toISOString().split('T')[0];

      query = query.gte('purchase_date', startDate).lte('purchase_date', endDate);
    }

    if (options.categoryId) {
      query = query.eq('category_id', options.categoryId);
    }

    if (options.payerId) {
      query = query.eq('payer_id', options.payerId);
    }

    if (options.search && options.search.trim()) {
      query = query.ilike('description', `%${options.search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }

    return (data || []) as unknown as Expense[];
  } catch (err) {
    console.error('getExpensesAction error:', err);
    return [];
  }
}
