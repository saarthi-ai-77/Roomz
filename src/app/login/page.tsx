'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { signInAction, type AuthState } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Users } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signInAction,
    {}
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-md">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign in to Room Manager
          </h1>
          <p className="text-xs text-slate-500">
            Manage shared expenses, groceries, and settlements with your roommates.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
          <form action={formAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
                {state.error}
              </div>
            )}

            <div className="space-y-1">
              <Input
                label="Email Address"
                type="email"
                name="email"
                required
                placeholder="roommate@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                name="password"
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isPending}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              New roommate?{' '}
              <Link
                href="/signup"
                className="font-semibold text-sky-600 hover:text-sky-700 underline underline-offset-2"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
