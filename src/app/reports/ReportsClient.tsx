'use client';

import React from 'react';
import {
  FileSpreadsheet,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatPaise } from '@/lib/utils';
import type {
  Household,
  HouseholdMember,
  Expense,
  Category,
} from '@/types/database';
import type { HouseholdBalanceData } from '@/actions/settlements';

interface ReportsClientProps {
  household: Household;
  members: HouseholdMember[];
  activeMonth: string;
  expenses: Expense[];
  balanceData: HouseholdBalanceData;
  categories: Category[];
}

export function ReportsClient({
  household,
  members,
  activeMonth,
  expenses,
  balanceData,
  categories,
}: ReportsClientProps) {

  // Compute month aggregates
  let totalSharedPaise = 0n;
  let totalPersonalPaise = 0n;
  const categoryTotals = new Map<string, bigint>();

  expenses.forEach((exp) => {
    const amt = BigInt(exp.total_amount);
    if (exp.is_personal) {
      totalPersonalPaise += amt;
    } else {
      totalSharedPaise += amt;
      const catKey = exp.category_id || 'uncategorized';
      categoryTotals.set(catKey, (categoryTotals.get(catKey) || 0n) + amt);
    }
  });

  const grandTotalPaise = totalSharedPaise + totalPersonalPaise;

  // CSV Export function
  const handleExportCSV = () => {
    if (expenses.length === 0) return;

    const headers = [
      'Date',
      'Description',
      'Category',
      'Total Amount (INR)',
      'Total Amount (Paise)',
      'Paid By',
      'Purchase Type',
      'Beneficiaries',
      'Notes',
    ];

    const rows = expenses.map((exp) => {
      const payerName = exp.payer?.full_name || exp.payer?.email || 'Roommate';
      const catName = exp.category?.name || 'Uncategorized';
      const amountINR = (exp.total_amount / 100).toFixed(2);
      const purchaseType = exp.is_personal ? 'Personal' : 'Shared';
      const beneficiaries = exp.splits
        ?.map((s) => s.beneficiary?.full_name || 'Roommate')
        .join('; ') || '';
      const notesClean = (exp.notes || '').replace(/"/g, '""');
      const descClean = exp.description.replace(/"/g, '""');

      return [
        `"${exp.purchase_date}"`,
        `"${descClean}"`,
        `"${catName}"`,
        `"${amountINR}"`,
        `"${exp.total_amount}"`,
        `"${payerName}"`,
        `"${purchaseType}"`,
        `"${beneficiaries}"`,
        `"${notesClean}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${household.name.replace(/\s+/g, '_')}_expenses_${activeMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Monthly Reports & Export
          </h1>
          <p className="text-xs text-slate-500">
            Financial reconciliation and CSV downloads for {household.name} • {activeMonth}
          </p>
        </div>

        <Button
          size="md"
          variant="primary"
          onClick={handleExportCSV}
          disabled={expenses.length === 0}
          className="gap-2 font-semibold shadow-sm"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Export Transactions (CSV)
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Shared Household Spend</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {formatPaise(totalSharedPaise)}
          </div>
          <span className="text-[11px] text-slate-400">Divided among roommates</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Personal Purchases</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {formatPaise(totalPersonalPaise)}
          </div>
          <span className="text-[11px] text-slate-400">Sole member responsibility</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold text-slate-500">Total Recorded</span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {formatPaise(grandTotalPaise)}
          </div>
          <span className="text-[11px] text-slate-400">{expenses.length} total transactions</span>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-bold">Category Spending Breakdown</CardTitle>
          <CardDescription>
            Categorized distribution of shared purchases for {activeMonth}
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          {categories.map((cat) => {
            const spent = categoryTotals.get(cat.id) || 0n;
            const pct =
              totalSharedPaise > 0n
                ? Number((spent * 100n) / totalSharedPaise)
                : 0;

            if (spent === 0n) return null;

            return (
              <div key={cat.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{formatPaise(spent)}</span>
                    <span className="text-slate-400 text-[11px]">({pct}%)</span>
                  </div>
                </div>
                <ProgressBar
                  value={Number(spent)}
                  max={Number(totalSharedPaise || 1n)}
                  barClassName="bg-sky-500"
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Member Contributions Summary */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-base font-bold">Member Fair Share & Net Balances</CardTitle>
          <CardDescription>
            Cumulative balance sheet showing who contributed and who owes
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-semibold">Roommate</th>
                <th className="pb-2 font-semibold text-right">Total Paid</th>
                <th className="pb-2 font-semibold text-right">Fair Share Obligation</th>
                <th className="pb-2 font-semibold text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const prof = m.profile;
                if (!prof) return null;
                const paid = balanceData.memberPayments[prof.id] ?? 0n;
                const resp = balanceData.memberResponsibilities[prof.id] ?? 0n;
                const net = balanceData.netBalances[prof.id] ?? 0n;

                return (
                  <tr key={prof.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-slate-900">
                      {prof.full_name || prof.email}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-700">
                      {formatPaise(paid)}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-700">
                      {formatPaise(resp)}
                    </td>
                    <td
                      className={`py-3 text-right font-bold ${
                        net > 0n
                          ? 'text-emerald-600'
                          : net < 0n
                          ? 'text-rose-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {net > 0n ? `+${formatPaise(net)}` : formatPaise(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
