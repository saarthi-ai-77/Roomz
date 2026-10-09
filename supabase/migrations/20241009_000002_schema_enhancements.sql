-- 2024-10-09 Schema Enhancements for Room Manager
-- ------------------------------------------------------------

-- 1. Profiles enhancement: add full_name, email, avatar_url
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Helper function to ensure profile exists for auth user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, auth_uid, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (auth_uid) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger on auth.users (if permission allows in Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- In environments without superuser access to auth, ignore trigger creation error
    NULL;
END;
$$;

-- Robust current_profile_id function
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT id FROM public.profiles WHERE auth_uid = auth.uid() OR id = auth.uid() LIMIT 1),
    auth.uid()
  );
$$;

-- 2. Enhance categories table
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 3. Enhance expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Enhance settlements table
ALTER TABLE public.settlements
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';

-- 5. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members (profile_id, household_id);
CREATE INDEX IF NOT EXISTS idx_expenses_household_date ON public.expenses (household_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON public.expenses (payer_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON public.expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_beneficiary ON public.expense_splits (beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_settlements_household ON public.settlements (household_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_from_to ON public.settlements (from_id, to_id);
CREATE INDEX IF NOT EXISTS idx_budgets_lookup ON public.budgets (household_id, month);

-- 6. Helper function to seed Indian categories & catalog items for a household
CREATE OR REPLACE FUNCTION public.seed_household_defaults(p_household_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_staples uuid;
  v_cat_dairy uuid;
  v_cat_produce uuid;
  v_cat_cooking uuid;
  v_cat_cleaning uuid;
  v_cat_toiletries uuid;
  v_cat_utilities uuid;
  v_cat_repairs uuid;
  v_cat_misc uuid;
BEGIN
  -- Insert Categories
  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Staples & Grains', 'Wheat', '#d97706', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_staples;
  IF v_cat_staples IS NULL THEN
    SELECT id INTO v_cat_staples FROM public.categories WHERE household_id = p_household_id AND name = 'Staples & Grains';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Dairy & Eggs', 'Milk', '#0284c7', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_dairy;
  IF v_cat_dairy IS NULL THEN
    SELECT id INTO v_cat_dairy FROM public.categories WHERE household_id = p_household_id AND name = 'Dairy & Eggs';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Vegetables & Fruits', 'Apple', '#16a34a', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_produce;
  IF v_cat_produce IS NULL THEN
    SELECT id INTO v_cat_produce FROM public.categories WHERE household_id = p_household_id AND name = 'Vegetables & Fruits';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Cooking Essentials & Spices', 'Flame', '#dc2626', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_cooking;
  IF v_cat_cooking IS NULL THEN
    SELECT id INTO v_cat_cooking FROM public.categories WHERE household_id = p_household_id AND name = 'Cooking Essentials & Spices';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Cleaning & Supplies', 'Sparkles', '#7c3aed', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_cleaning;
  IF v_cat_cleaning IS NULL THEN
    SELECT id INTO v_cat_cleaning FROM public.categories WHERE household_id = p_household_id AND name = 'Cleaning & Supplies';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Toiletries & Personal', 'Bath', '#0891b2', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_toiletries;
  IF v_cat_toiletries IS NULL THEN
    SELECT id INTO v_cat_toiletries FROM public.categories WHERE household_id = p_household_id AND name = 'Toiletries & Personal';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Utilities & Bills', 'Zap', '#ea580c', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_utilities;
  IF v_cat_utilities IS NULL THEN
    SELECT id INTO v_cat_utilities FROM public.categories WHERE household_id = p_household_id AND name = 'Utilities & Bills';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Room Repairs & Maintenance', 'Wrench', '#4b5563', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_repairs;
  IF v_cat_repairs IS NULL THEN
    SELECT id INTO v_cat_repairs FROM public.categories WHERE household_id = p_household_id AND name = 'Room Repairs & Maintenance';
  END IF;

  INSERT INTO public.categories (household_id, name, icon, color, is_default)
  VALUES (p_household_id, 'Miscellaneous', 'Package', '#6b7280', true)
  ON CONFLICT (household_id, name) DO NOTHING RETURNING id INTO v_cat_misc;
  IF v_cat_misc IS NULL THEN
    SELECT id INTO v_cat_misc FROM public.categories WHERE household_id = p_household_id AND name = 'Miscellaneous';
  END IF;

  -- Insert Catalog Items (prices in paise: e.g. 5000 = ₹50.00, 35000 = ₹350.00)
  -- Staples
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_staples, 'Atta (Wheat Flour)', 36000, '5 kg'),
    (p_household_id, v_cat_staples, 'Basmati Rice', 12000, '1 kg'),
    (p_household_id, v_cat_staples, 'Toor / Arhar Dal', 16000, '1 kg'),
    (p_household_id, v_cat_staples, 'Moong Dal', 14000, '1 kg'),
    (p_household_id, v_cat_staples, 'Poha (Flattened Rice)', 6000, '1 kg')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Dairy & Eggs
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_dairy, 'Milk (Toned)', 3400, '500 ml'),
    (p_household_id, v_cat_dairy, 'Milk (Full Cream)', 3800, '500 ml'),
    (p_household_id, v_cat_dairy, 'Curd / Dahi', 4000, '400 g'),
    (p_household_id, v_cat_dairy, 'Paneer', 9500, '200 g'),
    (p_household_id, v_cat_dairy, 'Butter (Amul)', 5800, '100 g'),
    (p_household_id, v_cat_dairy, 'Eggs (Tray of 6)', 4800, '6 pcs')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Produce
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_produce, 'Onions', 4000, '1 kg'),
    (p_household_id, v_cat_produce, 'Potatoes', 3000, '1 kg'),
    (p_household_id, v_cat_produce, 'Tomatoes', 4000, '1 kg'),
    (p_household_id, v_cat_produce, 'Ginger & Garlic', 3000, '250 g'),
    (p_household_id, v_cat_produce, 'Green Chillies & Coriander', 2000, 'bunch'),
    (p_household_id, v_cat_produce, 'Bananas', 5000, '1 dozen')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Cooking Essentials
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_cooking, 'Mustard / Cooking Oil', 15500, '1 L'),
    (p_household_id, v_cat_cooking, 'Tata Salt', 2800, '1 kg'),
    (p_household_id, v_cat_cooking, 'Sugar', 4600, '1 kg'),
    (p_household_id, v_cat_cooking, 'Tea Powder', 14000, '250 g'),
    (p_household_id, v_cat_cooking, 'Coffee Powder', 18000, '100 g'),
    (p_household_id, v_cat_cooking, 'Garam Masala / Spices', 7000, '100 g')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Cleaning & Supplies
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_cleaning, 'Detergent Powder', 13000, '1 kg'),
    (p_household_id, v_cat_cleaning, 'Dishwashing Liquid / Bar', 6000, '500 ml'),
    (p_household_id, v_cat_cleaning, 'Floor Cleaner (Lizol)', 11000, '500 ml'),
    (p_household_id, v_cat_cleaning, 'Garbage Bags (Roll)', 8000, 'roll')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Toiletries
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_toiletries, 'Bathing Soap (Pack of 3)', 12000, 'pack'),
    (p_household_id, v_cat_toiletries, 'Shampoo Bottle', 18000, '180 ml'),
    (p_household_id, v_cat_toiletries, 'Toothpaste (Colgate)', 9500, '150 g'),
    (p_household_id, v_cat_toiletries, 'Toilet Cleaner (Harpic)', 9000, '500 ml')
  ON CONFLICT (household_id, name) DO NOTHING;

  -- Utilities & Repairs
  INSERT INTO public.catalog_items (household_id, category_id, name, suggested_price, unit) VALUES
    (p_household_id, v_cat_utilities, 'Wi-Fi / Internet Monthly Bill', 82500, 'month'),
    (p_household_id, v_cat_utilities, 'Electricity Bill', 150000, 'month'),
    (p_household_id, v_cat_utilities, 'Drinking Water Can (20L)', 4000, '20 L can'),
    (p_household_id, v_cat_utilities, 'LPG Cooking Gas Cylinder', 95000, 'cylinder'),
    (p_household_id, v_cat_repairs, 'Plumber Service / Hardware', 35000, 'visit'),
    (p_household_id, v_cat_repairs, 'Electrician / Appliance Repair', 40000, 'visit')
  ON CONFLICT (household_id, name) DO NOTHING;
END;
$$;

-- 7. Atomic function: create_household
CREATE OR REPLACE FUNCTION public.create_household(
  p_name text,
  p_timezone text DEFAULT 'Asia/Kolkata'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := public.current_profile_id();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Please log in.';
  END IF;

  INSERT INTO public.households (id, name, timezone)
  VALUES (gen_random_uuid(), p_name, COALESCE(p_timezone, 'Asia/Kolkata'))
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_members (household_id, profile_id, role)
  VALUES (v_household_id, v_caller_id, 'owner');

  -- Seed default categories and catalog items
  PERFORM public.seed_household_defaults(v_household_id);

  RETURN v_household_id;
END;
$$;

-- 8. Enhanced atomic function: create_expense
CREATE OR REPLACE FUNCTION public.create_expense(
  p_household_id uuid,
  p_payer_id uuid,
  p_total_amount bigint,
  p_description text,
  p_purchase_date date,
  p_beneficiary_ids uuid[],
  p_shares bigint[],
  p_category_id uuid DEFAULT NULL,
  p_quantity numeric DEFAULT 1,
  p_unit text DEFAULT NULL,
  p_is_personal boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_caller_id uuid;
  i integer;
BEGIN
  v_caller_id := public.current_profile_id();

  -- Validate caller belongs to household
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.profile_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not a member of this household';
  END IF;

  -- Validate payer belongs to household
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.profile_id = p_payer_id
  ) THEN
    RAISE EXCEPTION 'Invalid payer: Payer is not a member of this household';
  END IF;

  -- Validate amount
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;

  -- Validate arrays
  IF array_length(p_beneficiary_ids, 1) IS NULL OR array_length(p_shares, 1) IS NULL THEN
    RAISE EXCEPTION 'Beneficiary and share arrays cannot be empty';
  END IF;

  IF array_length(p_beneficiary_ids, 1) <> array_length(p_shares, 1) THEN
    RAISE EXCEPTION 'Mismatched beneficiary and share counts';
  END IF;

  IF (SELECT sum(s) FROM unnest(p_shares) s) <> p_total_amount THEN
    RAISE EXCEPTION 'Shares sum must equal the exact total amount';
  END IF;

  -- Insert expense
  INSERT INTO public.expenses (
    id,
    household_id,
    payer_id,
    total_amount,
    description,
    purchase_date,
    category_id,
    quantity,
    unit,
    is_personal,
    notes,
    created_by
  )
  VALUES (
    gen_random_uuid(),
    p_household_id,
    p_payer_id,
    p_total_amount,
    p_description,
    p_purchase_date,
    p_category_id,
    COALESCE(p_quantity, 1),
    p_unit,
    COALESCE(p_is_personal, false),
    p_notes,
    v_caller_id
  )
  RETURNING id INTO v_expense_id;

  -- Insert splits
  FOR i IN 1..array_length(p_beneficiary_ids, 1) LOOP
    -- Validate each beneficiary belongs to the household
    IF NOT EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = p_household_id AND hm.profile_id = p_beneficiary_ids[i]
    ) THEN
      RAISE EXCEPTION 'Beneficiary % is not a member of this household', p_beneficiary_ids[i];
    END IF;

    INSERT INTO public.expense_splits (expense_id, beneficiary_id, share_amount)
    VALUES (v_expense_id, p_beneficiary_ids[i], p_shares[i]);
  END LOOP;

  -- Record audit event
  INSERT INTO public.audit_events (household_id, profile_id, action, table_name, row_id, details)
  VALUES (
    p_household_id,
    v_caller_id,
    'CREATE',
    'expenses',
    v_expense_id,
    jsonb_build_object(
      'total_amount', p_total_amount,
      'description', p_description,
      'payer_id', p_payer_id,
      'is_personal', p_is_personal
    )
  );

  RETURN v_expense_id;
END;
$$;

-- 9. Atomic function: update_expense
CREATE OR REPLACE FUNCTION public.update_expense(
  p_expense_id uuid,
  p_payer_id uuid,
  p_total_amount bigint,
  p_description text,
  p_purchase_date date,
  p_beneficiary_ids uuid[],
  p_shares bigint[],
  p_category_id uuid DEFAULT NULL,
  p_quantity numeric DEFAULT 1,
  p_unit text DEFAULT NULL,
  p_is_personal boolean DEFAULT false,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_caller_id uuid;
  i integer;
BEGIN
  v_caller_id := public.current_profile_id();

  SELECT household_id INTO v_household_id FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  -- Ensure caller is member of this household
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = v_household_id AND hm.profile_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount & splits
  IF p_total_amount <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;

  IF array_length(p_beneficiary_ids, 1) <> array_length(p_shares, 1) THEN
    RAISE EXCEPTION 'Mismatched beneficiary and share counts';
  END IF;

  IF (SELECT sum(s) FROM unnest(p_shares) s) <> p_total_amount THEN
    RAISE EXCEPTION 'Shares sum must equal the exact total amount';
  END IF;

  -- Update expense
  UPDATE public.expenses
  SET
    payer_id = p_payer_id,
    total_amount = p_total_amount,
    description = p_description,
    purchase_date = p_purchase_date,
    category_id = p_category_id,
    quantity = COALESCE(p_quantity, 1),
    unit = p_unit,
    is_personal = COALESCE(p_is_personal, false),
    notes = p_notes,
    updated_at = now()
  WHERE id = p_expense_id;

  -- Delete existing splits and replace atomically
  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;

  FOR i IN 1..array_length(p_beneficiary_ids, 1) LOOP
    INSERT INTO public.expense_splits (expense_id, beneficiary_id, share_amount)
    VALUES (p_expense_id, p_beneficiary_ids[i], p_shares[i]);
  END LOOP;

  -- Record audit event
  INSERT INTO public.audit_events (household_id, profile_id, action, table_name, row_id, details)
  VALUES (
    v_household_id,
    v_caller_id,
    'UPDATE',
    'expenses',
    p_expense_id,
    jsonb_build_object(
      'total_amount', p_total_amount,
      'description', p_description
    )
  );

  RETURN true;
END;
$$;

-- 10. Atomic function: delete_expense
CREATE OR REPLACE FUNCTION public.delete_expense(p_expense_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_caller_id uuid;
  v_desc text;
  v_amt bigint;
BEGIN
  v_caller_id := public.current_profile_id();

  SELECT household_id, description, total_amount INTO v_household_id, v_desc, v_amt
  FROM public.expenses WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  -- Validate caller is member
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = v_household_id AND hm.profile_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Delete expense (cascades to splits)
  DELETE FROM public.expenses WHERE id = p_expense_id;

  -- Record audit event
  INSERT INTO public.audit_events (household_id, profile_id, action, table_name, row_id, details)
  VALUES (
    v_household_id,
    v_caller_id,
    'DELETE',
    'expenses',
    p_expense_id,
    jsonb_build_object('description', v_desc, 'amount', v_amt)
  );

  RETURN true;
END;
$$;

-- 11. Atomic function: record_settlement
CREATE OR REPLACE FUNCTION public.record_settlement(
  p_household_id uuid,
  p_from_id uuid,
  p_to_id uuid,
  p_amount bigint,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settlement_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := public.current_profile_id();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Settlement amount must be positive';
  END IF;

  IF p_from_id = p_to_id THEN
    RAISE EXCEPTION 'Sender and receiver cannot be the same member';
  END IF;

  -- Caller must be either sender or receiver
  IF v_caller_id <> p_from_id AND v_caller_id <> p_to_id THEN
    RAISE EXCEPTION 'Only the sender or receiver can record this settlement';
  END IF;

  -- Both must belong to the household
  IF NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.profile_id = p_from_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = p_household_id AND hm.profile_id = p_to_id
  ) THEN
    RAISE EXCEPTION 'Both participants must belong to the household';
  END IF;

  INSERT INTO public.settlements (
    id,
    household_id,
    from_id,
    to_id,
    amount,
    notes,
    settled_at
  )
  VALUES (
    gen_random_uuid(),
    p_household_id,
    p_from_id,
    p_to_id,
    p_amount,
    p_notes,
    now()
  )
  RETURNING id INTO v_settlement_id;

  -- Record audit event
  INSERT INTO public.audit_events (household_id, profile_id, action, table_name, row_id, details)
  VALUES (
    p_household_id,
    v_caller_id,
    'CREATE',
    'settlements',
    v_settlement_id,
    jsonb_build_object('amount', p_amount, 'from_id', p_from_id, 'to_id', p_to_id)
  );

  RETURN v_settlement_id;
END;
$$;
