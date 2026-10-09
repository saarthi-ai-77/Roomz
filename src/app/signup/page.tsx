'use client';

import React, { useActionState } from 'react';
import Link from 'next/link';
import { signUpAction, type AuthState } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Users } from 'lucide-react';

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signUpAction,
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
            Create Roommate Account
          </h1>
          <p className="text-xs text-slate-500">
            Join your room&apos;s expense ledger or create a new household.
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
                label="Full Name"
                type="text"
                name="fullName"
                required
                placeholder="e.g. Rahul Sharma"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1">
              <Input
                label="Email Address"
                type="email"
                name="email"
                required
                placeholder="rahul@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                name="password"
                required
                placeholder="At least 6 characters"
                autoComplete="new-password"
                helperText="Must be at least 6 characters"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isPending}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-sky-600 hover:text-sky-700 underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
