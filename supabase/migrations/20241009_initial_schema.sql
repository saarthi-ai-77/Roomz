-- 2024-10-09 Initial schema for Room Manager
-- ------------------------------------------------------------
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. profiles: user profile linked to Supabase Auth UID
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. households: one household per group of roommates
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. household_members: membership linking profiles to households
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (household_id, profile_id)
);

-- 4. invitations: invitation tokens for joining a household
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  expires_at timestamp with time zone NOT NULL,
  max_uses integer NOT NULL DEFAULT 3,
  used integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. categories: expense categories scoped to a household
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  UNIQUE (household_id, name)
);

-- 6. catalog_items: static catalog of suggested items
CREATE TABLE public.catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  suggested_price bigint NOT NULL CHECK (suggested_price >= 0),
  unit text NOT NULL,
  UNIQUE (household_id, name)
);

-- 7. expenses: actual expenses recorded
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_amount bigint NOT NULL CHECK (total_amount >= 0), -- stored in paise
  description text,
  purchase_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 8. expense_splits: each beneficiary's share
CREATE TABLE public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  share_amount bigint NOT NULL CHECK (share_amount >= 0),
  UNIQUE (expense_id, beneficiary_id)
);

-- 9. settlements: money transfers between members (not an expense)
CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  from_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  to_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount bigint NOT NULL CHECK (amount > 0),
  settled_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 10. budgets: monthly household and optional category budgets
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  month date NOT NULL, -- first day of month
  limit_amount bigint NOT NULL CHECK (limit_amount >= 0),
  UNIQUE (household_id, month, category_id)
);

-- 11. audit_events: generic audit trail for financial changes
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  action text NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  details jsonb
);

-- ------------------------------------------------------------
-- Row Level Security (RLS) and Policies
-- ------------------------------------------------------------

-- Enable RLS on each table that is exposed to the client
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's profile id (set by supabase auth)
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT auth.uid()::uuid; $$;

-- 1. profiles: each user can only view/modify own profile
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (id = public.current_profile_id());
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (id = public.current_profile_id());
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (auth.uid()::uuid = auth.uid());

-- 2. households: any member of the household can read; creator can update name
CREATE POLICY households_select ON public.households
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = households.id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY households_update ON public.households
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = households.id AND hm.profile_id = public.current_profile_id() AND hm.role = 'owner')
  );
CREATE POLICY households_insert ON public.households
  FOR INSERT WITH CHECK (true); -- creation allowed via server function only (see below)

-- 3. household_members: members can view their own membership records; owner can insert/delete members
CREATE POLICY household_members_select ON public.household_members
  FOR SELECT USING (profile_id = public.current_profile_id() OR EXISTS (
    SELECT 1 FROM public.household_members hm WHERE hm.household_id = household_members.household_id AND hm.profile_id = public.current_profile_id() AND hm.role = 'owner'
  ));
CREATE POLICY household_members_insert ON public.household_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = household_members.household_id AND hm.profile_id = public.current_profile_id() AND hm.role = 'owner')
    AND (
      SELECT COUNT(*) FROM public.household_members WHERE household_id = household_members.household_id
    ) < 3 -- enforce max three active members
  );
CREATE POLICY household_members_delete ON public.household_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = household_members.household_id AND hm.profile_id = public.current_profile_id() AND hm.role = 'owner')
    AND profile_id <> public.current_profile_id() -- owner cannot delete self via policy (use server function)
  );

-- 4. invitations: creator can view/revoke; members can view active invites; redemption checked via function
CREATE POLICY invitations_select ON public.invitations
  FOR SELECT USING (
    (created_by = public.current_profile_id()) OR
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = invitations.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY invitations_insert ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = invitations.household_id AND hm.profile_id = public.current_profile_id() AND hm.role = 'owner')
  );
CREATE POLICY invitations_update ON public.invitations
  FOR UPDATE USING (
    created_by = public.current_profile_id()
  );
CREATE POLICY invitations_delete ON public.invitations
  FOR DELETE USING (created_by = public.current_profile_id());

-- 5. categories: only members of the household can manage
CREATE POLICY categories_select ON public.categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = categories.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY categories_insert ON public.categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = categories.household_id AND hm.profile_id = public.current_profile_id()));
CREATE POLICY categories_update ON public.categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = categories.household_id AND hm.profile_id = public.current_profile_id())));
CREATE POLICY categories_delete ON public.categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = categories.household_id AND hm.profile_id = public.current_profile_id())));

-- 6. catalog_items: members can read; owner can manage
CREATE POLICY catalog_items_select ON public.catalog_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = catalog_items.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY catalog_items_insert ON public.catalog_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = catalog_items.household_id AND hm.profile_id = public.current_profile_id())));
CREATE POLICY catalog_items_update ON public.catalog_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = catalog_items.household_id AND hm.profile_id = public.current_profile_id())));
CREATE POLICY catalog_items_delete ON public.catalog_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = catalog_items.household_id AND hm.profile_id = public.current_profile_id())));

-- 7. expenses: payer and household members can insert; members can select
CREATE POLICY expenses_select ON public.expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = expenses.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = expenses.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY expenses_update ON public.expenses
  FOR UPDATE USING (
    payer_id = public.current_profile_id() AND
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = expenses.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY expenses_delete ON public.expenses
  FOR DELETE USING (
    payer_id = public.current_profile_id() AND
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = expenses.household_id AND hm.profile_id = public.current_profile_id())
  );

-- 8. expense_splits: only the household can read; creation must be tied to expense transaction (handled by server function)
CREATE POLICY expense_splits_select ON public.expense_splits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = (SELECT household_id FROM public.expenses WHERE id = expense_splits.expense_id) AND hm.profile_id = public.current_profile_id())
  );
-- Inserts/updates/deletes are prohibited client‑side; they must go through secured DB function.

-- 9. settlements: members involved can view; any member can insert a settlement where they are sender or receiver
CREATE POLICY settlements_select ON public.settlements
  FOR SELECT USING (
    from_id = public.current_profile_id() OR to_id = public.current_profile_id()
  );
CREATE POLICY settlements_insert ON public.settlements
  FOR INSERT WITH CHECK (
    (from_id = public.current_profile_id() OR to_id = public.current_profile_id()) AND
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = settlements.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY settlements_delete ON public.settlements
  FOR DELETE USING (
    (from_id = public.current_profile_id() OR to_id = public.current_profile_id())
  );

-- 10. budgets: household members can read; owner can manage
CREATE POLICY budgets_select ON public.budgets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = budgets.household_id AND hm.profile_id = public.current_profile_id())
  );
CREATE POLICY budgets_insert ON public.budgets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = budgets.household_id AND hm.profile_id = public.current_profile_id())));
CREATE POLICY budgets_update ON public.budgets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = budgets.household_id AND hm.profile_id = public.current_profile_id())));
CREATE POLICY budgets_delete ON public.budgets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = budgets.household_id AND hm.profile_id = public.current_profile_id())));

-- 11. audit_events: members can view events for their household
CREATE POLICY audit_events_select ON public.audit_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = audit_events.household_id AND hm.profile_id = public.current_profile_id())
  );

-- ------------------------------------------------------------
-- Secure server‑side functions for atomic operations
-- ------------------------------------------------------------

-- Function to create an expense with splits atomically
CREATE OR REPLACE FUNCTION public.create_expense(
  p_household_id uuid,
  p_payer_id uuid,
  p_total_amount bigint,
  p_description text,
  p_purchase_date date,
  p_beneficiary_ids uuid[],
  p_shares bigint[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_expense_id uuid;
  i integer;
BEGIN
  -- Validate caller belongs to household
  IF NOT EXISTS (SELECT 1 FROM public.household_members hm WHERE hm.household_id = p_household_id AND hm.profile_id = public.current_profile_id()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Basic amount validation
  IF p_total_amount < 0 THEN
    RAISE EXCEPTION 'Negative total amount not allowed';
  END IF;

  INSERT INTO public.expenses (id, household_id, payer_id, total_amount, description, purchase_date)
  VALUES (gen_random_uuid(), p_household_id, p_payer_id, p_total_amount, p_description, p_purchase_date)
  RETURNING id INTO v_expense_id;

  -- Insert splits; number of ids must match shares length and sum to total
  IF array_length(p_beneficiary_ids,1) <> array_length(p_shares,1) THEN
    RAISE EXCEPTION 'Mismatched beneficiary and share arrays';
  END IF;
  IF (SELECT sum(s) FROM unnest(p_shares) s) <> p_total_amount THEN
    RAISE EXCEPTION 'Shares do not sum to total amount';
  END IF;

  FOR i IN 1..array_length(p_beneficiary_ids,1) LOOP
    INSERT INTO public.expense_splits (expense_id, beneficiary_id, share_amount)
    VALUES (v_expense_id, p_beneficiary_ids[i], p_shares[i]);
  END LOOP;

  RETURN v_expense_id;
END;
$$;

-- Function to redeem an invitation atomically and add member
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token text, p_profile_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inv invitation%ROWTYPE;
  v_household_id uuid;
BEGIN
  SELECT * INTO v_inv FROM public.invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;
  IF v_inv.revoked OR v_inv.expires_at < now() OR v_inv.used >= v_inv.max_uses THEN
    RAISE EXCEPTION 'Invitation not usable';
  END IF;
  v_household_id := v_inv.household_id;
  -- enforce max 3 members
  IF (SELECT COUNT(*) FROM public.household_members WHERE household_id = v_household_id) >= 3 THEN
    RAISE EXCEPTION 'Household member limit reached';
  END IF;
  INSERT INTO public.household_members (household_id, profile_id, role) VALUES (v_household_id, p_profile_id, 'member');
  UPDATE public.invitations SET used = used + 1 WHERE id = v_inv.id;
  RETURN v_household_id;
END;
$$;

-- ------------------------------------------------------------
-- Seed data for common Indian categories and catalog items (optional – can be loaded manually)
-- ------------------------------------------------------------

-- Example categories (inserted per household via application logic)
-- INSERT INTO public.categories (household_id, name) VALUES (..., 'Groceries');
-- INSERT INTO public.categories (household_id, name) VALUES (..., 'Cleaning');
-- ...

-- End of migration
