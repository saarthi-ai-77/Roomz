'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ArrowRight,
  Send,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPaise, formatDate, parseINRToPaise } from '@/lib/utils';
import { recordSettlementAction } from '@/actions/settlements';
import type {
  Household,
  HouseholdMember,
} from '@/types/database';
import type { HouseholdBalanceData } from '@/actions/settlements';

interface SettlementClientProps {
  currentUserId: string;
  household: Household;
  members: HouseholdMember[];
  balanceData: HouseholdBalanceData;
}

export function SettlementClient({
  currentUserId,
  household,
  members,
  balanceData,
}: SettlementClientProps) {
  const router = useRouter();

  const [fromId, setFromId] = useState(currentUserId);
  const [toId, setToId] = useState(() => {
    const other = members.find((m) => m.profile_id !== currentUserId);
    return other ? other.profile_id : '';
  });
  const [amountRupees, setAmountRupees] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Quick select a suggested transfer
  const handleSelectSuggested = (transfer: {
    from: string;
    to: string;
    amount: bigint;
  }) => {
    setFromId(transfer.from);
    setToId(transfer.to);
    setAmountRupees((Number(transfer.amount) / 100).toFixed(2));
    setNotes('Settlement per suggestion');
  };

  const handleRecordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) {
      setError('Both sender and receiver are required.');
      return;
    }
    if (fromId === toId) {
      setError('Sender and receiver cannot be the same member.');
      return;
    }
    const amtPaise = parseINRToPaise(amountRupees);
    if (amtPaise <= 0n) {
      setError('Amount must be greater than zero.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const res = await recordSettlementAction({
      householdId: household.id,
      fromId,
      toId,
      amountPaise: amtPaise,
      notes: notes.trim() || null,
    });

    setIsLoading(false);
    if (res.success) {
      setAmountRupees('');
      setNotes('');
      setSuccess('Settlement payment recorded successfully! Balances updated.');
      router.refresh();
    } else {
      setError(res.error || 'Failed to record settlement.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Monthly Settlement
        </h1>
        <p className="text-xs text-slate-500">
          Reconcile shared balances and record direct payments between roommates. Outstanding balances carry forward across months.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
          {success}
        </div>
      )}

      {/* Member Balances Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {members.map((m) => {
          const prof = m.profile;
          if (!prof) return null;
          const paid = balanceData.memberPayments[prof.id] ?? 0n;
          const resp = balanceData.memberResponsibilities[prof.id] ?? 0n;
          const net = balanceData.netBalances[prof.id] ?? 0n;
          const isCurrentUser = prof.id === currentUserId;

          return (
            <Card key={prof.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
                    {prof.full_name?.charAt(0).toUpperCase() || 'R'}
                  </div>
                  <span className="font-semibold text-xs text-slate-900 truncate">
                    {prof.full_name || prof.email}
                    {isCurrentUser && ' (You)'}
                  </span>
                </div>

                <Badge
                  variant={net > 0n ? 'success' : net < 0n ? 'danger' : 'default'}
                  className="text-[11px]"
                >
                  {net > 0n ? 'Receives' : net < 0n ? 'Owes' : 'Settled'}
                </Badge>
              </div>

              <div className="pt-1">
                <div
                  className={`text-lg font-bold ${
                    net > 0n
                      ? 'text-emerald-600'
                      : net < 0n
                      ? 'text-rose-600'
                      : 'text-slate-800'
                  }`}
                >
                  {net > 0n ? `+${formatPaise(net)}` : formatPaise(net)}
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between mt-0.5">
                  <span>Paid: {formatPaise(paid)}</span>
                  <span>Share: {formatPaise(resp)}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Suggested Transfers & Instructions (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="p-5 space-y-4">
            <CardHeader className="p-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <CardTitle className="text-base">Suggested Transfers</CardTitle>
              </div>
              <CardDescription>
                Calculated by the accounting engine to settle all debts with the minimal number of transfers.
              </CardDescription>
            </CardHeader>

            <div className="space-y-3">
              {balanceData.suggestedTransfers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  All accounts are fully reconciled. No pending transfers.
                </div>
              ) : (
                balanceData.suggestedTransfers.map((t, idx) => {
                  const fromName = t.fromProfile?.full_name?.split(' ')[0] || 'Roommate';
                  const toName = t.toProfile?.full_name?.split(' ')[0] || 'Roommate';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                          <span className="text-slate-800">{fromName}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="text-slate-800">{toName}</span>
                        </div>
                        <span className="text-sm font-extrabold text-sky-700 block">
                          {formatPaise(t.amount)}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectSuggested(t)}
                        className="text-xs bg-white hover:bg-sky-50"
                      >
                        Use for Payment
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right: Record Payment Form (6 cols) */}
        <div className="lg:col-span-6">
          <Card className="p-5 sm:p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base">Record Settlement Payment</CardTitle>
              <CardDescription>
                Transfers between roommates do not count as household purchases and only reduce debts.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleRecordSettlement} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Sender (Who Paid)</label>
                  <select
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                    required
                  >
                    {members.map((m) => (
                      <option key={m.profile_id} value={m.profile_id}>
                        {m.profile?.full_name || m.profile?.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Receiver (Who Received)</label>
                  <select
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                    required
                  >
                    {members.map((m) => (
                      <option key={m.profile_id} value={m.profile_id}>
                        {m.profile?.full_name || m.profile?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Input
                  label="Amount (₹ INR) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Notes / Payment Method (Optional)"
                  placeholder="e.g. Google Pay UPI, PhonePe, Cash"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                variant="primary"
                isLoading={isLoading}
                className="w-full font-semibold gap-2"
              >
                <Send className="h-4 w-4" />
                Record Settlement
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Settlement History Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Recorded Settlement History</CardTitle>
            <CardDescription>
              Audit record of completed transfers between members
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {balanceData.settlementsHistory.length} Recorded
          </Badge>
        </CardHeader>

        <div className="divide-y divide-slate-100 mt-2">
          {balanceData.settlementsHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No settlements recorded yet.
            </div>
          ) : (
            balanceData.settlementsHistory.map((sett) => {
              const fromName = sett.from_profile?.full_name?.split(' ')[0] || 'Roommate';
              const toName = sett.to_profile?.full_name?.split(' ')[0] || 'Roommate';

              return (
                <div
                  key={sett.id}
                  className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/50"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                      <span>{fromName}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span>{toName}</span>
                      <Badge variant="success" className="text-[10px]">
                        Completed
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(sett.settled_at)}
                      {sett.notes && ` • "${sett.notes}"`}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                      {formatPaise(BigInt(sett.amount))}
                    </span>
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
