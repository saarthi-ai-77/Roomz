'use server';

import { getSupabaseServer } from '@/lib/supabase.server';
import { revalidatePath } from 'next/cache';
import type { Budget } from '@/types/database';

export async function setBudgetAction(input: {
  householdId: string;
  month: string; // YYYY-MM
  limitAmountPaise: bigint;
  categoryId?: string | null;
}) {
  const { householdId, month, limitAmountPaise, categoryId = null } = input;

  if (limitAmountPaise < 0n) {
    return { success: false, error: 'Budget limit cannot be negative.' };
  }

  const formattedMonth = `${month}-01`;

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Unauthorized.' };
  }

  // Upsert budget
  const { error } = await supabase.from('budgets').upsert(
    {
      household_id: householdId,
      month: formattedMonth,
      category_id: categoryId || null,
      limit_amount: Number(limitAmountPaise),
    },
    {
      onConflict: 'household_id,month,category_id',
    }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/budget');
  return { success: true };
}

export async function getBudgetsAction(
  householdId: string,
  month: string // YYYY-MM
): Promise<{
  overallBudget: Budget | null;
  categoryBudgets: Budget[];
}> {
  try {
    const formattedMonth = `${month}-01`;
    const supabase = await getSupabaseServer();

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
      .eq('household_id', householdId)
      .eq('month', formattedMonth);

    if (error) {
      console.error('Error fetching budgets:', error);
      return { overallBudget: null, categoryBudgets: [] };
    }

    const overall = (budgets || []).find((b: unknown) => !(b as Budget).category_id) || null;
    const catBudgets = (budgets || []).filter((b: unknown) => Boolean((b as Budget).category_id));

    return {
      overallBudget: overall as unknown as Budget,
      categoryBudgets: catBudgets as unknown as Budget[],
    };
  } catch (err) {
    console.error('getBudgetsAction error:', err);
    return { overallBudget: null, categoryBudgets: [] };
  }
}
