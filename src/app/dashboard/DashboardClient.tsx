'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  PlusCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  PiggyBank,
  Wallet,
  ShoppingBag,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatPaise, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { recordSettlementAction } from '@/actions/settlements';
import type {
  Household,
  HouseholdMember,
  Profile,
  Expense,
  Category,
  Budget,
} from '@/types/database';
import type { HouseholdBalanceData } from '@/actions/settlements';

interface DashboardClientProps {
  currentUserId: string;
  household: Household;
  members: HouseholdMember[];
  profile: Profile | null;
  monthExpenses: Expense[];
  balanceData: HouseholdBalanceData;
  budgetData: {
    overallBudget: Budget | null;
    categoryBudgets: Budget[];
  };
  categories: Category[];
  currentMonth: string;
}

export function DashboardClient({
  currentUserId,
  household,
  members,
  profile,
  monthExpenses,
  balanceData,
  budgetData,
  categories,
  currentMonth,
}: DashboardClientProps) {
  const router = useRouter();
  const [isSettling, setIsSettling] = useState<string | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Setup Supabase Realtime synchronization for shared expenses
  useEffect(() => {
    if (!household.id) return;

    const channel = supabase
      .channel(`household-${household.id}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          // Automatic silent refresh when another roommate makes changes
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settlements',
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household.id, router]);

  // Calculate current month metrics
  let monthSharedPaise = 0n;
  let monthPersonalPaise = 0n;
  const categorySpendingMap = new Map<string, bigint>();

  monthExpenses.forEach((exp) => {
    const amt = BigInt(exp.total_amount);
    if (exp.is_personal) {
      monthPersonalPaise += amt;
    } else {
      monthSharedPaise += amt;
      const catKey = exp.category_id || 'uncategorized';
      categorySpendingMap.set(catKey, (categorySpendingMap.get(catKey) || 0n) + amt);
    }
  });

  // Budget calculations
  const budgetLimitPaise = budgetData.overallBudget
    ? BigInt(budgetData.overallBudget.limit_amount)
    : null;
  const budgetConsumedPercent =
    budgetLimitPaise && budgetLimitPaise > 0n
      ? Number((monthSharedPaise * 100n) / budgetLimitPaise)
      : null;
  const budgetRemainingPaise =
    budgetLimitPaise && budgetLimitPaise > monthSharedPaise
      ? budgetLimitPaise - monthSharedPaise
      : 0n;

  // Current user's net balance
  const userNetBalance = balanceData.netBalances[currentUserId] ?? 0n;

  // Handle instant one-click settlement recording
  const handleQuickSettle = async (fromId: string, toId: string, amount: bigint) => {
    setIsSettling(`${fromId}-${toId}`);
    setSettleError(null);
    try {
      const res = await recordSettlementAction({
        householdId: household.id,
        fromId,
        toId,
        amountPaise: amount,
        notes: `Settled via dashboard suggestion on ${formatDate(new Date())}`,
      });
      if (res.success) {
        router.refresh();
      } else {
        setSettleError(res.error || 'Failed to record settlement.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing settlement.';
      setSettleError(msg);
    } finally {
      setIsSettling(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {profile?.full_name?.split(' ')[0] || 'Roommate'} 👋
          </h1>
          <p className="text-xs text-slate-500">
            {household.name} • Month of {currentMonth}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/expenses/add">
            <Button size="md" className="gap-2 shadow-sm font-semibold">
              <PlusCircle className="h-4 w-4" />
              Add Expense
            </Button>
          </Link>
        </div>
      </div>

      {settleError && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {settleError}
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card 1: Shared Spending */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Shared Month Spend</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {formatPaise(monthSharedPaise)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Across all 3 roommates
            </p>
          </div>
        </Card>

        {/* Card 2: Monthly Budget */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Monthly Budget</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {budgetLimitPaise ? formatPaise(budgetLimitPaise) : 'No Cap'}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              {budgetConsumedPercent !== null ? (
                <span
                  className={`text-[11px] font-medium ${
                    budgetConsumedPercent >= 100
                      ? 'text-rose-600'
                      : budgetConsumedPercent >= 80
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {budgetConsumedPercent}% used
                </span>
              ) : (
                <Link href="/budget" className="text-[11px] text-sky-600 hover:underline">
                  Set budget limit
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Card 3: Your Net Balance */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Your Net Balance</span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                userNetBalance > 0n
                  ? 'bg-emerald-50 text-emerald-600'
                  : userNetBalance < 0n
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-lg sm:text-xl font-bold ${
                userNetBalance > 0n
                  ? 'text-emerald-600'
                  : userNetBalance < 0n
                  ? 'text-rose-600'
                  : 'text-slate-900'
              }`}
            >
              {userNetBalance > 0n ? `+${formatPaise(userNetBalance)}` : formatPaise(userNetBalance)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {userNetBalance > 0n
                ? 'You are owed money'
                : userNetBalance < 0n
                ? 'You owe money'
                : 'All settled up'}
            </p>
          </div>
        </Card>

        {/* Card 4: Personal Spending */}
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Personal Purchases</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {formatPaise(monthPersonalPaise)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Not shared with others
            </p>
          </div>
        </Card>
      </div>

      {/* Budget Progress Indicator */}
      {budgetLimitPaise && (
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">Monthly Budget Usage</span>
            <span className="text-slate-500">
              {formatPaise(monthSharedPaise)} of {formatPaise(budgetLimitPaise)}
            </span>
          </div>
          <ProgressBar value={Number(monthSharedPaise)} max={Number(budgetLimitPaise)} />
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {budgetConsumedPercent}% consumed ({formatPaise(budgetRemainingPaise)} remaining)
            </span>
            {budgetConsumedPercent && budgetConsumedPercent >= 80 && (
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {budgetConsumedPercent >= 100 ? 'Budget exceeded' : 'Approaching budget limit'}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Grid: Roommate Balances & Suggested Settlements */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Roommates Balances */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Roommate Balances</CardTitle>
              <CardDescription>Cumulative shared spending & contributions</CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px]">
              {members.length} / 3 Roommates
            </Badge>
          </CardHeader>

          <div className="space-y-3 mt-3">
            {members.map((member) => {
              const prof = member.profile;
              if (!prof) return null;
              const paid = balanceData.memberPayments[prof.id] ?? 0n;
              const resp = balanceData.memberResponsibilities[prof.id] ?? 0n;
              const net = balanceData.netBalances[prof.id] ?? 0n;
              const isCurrentUser = prof.id === currentUserId;

              return (
                <div
                  key={prof.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
                      {prof.full_name?.charAt(0).toUpperCase() || 'R'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-900">
                        {prof.full_name || prof.email}
                        {isCurrentUser && (
                          <span className="text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.2 rounded font-normal">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Paid: {formatPaise(paid)} • Share: {formatPaise(resp)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs font-bold ${
                        net > 0n
                          ? 'text-emerald-600'
                          : net < 0n
                          ? 'text-rose-600'
                          : 'text-slate-600'
                      }`}
                    >
                      {net > 0n ? `+${formatPaise(net)}` : formatPaise(net)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {net > 0n ? 'receives' : net < 0n ? 'owes' : 'settled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Suggested Settlements */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Suggested Settlements</CardTitle>
              <CardDescription>Minimal direct transfers to reconcile balances</CardDescription>
            </div>
            <Link
              href="/settlement"
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
            >
              Full History
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>

          <div className="space-y-3 mt-3">
            {balanceData.suggestedTransfers.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-xs font-semibold text-slate-800">All balances are settled!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No transfers required at this time.
                </p>
              </div>
            ) : (
              balanceData.suggestedTransfers.map((transfer) => {
                const fromName = transfer.fromProfile?.full_name?.split(' ')[0] || 'Roommate';
                const toName = transfer.toProfile?.full_name?.split(' ')[0] || 'Roommate';
                const key = `${transfer.from}-${transfer.to}`;
                const isExecuting = isSettling === key;
                const userInvolved =
                  currentUserId === transfer.from || currentUserId === transfer.to;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-xl border border-sky-100 bg-sky-50/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <span>{fromName}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span>{toName}</span>
                      </div>
                      <p className="text-[11px] font-semibold text-sky-700">
                        {formatPaise(transfer.amount)}
                      </p>
                    </div>

                    {userInvolved ? (
                      <Button
                        size="sm"
                        variant="primary"
                        isLoading={isExecuting}
                        onClick={() =>
                          handleQuickSettle(transfer.from, transfer.to, transfer.amount)
                        }
                        className="text-xs"
                      >
                        Record Paid
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Pending</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Category Spending Breakdown */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Monthly expense distribution</CardDescription>
          </div>
          <Link
            href="/expenses"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {categories.map((cat) => {
            const spent = categorySpendingMap.get(cat.id) || 0n;
            const pct =
              monthSharedPaise > 0n
                ? Number((spent * 100n) / monthSharedPaise)
                : 0;

            return (
              <div
                key={cat.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {cat.name}
                  </span>
                  <span className="text-xs font-bold text-slate-900">{formatPaise(spent)}</span>
                </div>
                <ProgressBar
                  value={Number(spent)}
                  max={Number(monthSharedPaise || 1n)}
                  barClassName="bg-sky-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 text-right">{pct}% of month</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest expenses recorded in this household</CardDescription>
          </div>
          <Link
            href="/expenses"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            All Transactions
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>

        <div className="divide-y divide-slate-100 mt-2">
          {monthExpenses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No expenses recorded for {currentMonth} yet. Click &quot;Add Expense&quot; to start!
            </div>
          ) : (
            monthExpenses.slice(0, 5).map((exp) => {
              const payerName = exp.payer?.full_name?.split(' ')[0] || 'Roommate';

              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between py-3 px-1 transition-colors hover:bg-slate-50/50"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">
                        {exp.description}
                      </span>
                      {exp.is_personal && (
                        <Badge variant="warning" className="text-[10px]">
                          Personal
                        </Badge>
                      )}
                      {exp.category && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {exp.category.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Paid by {payerName} • {formatDate(exp.purchase_date)}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900">
                      {formatPaise(BigInt(exp.total_amount))}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {exp.splits?.length ? `${exp.splits.length} shares` : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
