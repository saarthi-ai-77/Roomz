import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getBudgetsAction } from '@/actions/budgets';
import { getExpensesAction } from '@/actions/expenses';
import { getCatalogAndCategoriesAction } from '@/actions/catalog';
import { getCurrentMonthKolkata } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { BudgetClient } from './BudgetClient';

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { user, profile, household } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const params = await searchParams;
  const activeMonth = params.month || getCurrentMonthKolkata();

  const [budgets, expenses, catalogData] = await Promise.all([
    getBudgetsAction(household.id, activeMonth),
    getExpensesAction({ householdId: household.id, month: activeMonth }),
    getCatalogAndCategoriesAction(household.id),
  ]);

  return (
    <AppShell household={household} profile={profile}>
      <BudgetClient
        household={household}
        activeMonth={activeMonth}
        overallBudget={budgets.overallBudget}
        categoryBudgets={budgets.categoryBudgets}
        categories={catalogData.categories}
        expenses={expenses}
      />
    </AppShell>
  );
}
