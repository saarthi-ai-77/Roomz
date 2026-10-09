'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Receipt,
  Trash2,
  Edit2,
  X,
  AlertCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatPaise, formatDate, parseINRToPaise } from '@/lib/utils';
import { deleteExpenseAction, updateExpenseAction } from '@/actions/expenses';
import type {
  Household,
  HouseholdMember,
  Expense,
  Category,
} from '@/types/database';

interface ExpensesListClientProps {
  household: Household;
  members: HouseholdMember[];
  initialExpenses: Expense[];
  categories: Category[];
  activeMonth: string;
}

export function ExpensesListClient({
  household,
  members,
  initialExpenses,
  categories,
  activeMonth,
}: ExpensesListClientProps) {
  const router = useRouter();

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedPayer, setSelectedPayer] = useState('all');

  // Deletion modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [editPayerId, setEditPayerId] = useState('');
  const [editBeneficiaries, setEditBeneficiaries] = useState<string[]>([]);
  const [editIsPersonal, setEditIsPersonal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Filtered transactions
  const filteredExpenses = useMemo(() => {
    return initialExpenses.filter((exp) => {
      const matchSearch =
        !search.trim() ||
        exp.description.toLowerCase().includes(search.toLowerCase().trim());
      const matchCat =
        selectedCat === 'all' || exp.category_id === selectedCat;
      const matchPayer =
        selectedPayer === 'all' || exp.payer_id === selectedPayer;
      return matchSearch && matchCat && matchPayer;
    });
  }, [initialExpenses, search, selectedCat, selectedPayer]);

  // Open edit modal
  const handleStartEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditDesc(exp.description);
    setEditAmount((exp.total_amount / 100).toFixed(2));
    setEditDate(exp.purchase_date);
    setEditCatId(exp.category_id || '');
    setEditPayerId(exp.payer_id);
    setEditBeneficiaries(
      exp.splits?.map((s) => s.beneficiary_id) || members.map((m) => m.profile_id)
    );
    setEditIsPersonal(exp.is_personal);
    setModalError(null);
  };

  // Submit edit
  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    if (!editDesc.trim()) {
      setModalError('Description is required.');
      return;
    }
    const totalPaise = parseINRToPaise(editAmount);
    if (totalPaise <= 0n) {
      setModalError('Amount must be greater than zero.');
      return;
    }

    setIsUpdating(true);
    setModalError(null);

    const res = await updateExpenseAction(editingExpense.id, {
      householdId: household.id,
      payerId: editPayerId,
      totalAmountPaise: totalPaise,
      description: editDesc.trim(),
      purchaseDate: editDate,
      categoryId: editCatId || null,
      isPersonal: editIsPersonal,
      beneficiaryIds: editIsPersonal ? [editPayerId] : editBeneficiaries,
    });

    setIsUpdating(false);

    if (res.success) {
      setEditingExpense(null);
      router.refresh();
    } else {
      setModalError(res.error || 'Failed to update expense.');
    }
  };

  // Confirm delete
  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    const res = await deleteExpenseAction(deletingId);
    setIsDeleting(false);
    setDeletingId(null);
    if (res.success) {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Expense History
          </h1>
          <p className="text-xs text-slate-500">
            Showing transactions for {activeMonth} • Total {initialExpenses.length} records
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search purchases by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payer Filter */}
          <div>
            <select
              value={selectedPayer}
              onChange={(e) => setSelectedPayer(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
            >
              <option value="all">All Payers</option>
              {members.map((m) => (
                <option key={m.profile_id} value={m.profile_id}>
                  Paid by {m.profile?.full_name?.split(' ')[0] || 'Roommate'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Transactions Table / Cards */}
      <Card className="p-0 overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Receipt className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            No expenses found matching the selected filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredExpenses.map((exp) => {
              const payerName = exp.payer?.full_name?.split(' ')[0] || 'Roommate';

              return (
                <div
                  key={exp.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Left: Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900">
                        {exp.description}
                      </span>
                      {exp.is_personal && (
                        <Badge variant="warning" className="text-[10px]">
                          Personal
                        </Badge>
                      )}
                      {exp.category && (
                        <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                          {exp.category.name}
                        </span>
                      )}
                      {exp.quantity && exp.unit && (
                        <span className="text-[10px] text-slate-400">
                          ({exp.quantity} {exp.unit})
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>Paid by <strong className="text-slate-700">{payerName}</strong></span>
                      <span>•</span>
                      <span>{formatDate(exp.purchase_date)}</span>
                      <span>•</span>
                      <span>
                        {exp.is_personal
                          ? '1 person'
                          : `${exp.splits?.length || 0} shares (${exp.splits
                              ?.map((s) => s.beneficiary?.full_name?.split(' ')[0])
                              .filter(Boolean)
                              .join(', ')})`}
                      </span>
                    </div>

                    {exp.notes && (
                      <p className="text-[11px] text-slate-400 italic">
                        &quot;{exp.notes}&quot;
                      </p>
                    )}
                  </div>

                  {/* Right: Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-sm sm:text-base font-bold text-slate-900 block">
                        {formatPaise(BigInt(exp.total_amount))}
                      </span>
                      {!exp.is_personal && exp.splits && exp.splits.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          ~{formatPaise(BigInt(exp.splits[0].share_amount))} each
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(exp)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit expense"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(exp.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete expense"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Edit Expense</h2>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                {modalError}
              </div>
            )}

            <div className="space-y-3">
              <Input
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Amount (₹ INR)"
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
                <Input
                  label="Date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={editCatId}
                    onChange={(e) => setEditCatId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Payer</label>
                  <select
                    value={editPayerId}
                    onChange={(e) => setEditPayerId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900"
                  >
                    {members.map((m) => (
                      <option key={m.profile_id} value={m.profile_id}>
                        {m.profile?.full_name || m.profile?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingExpense(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdating}
                onClick={handleSaveEdit}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Expense?</h3>
                <p className="text-xs text-slate-500">
                  This transaction and its allocated shares will be removed from accounting balances.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
              >
                Keep Expense
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDelete}
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
