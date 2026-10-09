import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getCatalogAndCategoriesAction } from '@/actions/catalog';
import { AppShell } from '@/components/layout/AppShell';
import { AddExpenseClient } from './AddExpenseClient';

export default async function AddExpensePage() {
  const { user, profile, household, members } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const { categories, catalogItems } = await getCatalogAndCategoriesAction(household.id);

  return (
    <AppShell household={household} profile={profile}>
      <AddExpenseClient
        currentUserId={user.id}
        household={household}
        members={members}
        categories={categories}
        catalogItems={catalogItems}
      />
    </AppShell>
  );
}
