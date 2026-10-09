import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { OnboardingClient } from './OnboardingClient';

export default async function OnboardingPage() {
  const { user, household } = await getCurrentUserAndHousehold();

  if (!user) {
    redirect('/login');
  }

  if (household) {
    redirect('/dashboard');
  }

  return <OnboardingClient userEmail={user.email} />;
}
