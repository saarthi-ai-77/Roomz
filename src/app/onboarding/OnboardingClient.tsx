'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createHouseholdAction, joinHouseholdAction } from '@/actions/households';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Users, Home, UserPlus, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OnboardingClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdName.trim()) {
      setError('Please provide a household name.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await createHouseholdAction(householdName.trim(), 'Asia/Kolkata');
    setIsLoading(false);

    if (res.success) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setError(res.error || 'Failed to create household.');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      setError('Please enter the invitation code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await joinHouseholdAction(inviteToken.trim());
    setIsLoading(false);

    if (res.success) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setError(res.error || 'Failed to join household.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome to Room Manager
          </h1>
          <p className="text-xs text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{userEmail}</span>. Choose an option to get started:
          </p>
        </div>

        {/* Toggle options */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-200/80 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
            }}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all',
              mode === 'create'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Home className="h-4 w-4" />
            Create Household
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError(null);
            }}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all',
              mode === 'join'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <UserPlus className="h-4 w-4" />
            Join Existing Room
          </button>
        </div>

        <Card className="rounded-2xl border-slate-200 p-6 sm:p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          {mode === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-5">
              <CardHeader className="p-0">
                <CardTitle className="text-base font-semibold">Start a new shared room</CardTitle>
                <CardDescription>
                  You will be the household creator. You can invite your 2 roommates right after setup. Preloaded Indian groceries and starter categories will be configured automatically.
                </CardDescription>
              </CardHeader>

              <Input
                label="Household Name"
                placeholder="e.g. Flat 302 Roomies, Sector 62"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
                autoFocus
              />

              <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs text-sky-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  Starter Catalog Included
                </div>
                <p className="text-[11px] text-sky-700">
                  Includes staples, dairy, veggies, cleaning supplies, and utilities with suggested INR prices ready to track.
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full gap-2" isLoading={isLoading}>
                Create Household
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-5">
              <CardHeader className="p-0">
                <CardTitle className="text-base font-semibold">Join with Invitation Code</CardTitle>
                <CardDescription>
                  Enter the 8-character invitation code provided by your roommate.
                </CardDescription>
              </CardHeader>

              <Input
                label="Invitation Code"
                placeholder="e.g. A9B2X7K1"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value.toUpperCase())}
                required
                autoFocus
                className="font-mono text-center tracking-widest uppercase text-base"
              />

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <p>
                  Each household supports up to 3 active members. Joining is atomic and links your account immediately to the shared ledger.
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full gap-2" isLoading={isLoading}>
                Join Household
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
