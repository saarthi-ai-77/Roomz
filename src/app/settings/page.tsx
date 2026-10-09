import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { getHouseholdInvitationsAction } from '@/actions/households';
import { AppShell } from '@/components/layout/AppShell';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const { user, profile, household, members } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (!household) {
    redirect('/onboarding');
  }

  const invitations = await getHouseholdInvitationsAction(household.id);

  return (
    <AppShell household={household} profile={profile}>
      <SettingsClient
        currentUserId={user.id}
        profile={profile}
        household={household}
        members={members}
        invitations={invitations}
      />
    </AppShell>
  );
}
