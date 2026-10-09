import React from 'react';
import { Navbar } from './Navbar';
import { MobileNav } from './MobileNav';
import type { Household, Profile } from '@/types/database';

interface AppShellProps {
  children: React.ReactNode;
  household?: Household | null;
  profile?: Profile | null;
}

export function AppShell({ children, household, profile }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 pb-20 md:pb-8">
      <Navbar household={household} profile={profile} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
