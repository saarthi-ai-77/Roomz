import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUserAndHousehold } from '@/actions/auth';
import { Button } from '@/components/ui/Button';
import {
  Users,
  ArrowRight,
  Receipt,
  PiggyBank,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';

export default async function HomePage() {
  const { user, household } = await getCurrentUserAndHousehold();

  if (user) {
    if (household) {
      redirect('/dashboard');
    } else {
      redirect('/onboarding');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5 font-bold text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-base tracking-tight font-extrabold text-slate-900">
              Room Manager
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs font-semibold">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm" className="text-xs font-semibold shadow-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24 text-center">
        <div className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            Built for 3 Roommates • Exact Paise Calculations
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Stress-free shared living expenses, groceries & settlements.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
            Track daily groceries, room utilities, and maintenance. Split expenses with exact paise precision, set monthly budgets, and settle debts without confusion.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 font-semibold shadow-md">
                Create Roommate Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto font-medium">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl text-left">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Receipt className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Preloaded Indian Catalog</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Atta, dal, milk, veggies, Wi-Fi, electricity bills, and custom items with suggested prices ready to record in seconds.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Smart Settlement Engine</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Computes minimal transfer suggestions so debts are cleared quickly. Settlements never inflate spending totals.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <PiggyBank className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Monthly Budgets & Alerts</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configure a monthly room spending cap and category limits with alert thresholds and calendar-month reporting.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4">
          Room Manager • Designed for 3 Roommates • IST (Asia/Kolkata)
        </div>
      </footer>
    </div>
  );
}
