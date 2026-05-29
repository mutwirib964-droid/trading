-- NetacoinFX Supabase Setup & Administration Query Ledger
-- Copy and run this script inside your Supabase dashboard SQL Editor (https://supabase.com) 
-- to configure database tables, set up exclusive administrator rights for mutwirib964@gmail.com,
-- and establish strong, failsafe Row Level Security (RLS) policies.

-- 1. Ensure the profiles table exists (if it doesn't already)
CREATE TABLE IF NOT EXISTS public.profiles (
    email TEXT UNIQUE NOT NULL
);

-- Dynamically add all expected columns to the profiles table to prevent errors in pre-existing tables!
-- This ensures that if you already have a table 'profiles', PostgreSQL will safely add the missing columns without breaking anything.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_deposited NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_kyc_verified TEXT DEFAULT 'unverified';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_wallet_balance NUMERIC(15, 4) DEFAULT 10000.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_positions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_positions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_bots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_bots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS copied_allocations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staking_subscriptions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS support_tickets_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_profits NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invested_capital NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS copy_trading_allocated NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profits_real NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promo_code_used TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Ensure the transactions table exists (if it doesn't already)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text
);

-- Dynamically add all expected columns to the transactions table to prevent errors in pre-existing tables!
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS asset TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'COMPLETED';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2b. Ensure the trades table exists (to support demo/real-time trade state alignment query ledger)
CREATE TABLE IF NOT EXISTS public.trades (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text
);

-- Dynamically add all expected columns to the trades table to prevent schema mismatch errors!
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS asset_symbol TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS asset_name TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS type TEXT; -- 'BUY' or 'SELL'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_price NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS current_price NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS leverage NUMERIC(15, 4) DEFAULT 1.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS margin NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pnl NUMERIC(15, 4) DEFAULT 0.0000;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN'; -- 'OPEN' or 'CLOSED'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS account_mode TEXT DEFAULT 'REAL'; -- 'REAL' or 'DEMO'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Enable Row Level Security (RLS) to protect client ledger records
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 3. Clean out any conflicting pre-existing security policies dynamically to prevent recursion issues!
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Dynamically drop all existing policies on public.profiles
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;

    -- Dynamically drop all existing policies on public.transactions
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'transactions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.transactions', pol.policyname);
    END LOOP;

    -- Dynamically drop all existing policies on public.trades
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'trades'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.trades', pol.policyname);
    END LOOP;
END $$;

-- 4. Create strong, granular Row Level Security (RLS) policies

-- 4. Create strong, granular Row Level Security (RLS) policies

-- Profiles Policies
CREATE POLICY "Allow user read access to own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Allow user update access to own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow administrative full read access"
ON public.profiles FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

CREATE POLICY "Allow administrative full write access"
ON public.profiles FOR ALL
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

-- Profiles Column-level Protection Trigger
CREATE OR REPLACE FUNCTION public.enforce_profile_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If executing as system admin, postgres, or service_role, bypass direct client limitations safely
  IF CURRENT_USER = 'postgres' OR CURRENT_USER = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If not admin, block changes to sensitive columns
  IF (auth.jwt() ->> 'email') IS NOT NULL AND (auth.jwt() ->> 'email') IS DISTINCT FROM 'mutwirib964@gmail.com' THEN
    IF OLD.role IS DISTINCT FROM NEW.role 
       OR OLD.wallet_balance IS DISTINCT FROM NEW.wallet_balance 
       OR OLD.total_deposited IS DISTINCT FROM NEW.total_deposited 
       OR OLD.demo_wallet_balance IS DISTINCT FROM NEW.demo_wallet_balance THEN
       RAISE EXCEPTION 'Access denied. Only administrators can modify balances, deposits, or roles directly.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_profile_immutability ON public.profiles;
CREATE TRIGGER trg_enforce_profile_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_immutability();


-- Transactions Policies
CREATE POLICY "Allow user read own transactions"
ON public.transactions FOR SELECT
USING (
  (auth.jwt() ->> 'email' = email OR auth.jwt() ->> 'email' = user_email)
);

CREATE POLICY "Allow user insert own transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'email' = email OR auth.jwt() ->> 'email' = user_email)
);

CREATE POLICY "Allow administrative read all transactions"
ON public.transactions FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

CREATE POLICY "Allow administrative full transactions access"
ON public.transactions FOR ALL
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

-- Trades Policies
CREATE POLICY "Allow user read own trades"
ON public.trades FOR SELECT
USING (
  auth.jwt() ->> 'email' = user_email
);

CREATE POLICY "Allow user insert own trades"
ON public.trades FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'email' = user_email
);

CREATE POLICY "Allow user update own trades"
ON public.trades FOR UPDATE
USING (
  auth.jwt() ->> 'email' = user_email
);

CREATE POLICY "Allow administrative read all trades"
ON public.trades FOR SELECT
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

CREATE POLICY "Allow administrative full trades access"
ON public.trades FOR ALL
USING (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
)
WITH CHECK (
  auth.jwt() ->> 'email' = 'mutwirib964@gmail.com'
);

-- 5. Set up the exclusive administrative credentials securely
-- This forces mutwirib964@gmail.com with UID ccd28f9c-f070-455e-9cdb-e4ee2f26ac99 directly into the 'admin' database role state.
INSERT INTO public.profiles (id, email, name, role, wallet_balance, is_kyc_verified, updated_at)
VALUES (
  'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99', 
  'mutwirib964@gmail.com', 
  'MUTWIRI ADMIN', 
  'admin', 
  1000.0000, 
  'verified', 
  timezone('utc'::text, now())
)
ON CONFLICT (email) 
DO UPDATE SET 
  id = EXCLUDED.id,
  role = 'admin',
  is_kyc_verified = 'verified',
  updated_at = timezone('utc'::text, now());

-- 6. Clean and secure administrative database routines to bypass RLS safely
CREATE OR REPLACE FUNCTION public.admin_update_profile(
    admin_uid TEXT,
    target_email TEXT,
    new_role TEXT,
    new_balance NUMERIC,
    new_deposited NUMERIC
) RETURNS VOID AS $$
DECLARE
    is_admin BOOLEAN;
    admin_uuid UUID;
BEGIN
    -- convert from text to uuid safely
    BEGIN
        admin_uuid := admin_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
        admin_uuid := NULL;
    END;

    -- Verify the authority of admin_uid
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = admin_uuid AND role = 'admin'
    ) INTO is_admin;

    -- Also check for mutwirib964@gmail.com
    IF NOT is_admin AND (admin_uid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' OR admin_uuid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99'::UUID) THEN
        is_admin := TRUE;
    END IF;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied. Exclusive administrative clearance required.';
    END IF;

    -- Perform the role and balance updates safely
    UPDATE public.profiles
    SET role = new_role,
        wallet_balance = new_balance,
        total_deposited = new_deposited,
        updated_at = timezone('utc'::text, now())
    WHERE LOWER(email) = LOWER(target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.admin_get_all_profiles(
    admin_uid TEXT
) RETURNS SETOF public.profiles AS $$
DECLARE
    is_admin BOOLEAN;
    admin_uuid UUID;
BEGIN
    -- convert from text to uuid safely
    BEGIN
        admin_uuid := admin_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
        admin_uuid := NULL;
    END;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = admin_uuid AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin AND (admin_uid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' OR admin_uuid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99'::UUID) THEN
        is_admin := TRUE;
    END IF;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied. Exclusive administrative clearance required.';
    END IF;

    RETURN QUERY 
    SELECT * FROM public.profiles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.admin_get_all_transactions(
    admin_uid TEXT
) RETURNS SETOF public.transactions AS $$
DECLARE
    is_admin BOOLEAN;
    admin_uuid UUID;
BEGIN
    -- convert from text to uuid safely
    BEGIN
        admin_uuid := admin_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
        admin_uuid := NULL;
    END;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = admin_uuid AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin AND (admin_uid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' OR admin_uuid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99'::UUID) THEN
        is_admin := TRUE;
    END IF;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied. Exclusive administrative clearance required.';
    END IF;

    RETURN QUERY 
    SELECT * FROM public.transactions ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.admin_get_profile(
    admin_uid TEXT,
    target_email TEXT
) RETURNS SETOF public.profiles AS $$
DECLARE
    is_admin BOOLEAN;
    admin_uuid UUID;
BEGIN
    -- convert from text to uuid safely
    BEGIN
        admin_uuid := admin_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
        admin_uuid := NULL;
    END;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = admin_uuid AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin AND (admin_uid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' OR admin_uuid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99'::UUID) THEN
        is_admin := TRUE;
    END IF;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied. Exclusive administrative clearance required.';
    END IF;

    RETURN QUERY 
    SELECT * FROM public.profiles WHERE LOWER(email) = LOWER(target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.admin_delete_profile(
    admin_uid TEXT,
    target_email TEXT
) RETURNS VOID AS $$
DECLARE
    is_admin BOOLEAN;
    admin_uuid UUID;
BEGIN
    -- convert from text to uuid safely
    BEGIN
        admin_uuid := admin_uid::UUID;
    EXCEPTION WHEN OTHERS THEN
        admin_uuid := NULL;
    END;

    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = admin_uuid AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin AND (admin_uid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' OR admin_uuid = 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99'::UUID) THEN
        is_admin := TRUE;
    END IF;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Access denied. Exclusive administrative clearance required.';
    END IF;

    DELETE FROM public.profiles WHERE LOWER(email) = LOWER(target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.system_credit_user(
    secure_token TEXT,
    target_email TEXT,
    usd_amount NUMERIC
) RETURNS VOID AS $$
DECLARE
    expected_token TEXT := 'payhero_system_clear_token_vfx';
BEGIN
    IF secure_token <> expected_token THEN
        RAISE EXCEPTION 'Invalid system clearance token.';
    END IF;

    UPDATE public.profiles
    SET wallet_balance = wallet_balance + usd_amount,
        total_deposited = total_deposited + usd_amount,
        updated_at = timezone('utc'::text, now())
    WHERE LOWER(email) = LOWER(target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.system_record_transaction(
    secure_token TEXT,
    target_email TEXT,
    tx_type TEXT,
    tx_amount NUMERIC,
    tx_asset TEXT,
    tx_address TEXT,
    tx_status TEXT,
    tx_reference TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    expected_token TEXT := 'payhero_system_clear_token_vfx';
BEGIN
    IF secure_token <> expected_token THEN
        RAISE EXCEPTION 'Invalid system clearance token.';
    END IF;

    -- Ensure we have a matching record in public.transactions safely
    INSERT INTO public.transactions (email, user_email, type, amount, asset, address, status, reference, created_at)
    VALUES (target_email, target_email, tx_type, tx_amount, tx_asset, tx_address, COALESCE(tx_status, 'COMPLETED'), tx_reference, timezone('utc'::text, now()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.system_update_profile_state(
    secure_token TEXT,
    target_email TEXT,
    val_wallet_balance NUMERIC DEFAULT NULL,
    val_demo_wallet_balance NUMERIC DEFAULT NULL,
    val_demo_profits NUMERIC DEFAULT NULL,
    val_invested_capital NUMERIC DEFAULT NULL,
    val_copy_trading_allocated NUMERIC DEFAULT NULL,
    val_profits_real NUMERIC DEFAULT NULL,
    val_active_positions JSONB DEFAULT NULL,
    val_demo_positions JSONB DEFAULT NULL,
    val_custom_bots JSONB DEFAULT NULL,
    val_active_bots JSONB DEFAULT NULL,
    val_copied_allocations JSONB DEFAULT NULL,
    val_staking_subscriptions JSONB DEFAULT NULL,
    val_support_tickets_json JSONB DEFAULT NULL,
    val_is_kyc_verified TEXT DEFAULT NULL,
    val_phone TEXT DEFAULT NULL,
    val_promo_code_used TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    expected_token TEXT := 'payhero_system_clear_token_vfx';
BEGIN
    IF secure_token <> expected_token THEN
        RAISE EXCEPTION 'Invalid system clearance token.';
    END IF;

    UPDATE public.profiles
    SET 
        wallet_balance = COALESCE(val_wallet_balance, wallet_balance),
        demo_wallet_balance = COALESCE(val_demo_wallet_balance, demo_wallet_balance),
        demo_profits = COALESCE(val_demo_profits, demo_profits),
        invested_capital = COALESCE(val_invested_capital, invested_capital),
        copy_trading_allocated = COALESCE(val_copy_trading_allocated, copy_trading_allocated),
        profits_real = COALESCE(val_profits_real, profits_real),
        active_positions = COALESCE(val_active_positions, active_positions),
        demo_positions = COALESCE(val_demo_positions, demo_positions),
        custom_bots = COALESCE(val_custom_bots, custom_bots),
        active_bots = COALESCE(val_active_bots, active_bots),
        copied_allocations = COALESCE(val_copied_allocations, copied_allocations),
        staking_subscriptions = COALESCE(val_staking_subscriptions, staking_subscriptions),
        support_tickets_json = COALESCE(val_support_tickets_json, support_tickets_json),
        is_kyc_verified = COALESCE(val_is_kyc_verified, is_kyc_verified),
        phone = COALESCE(val_phone, phone),
        promo_code_used = COALESCE(val_promo_code_used, promo_code_used),
        updated_at = timezone('utc'::text, now())
    WHERE LOWER(email) = LOWER(target_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.system_save_transaction_and_sync_balance(
    secure_token TEXT,
    target_email TEXT,
    tx_type TEXT,
    tx_amount NUMERIC,
    tx_asset TEXT,
    tx_address TEXT,
    tx_status TEXT,
    tx_reference TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    expected_token TEXT := 'payhero_system_clear_token_vfx';
    current_bal NUMERIC;
    current_dep NUMERIC;
    clean_type TEXT;
    clean_status TEXT;
BEGIN
    IF secure_token <> expected_token THEN
        RAISE EXCEPTION 'Invalid system clearance token.';
    END IF;

    clean_type := UPPER(COALESCE(tx_type, 'DEPOSIT'));
    clean_status := UPPER(COALESCE(tx_status, 'COMPLETED'));

    -- 1. Insert into transactions table bypassing RLS
    INSERT INTO public.transactions (email, user_email, type, amount, asset, address, status, reference, created_at)
    VALUES (target_email, target_email, clean_type, tx_amount, tx_asset, tx_address, clean_status, tx_reference, timezone('utc'::text, now()));

    -- 2. Adjust the profiles table balance if the profile exists
    SELECT wallet_balance, total_deposited INTO current_bal, current_dep 
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(target_email);

    IF FOUND THEN
        IF clean_type = 'WITHDRAWAL' THEN
            current_bal := COALESCE(current_bal, 0) - tx_amount;
        ELSIF clean_type = 'DEPOSIT' AND (clean_status = 'COMPLETED' OR clean_status = 'SUCCESS' OR clean_status = 'SUCCESSFUL') THEN
            current_bal := COALESCE(current_bal, 0) + tx_amount;
            current_dep := COALESCE(current_dep, 0) + tx_amount;
        END IF;

        UPDATE public.profiles
        SET wallet_balance = current_bal,
            total_deposited = current_dep,
            updated_at = timezone('utc'::text, now())
        WHERE LOWER(email) = LOWER(target_email);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Automatic Sync: Set up a trigger to automatically sync new auth.users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, wallet_balance, demo_wallet_balance, is_kyc_verified, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'user',
    0.0000,
    10000.0000,
    'unverified',
    COALESCE(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to auth.users for immediate synchronization on registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 8. Existing Users Ledger Alignment: Retroactively copy existing auth users into public.profiles
INSERT INTO public.profiles (id, email, name, role, wallet_balance, demo_wallet_balance, is_kyc_verified, created_at)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 
  'user', 
  0.0000, 
  10000.0000, 
  'unverified', 
  COALESCE(created_at, now())
FROM auth.users
ON CONFLICT (email) DO NOTHING;

-- Map profile IDs for any pre-created/matching email entries
UPDATE public.profiles p
SET id = u.id
FROM auth.users u
WHERE LOWER(p.email) = LOWER(u.email) AND p.id IS NULL;


-- 9. Explicit Database Access Grants
-- Ensure standard Supabase roles have complete table and execution level permissions.
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant column/table level access explicitly for tables to prevent permission denied state
GRANT ALL PRIVILEGES ON public.profiles TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.transactions TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON public.trades TO postgres, anon, authenticated, service_role;

-- 10. Force Reload PostgREST Schema Cache
-- This ensures that any newly added columns or RPC routines are instantly visible
-- to the PostgREST API without requiring a database reboot or manual cache clear.
NOTIFY pgrst, 'reload schema';





