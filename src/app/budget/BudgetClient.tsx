'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Save,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatPaise, parseINRToPaise } from '@/lib/utils';
import { setBudgetAction } from '@/actions/budgets';
import type { Household, Budget, Category, Expense } from '@/types/database';

interface BudgetClientProps {
  household: Household;
  activeMonth: string;
  overallBudget: Budget | null;
  categoryBudgets: Budget[];
  categories: Category[];
  expenses: Expense[];
}

export function BudgetClient({
  household,
  activeMonth,
  overallBudget,
  categoryBudgets,
  categories,
  expenses,
}: BudgetClientProps) {
  const router = useRouter();

  const [overallLimitRupees, setOverallLimitRupees] = useState(() => {
    return overallBudget ? (overallBudget.limit_amount / 100).toString() : '';
  });

  const [selectedCatId, setSelectedCatId] = useState('');
  const [catLimitRupees, setCatLimitRupees] = useState('');

  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [isLoadingCat, setIsLoadingCat] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Compute month spending
  let totalSharedSpendingPaise = 0n;
  const categorySpendingMap = new Map<string, bigint>();

  expenses.forEach((exp) => {
    if (!exp.is_personal) {
      const amt = BigInt(exp.total_amount);
      totalSharedSpendingPaise += amt;
      const catKey = exp.category_id || 'uncategorized';
      categorySpendingMap.set(catKey, (categorySpendingMap.get(catKey) || 0n) + amt);
    }
  });

  const overallLimitPaise = overallBudget ? BigInt(overallBudget.limit_amount) : 0n;
  const overallConsumedPercent =
    overallLimitPaise > 0n
      ? Number((totalSharedSpendingPaise * 100n) / overallLimitPaise)
      : null;
  const remainingPaise =
    overallLimitPaise > totalSharedSpendingPaise
      ? overallLimitPaise - totalSharedSpendingPaise
      : 0n;

  // Save overall budget
  const handleSaveOverall = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseINRToPaise(overallLimitRupees);
    setIsLoadingOverall(true);
    setStatusMessage(null);

    const res = await setBudgetAction({
      householdId: household.id,
      month: activeMonth,
      limitAmountPaise: paise,
      categoryId: null,
    });

    setIsLoadingOverall(false);
    if (res.success) {
      setStatusMessage('Household monthly budget cap saved successfully.');
      router.refresh();
    }
  };

  // Save category budget
  const handleSaveCategoryBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;
    const paise = parseINRToPaise(catLimitRupees);
    setIsLoadingCat(true);
    setStatusMessage(null);

    const res = await setBudgetAction({
      householdId: household.id,
      month: activeMonth,
      limitAmountPaise: paise,
      categoryId: selectedCatId,
    });

    setIsLoadingCat(false);
    if (res.success) {
      setCatLimitRupees('');
      setStatusMessage('Category budget saved successfully.');
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Monthly Budgets
        </h1>
        <p className="text-xs text-slate-500">
          Track spending thresholds and control shared living expenses for {activeMonth}.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
          {statusMessage}
        </div>
      )}

      {/* Main Budget Status Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overall Household Cap ({activeMonth})
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {overallLimitPaise > 0n ? formatPaise(overallLimitPaise) : 'No Budget Set'}
            </div>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <span className="text-xs font-semibold text-slate-500">Total Spent So Far</span>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {formatPaise(totalSharedSpendingPaise)}
            </div>
            <span className="text-[11px] text-slate-500 block">
              {overallLimitPaise > 0n && (
                <>
                  {overallConsumedPercent}% used • {formatPaise(remainingPaise)} remaining
                </>
              )}
            </span>
          </div>
        </div>

        {overallLimitPaise > 0n && (
          <div className="space-y-1.5 pt-2">
            <ProgressBar
              value={Number(totalSharedSpendingPaise)}
              max={Number(overallLimitPaise)}
              className="h-3.5"
            />
            {overallConsumedPercent && overallConsumedPercent >= 80 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mt-2">
                <AlertTriangle className="h-4 w-4" />
                {overallConsumedPercent >= 100
                  ? 'Budget cap exceeded for this month.'
                  : '80%+ of budget consumed. Consider restraining non-essential purchases.'}
              </div>
            )}
          </div>
        )}

        {/* Set / Update Form */}
        <form
          onSubmit={handleSaveOverall}
          className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-end gap-3"
        >
          <div className="flex-1 w-full space-y-1">
            <Input
              label="Set Monthly Spending Cap (₹ INR)"
              type="number"
              step="100"
              placeholder="e.g. 20000"
              value={overallLimitRupees}
              onChange={(e) => setOverallLimitRupees(e.target.value)}
              required
            />
          </div>
          <Button type="submit" size="md" isLoading={isLoadingOverall} className="gap-2 shrink-0">
            <Save className="h-4 w-4" />
            Save Budget Cap
          </Button>
        </form>
      </Card>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Category Limits List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <CardHeader className="p-0">
            <CardTitle className="text-base font-bold">Category Limits</CardTitle>
            <CardDescription>
              Optional limits for individual expense categories.
            </CardDescription>
          </CardHeader>

          <div className="space-y-3">
            {categories.map((cat) => {
              const catBudget = categoryBudgets.find((b) => b.category_id === cat.id);
              const limitPaise = catBudget ? BigInt(catBudget.limit_amount) : 0n;
              const spentPaise = categorySpendingMap.get(cat.id) || 0n;
              const pct =
                limitPaise > 0n ? Number((spentPaise * 100n) / limitPaise) : null;

              return (
                <Card key={cat.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-900 block">
                        {cat.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Spent: {formatPaise(spentPaise)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">
                        {limitPaise > 0n ? formatPaise(limitPaise) : 'No limit'}
                      </span>
                      {pct !== null && (
                        <span
                          className={`text-[11px] block font-medium ${
                            pct >= 100 ? 'text-rose-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {pct}% used
                        </span>
                      )}
                    </div>
                  </div>

                  {limitPaise > 0n && (
                    <ProgressBar
                      value={Number(spentPaise)}
                      max={Number(limitPaise)}
                      barClassName="bg-sky-500"
                    />
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right: Configure Category Limit (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="p-5 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-sm">Set Category Limit</CardTitle>
              <CardDescription>
                Assign a dedicated budget limit to a specific category.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSaveCategoryBudget} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => setSelectedCatId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Input
                  label="Category Limit (₹ INR)"
                  type="number"
                  step="50"
                  placeholder="e.g. 5000"
                  value={catLimitRupees}
                  onChange={(e) => setCatLimitRupees(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" size="md" isLoading={isLoadingCat} className="w-full">
                Set Category Budget
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
