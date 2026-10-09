import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { calculateHouseholdBalancesAction } from '@/actions/settlements';
import { AppShell } from '@/components/layout/AppShell';
import { SettlementClient } from './SettlementClient';

export default async function SettlementPage() {
  const { user, profile, household, members } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const balanceData = await calculateHouseholdBalancesAction(household.id);

  return (
    <AppShell household={household} profile={profile}>
      <SettlementClient
        currentUserId={user.id}
        household={household}
        members={members}
        balanceData={balanceData}
      />
    </AppShell>
  );
}
