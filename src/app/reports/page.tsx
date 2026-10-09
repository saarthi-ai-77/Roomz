import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getExpensesAction } from '@/actions/expenses';
import { calculateHouseholdBalancesAction } from '@/actions/settlements';
import { getCatalogAndCategoriesAction } from '@/actions/catalog';
import { getCurrentMonthKolkata } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { ReportsClient } from './ReportsClient';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { user, profile, household, members } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const params = await searchParams;
  const activeMonth = params.month || getCurrentMonthKolkata();

  const [expenses, balanceData, catalogData] = await Promise.all([
    getExpensesAction({ householdId: household.id, month: activeMonth }),
    calculateHouseholdBalancesAction(household.id),
    getCatalogAndCategoriesAction(household.id),
  ]);

  return (
    <AppShell household={household} profile={profile}>
      <ReportsClient
        household={household}
        members={members}
        activeMonth={activeMonth}
        expenses={expenses}
        balanceData={balanceData}
        categories={catalogData.categories}
      />
    </AppShell>
  );
}
