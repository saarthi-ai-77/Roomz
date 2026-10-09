import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getExpensesAction } from '@/actions/expenses';
import { getCatalogAndCategoriesAction } from '@/actions/catalog';
import { getCurrentMonthKolkata } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { ExpensesListClient } from './ExpensesListClient';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; categoryId?: string; payerId?: string }>;
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

  const [expenses, catalogData] = await Promise.all([
    getExpensesAction({
      householdId: household.id,
      month: activeMonth,
      categoryId: params.categoryId,
      payerId: params.payerId,
    }),
    getCatalogAndCategoriesAction(household.id),
  ]);

  return (
    <AppShell household={household} profile={profile}>
      <ExpensesListClient
        household={household}
        members={members}
        initialExpenses={expenses}
        categories={catalogData.categories}
        activeMonth={activeMonth}
      />
    </AppShell>
  );
}
