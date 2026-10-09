import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getExpensesAction } from '@/actions/expenses';
import { calculateHouseholdBalancesAction } from '@/actions/settlements';
import { getBudgetsAction } from '@/actions/budgets';
import { getCatalogAndCategoriesAction } from '@/actions/catalog';
import { getCurrentMonthKolkata } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const { user, profile, household, members } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const currentMonth = getCurrentMonthKolkata(); // e.g. "2026-10"

  // Fetch real data in parallel
  const [monthExpenses, balanceData, budgetData, catalogData] = await Promise.all([
    getExpensesAction({ householdId: household.id, month: currentMonth }),
    calculateHouseholdBalancesAction(household.id),
    getBudgetsAction(household.id, currentMonth),
    getCatalogAndCategoriesAction(household.id),
  ]);

  return (
    <AppShell household={household} profile={profile}>
      <DashboardClient
        currentUserId={user.id}
        household={household}
        members={members}
        profile={profile}
        monthExpenses={monthExpenses}
        balanceData={balanceData}
        budgetData={budgetData}
        categories={catalogData.categories}
        currentMonth={currentMonth}
      />
    </AppShell>
  );
}
