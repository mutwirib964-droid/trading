-- VexcoinFX Supabase Setup & Administration Query Ledger
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
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Enable Row Level Security (RLS) to protect client ledger records
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 3. Clean out any conflicting security policies for fresh installation
DROP POLICY IF EXISTS "Allow user read access to own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow user update access to own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow administrative full read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow administrative full write access" ON public.profiles;

DROP POLICY IF EXISTS "Allow user read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow user insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow administrative read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow administrative full transactions access" ON public.transactions;

-- 4. Create strong, granular Row Level Security (RLS) policies

-- Profiles Policies
CREATE POLICY "Allow user read access to own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Allow user update access to own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR (
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      AND wallet_balance = (SELECT wallet_balance FROM public.profiles WHERE id = auth.uid())
      AND total_deposited = (SELECT total_deposited FROM public.profiles WHERE id = auth.uid())
    )
  )
);

CREATE POLICY "Allow administrative full read access"
ON public.profiles FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow administrative full write access"
ON public.profiles FOR ALL
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Transactions Policies
CREATE POLICY "Allow user read own transactions"
ON public.transactions FOR SELECT
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE email = user_email OR email = public.transactions.email)
);

CREATE POLICY "Allow user insert own transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  auth.uid() IN (SELECT id FROM public.profiles WHERE email = user_email OR email = public.transactions.email)
);

CREATE POLICY "Allow administrative read all transactions"
ON public.transactions FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Allow administrative full transactions access"
ON public.transactions FOR ALL
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
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
