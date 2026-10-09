export type HouseholdRole = 'owner' | 'member';

export interface Profile {
  id: string;
  auth_uid: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  profile_id: string;
  role: HouseholdRole;
  joined_at: string;
  profile?: Profile;
}

export interface Invitation {
  id: string;
  household_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  used: number;
  revoked: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  parent_id?: string | null;
  icon?: string | null;
  color?: string | null;
  is_default: boolean;
}

export interface CatalogItem {
  id: string;
  household_id: string;
  category_id: string;
  name: string;
  suggested_price: number; // in paise
  unit: string;
  category?: Category;
}

export interface Expense {
  id: string;
  household_id: string;
  payer_id: string;
  total_amount: number; // in paise
  description: string;
  purchase_date: string;
  category_id?: string | null;
  quantity?: number;
  unit?: string | null;
  is_personal: boolean;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  payer?: Profile;
  category?: Category;
  splits?: ExpenseSplit[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  beneficiary_id: string;
  share_amount: number; // in paise
  beneficiary?: Profile;
}

export interface Settlement {
  id: string;
  household_id: string;
  from_id: string;
  to_id: string;
  amount: number; // in paise
  notes?: string | null;
  status: 'completed' | 'cancelled';
  settled_at: string;
  created_at: string;
  from_profile?: Profile;
  to_profile?: Profile;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id?: string | null;
  month: string; // YYYY-MM-01
  limit_amount: number; // in paise
  category?: Category;
}

export interface AuditEvent {
  id: string;
  household_id: string;
  profile_id: string;
  action: string;
  table_name: string;
  row_id: string;
  created_at: string;
  details?: Record<string, unknown> | null;
}

export interface MonthlySpendingSummary {
  month: string; // YYYY-MM
  totalSharedPaise: bigint;
  totalPersonalPaise: bigint;
  budgetLimitPaise: bigint | null;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    icon?: string | null;
    color?: string | null;
    totalPaise: bigint;
    percent: number;
  }>;
  memberContributions: Array<{
    profileId: string;
    name: string;
    paidPaise: bigint;
    fairSharePaise: bigint;
    netBalancePaise: bigint;
  }>;
  suggestedTransfers: Array<{
    from: string;
    to: string;
    fromName: string;
    toName: string;
    amount: bigint;
  }>;
}
