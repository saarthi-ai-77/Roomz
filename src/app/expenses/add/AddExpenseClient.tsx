'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Sparkles,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatPaise, parseINRToPaise } from '@/lib/utils';
import { splitEqualPaise } from '@/lib/accounting';
import { createExpenseAction } from '@/actions/expenses';
import type {
  Household,
  HouseholdMember,
  Category,
  CatalogItem,
} from '@/types/database';

interface AddExpenseClientProps {
  currentUserId: string;
  household: Household;
  members: HouseholdMember[];
  categories: Category[];
  catalogItems: CatalogItem[];
}

export function AddExpenseClient({
  currentUserId,
  household,
  members,
  categories,
  catalogItems,
}: AddExpenseClientProps) {
  const router = useRouter();

  // Form State
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [categoryId, setCategoryId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [payerId, setPayerId] = useState<string>(currentUserId);
  const [beneficiaryIds, setBeneficiaryIds] = useState<string[]>(() =>
    members.map((m) => m.profile_id)
  );
  const [isPersonal, setIsPersonal] = useState(false);
  const [notes, setNotes] = useState('');

  // Catalog search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter catalog items
  const filteredCatalog = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCat =
        selectedCatFilter === 'all' || item.category_id === selectedCatFilter;
      return matchesSearch && matchesCat;
    });
  }, [catalogItems, searchQuery, selectedCatFilter]);

  // Select catalog item to prefill form
  const handleSelectCatalogItem = (item: CatalogItem) => {
    setDescription(item.name);
    setCategoryId(item.category_id);
    setUnit(item.unit || '');
    if (item.suggested_price > 0) {
      setAmountRupees((item.suggested_price / 100).toFixed(2));
    }
  };

  // Toggle beneficiary
  const toggleBeneficiary = (profileId: string) => {
    if (beneficiaryIds.includes(profileId)) {
      if (beneficiaryIds.length > 1) {
        setBeneficiaryIds(beneficiaryIds.filter((id) => id !== profileId));
      }
    } else {
      setBeneficiaryIds([...beneficiaryIds, profileId]);
    }
  };

  // Live split shares calculation
  const totalPaise = parseINRToPaise(amountRupees);
  const activeBeneficiaries = useMemo(() => {
    return isPersonal ? [payerId] : beneficiaryIds;
  }, [isPersonal, payerId, beneficiaryIds]);

  const shares = useMemo(() => {
    if (totalPaise <= 0n || activeBeneficiaries.length === 0) return [];
    try {
      return splitEqualPaise(totalPaise, activeBeneficiaries.length);
    } catch {
      return [];
    }
  }, [totalPaise, activeBeneficiaries]);

  // Submit handler
  const handleSubmit = async (addAnother: boolean = false) => {
    if (!description.trim()) {
      setError('Item description is required.');
      return;
    }

    if (totalPaise <= 0n) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const res = await createExpenseAction({
      householdId: household.id,
      payerId,
      totalAmountPaise: totalPaise,
      description: description.trim(),
      purchaseDate,
      categoryId: categoryId || null,
      quantity: parseFloat(quantity) || 1,
      unit: unit.trim() || null,
      isPersonal,
      notes: notes.trim() || null,
      beneficiaryIds: activeBeneficiaries,
    });

    setIsLoading(false);

    if (res?.success) {
      if (addAnother) {
        setDescription('');
        setAmountRupees('');
        setNotes('');
        setSuccessMessage('Expense recorded! Ready for the next item.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } else {
      setError(res?.error || 'Failed to save expense.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Record New Expense
        </h1>
        <p className="text-xs text-slate-500">
          Add an item from the preloaded household catalog or enter custom purchases.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Form (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 sm:p-6 space-y-5">
            {/* Mode Toggle: Shared vs Personal */}
            <div className="flex items-center justify-between rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setIsPersonal(false)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  !isPersonal
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shared Household Purchase
              </button>
              <button
                type="button"
                onClick={() => setIsPersonal(true)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isPersonal
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Personal Only (Not Shared)
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Input
                label="Item Description *"
                placeholder="e.g. Aashirvaad Atta 5kg, Wi-Fi Bill, Milk"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Amount & Date in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  label="Total Amount (₹ INR) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  required
                />
                <span className="text-[11px] text-slate-400">
                  Exact paise:{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {formatPaise(totalPaise)}
                  </span>
                </span>
              </div>

              <div className="space-y-1">
                <Input
                  label="Purchase Date *"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Category, Quantity, Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Input
                  label="Quantity"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Unit"
                  placeholder="e.g. kg, L, pcs"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            {/* Who Paid? */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Who Paid for This?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {members.map((m) => {
                  const prof = m.profile;
                  if (!prof) return null;
                  const isSelected = payerId === prof.id;

                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => setPayerId(prof.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50 text-sky-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold mb-1 ${
                          isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {prof.full_name?.charAt(0).toUpperCase() || 'R'}
                      </div>
                      <span className="truncate max-w-full">
                        {prof.full_name?.split(' ')[0] || 'Roommate'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Beneficiaries Selection (if Shared) */}
            {!isPersonal && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Split Responsibility (Beneficiaries)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    {beneficiaryIds.length} of {members.length} members
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {members.map((m) => {
                    const prof = m.profile;
                    if (!prof) return null;
                    const isChecked = beneficiaryIds.includes(prof.id);

                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() => toggleBeneficiary(prof.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          isChecked
                            ? 'border-sky-500 bg-sky-50/50 text-slate-900'
                            : 'border-slate-200 bg-slate-50 text-slate-400'
                        }`}
                      >
                        <span className="truncate">{prof.full_name?.split(' ')[0] || 'Member'}</span>
                        <div
                          className={`flex h-4 w-4 items-center justify-center rounded-md border ${
                            isChecked
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Live Split Preview */}
                {totalPaise > 0n && shares.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 block">
                      Live Equal Share Allocation:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {activeBeneficiaries.map((bId, idx) => {
                        const m = members.find((x) => x.profile_id === bId);
                        const shareAmt = shares[idx];
                        return (
                          <div
                            key={bId}
                            className="bg-white rounded-lg p-2 border border-slate-200 text-center"
                          >
                            <span className="text-[10px] text-slate-500 block truncate">
                              {m?.profile?.full_name?.split(' ')[0] || 'Roommate'}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {formatPaise(shareAmt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Optional Notes */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Notes (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Bought from Zepto, split for weekend dinner"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            {/* Submit Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                onClick={() => handleSubmit(false)}
                className="w-full sm:flex-1 font-semibold"
              >
                Save Expense
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isLoading}
                onClick={() => handleSubmit(true)}
                className="w-full sm:w-auto text-xs"
              >
                Save & Add Another
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Preloaded Starter Catalog (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5 flex flex-col h-full max-h-[700px]">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-600" />
                <CardTitle className="text-sm">Quick Item Catalog</CardTitle>
              </div>
              <CardDescription>
                Click any item below to instantly prefill description, category, and suggested price.
              </CardDescription>
            </CardHeader>

            {/* Search Catalog */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search milk, dal, oil, recharge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCatFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap font-medium transition-colors ${
                  selectedCatFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCatFilter(c.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap font-medium transition-colors ${
                    selectedCatFilter === c.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Catalog Items Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 mt-2 space-y-1">
              {filteredCatalog.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No matching catalog items found.
                </div>
              ) : (
                filteredCatalog.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCatalogItem(item)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors hover:bg-sky-50/70 group"
                  >
                    <div>
                      <div className="font-semibold text-xs text-slate-900 group-hover:text-sky-700">
                        {item.name}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {item.category?.name || 'Item'} • {item.unit}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700">
                        ~{formatPaise(BigInt(item.suggested_price))}
                      </span>
                      <span className="text-[10px] text-sky-600 block opacity-0 group-hover:opacity-100 font-medium">
                        Use +
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
