-- ==========================================
-- VEXCOINFX PREMIUM SUPABASE DATABASE SETUP
-- ==========================================
-- This script provisions the required tables for users profiles, trades,
-- and financial transactions with Row-Level Security (RLS) policies.
-- Run this in your Supabase SQL Editor.

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. CREATE PROFILES TABLE
alter table public.profiles add column if not exists phone varchar;

create table if not exists public.profiles (
    email varchar primary key,
    name varchar not null,
    phone varchar,
    role varchar not null default 'user' check (role in ('user', 'marketer', 'admin')),
    wallet_balance numeric(18, 4) not null default 0.0000, -- starts at 0 for real account
    invested_capital numeric(18, 4) not null default 0.0000,
    profits numeric(18, 4) not null default 0.0000,
    copy_trading_allocated numeric(18, 4) not null default 0.0000,
    is_kyc_verified varchar not null default 'unverified' check (is_kyc_verified in ('unverified', 'pending', 'verified')),
    kyc_doc_type varchar,
    kyc_uploaded_at timestamp with time zone,
    account_mode varchar not null default 'REAL' check (account_mode in ('REAL', 'DEMO')),
    demo_wallet_balance numeric(18, 4) not null default 10000.0000,
    demo_profits numeric(18, 4) not null default 0.0000,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

-- Indexing for speed
create index if not exists idx_profiles_role on public.profiles(role);

-- 3. CREATE TRANSACTIONS LEGER TABLE
create table if not exists public.transactions (
    id varchar primary key,
    user_email varchar not null references public.profiles(email) on delete cascade,
    type varchar not null check (type in ('DEPOSIT', 'WITHDRAWAL', 'INVEST', 'REDEEM', 'COPY_ALLOCATE', 'COPY_RELEASE')),
    amount numeric(18, 4) not null,
    asset varchar not null,
    address varchar,
    status varchar not null check (status in ('PENDING', 'COMPLETED', 'REJECTED')),
    created_at timestamp with time zone not null default now()
);

create index if not exists idx_transactions_user on public.transactions(user_email);
create index if not exists idx_transactions_status on public.transactions(status);

-- 4. CREATE TRADES LEDGER TABLE
create table if not exists public.trades (
    id varchar primary key,
    user_email varchar not null references public.profiles(email) on delete cascade,
    asset_symbol varchar not null,
    asset_name varchar not null,
    type varchar not null check (type in ('BUY', 'SELL')),
    entry_price numeric(18, 6) not null,
    current_price numeric(18, 6) not null,
    amount numeric(18, 4) not null,
    leverage numeric(10, 2) not null default 1.00,
    margin numeric(18, 4) not null,
    pnl numeric(18, 4) not null default 0.0000,
    status varchar not null check (status in ('OPEN', 'CLOSED')),
    account_mode varchar not null check (account_mode in ('REAL', 'DEMO')),
    created_at timestamp with time zone not null default now()
);

create index if not exists idx_trades_user on public.trades(user_email);
create index if not exists idx_trades_status_mode on public.trades(status, account_mode);

-- Enable Row-Level Security (RLS) on all tables to prevent bypassing
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.trades enable row level security;

-- ==========================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Helper function to check if the caller is an Admin
create or replace function public.is_admin(caller_email text)
returns boolean as $$
begin
    return exists (
        select 1 from public.profiles 
        where email = ltrim(rtrim(lower(caller_email))) 
          and role = 'admin'
    );
end;
$$ language plpgsql security definer;

-- --- PROFILES POLICIES ---

-- Allow everyone to check/register their initial profile row
drop policy if exists "Allow profile insertion during registration" on public.profiles;
create policy "Allow profile insertion during registration"
on public.profiles for insert
with check (true);

-- Users can read their own profile; admins can read any profile
drop policy if exists "Allow read for self or administrator" on public.profiles;
create policy "Allow read for self or administrator"
on public.profiles for select
using (
    auth.jwt() ->> 'email' = email 
    or public.is_admin(auth.jwt() ->> 'email')
);

-- Users can update non-critical aspects of their profile (like kyc updates or demo balances); 
-- Admin can update anything (balances, roles, verification states)
drop policy if exists "Allow update for self or administrator" on public.profiles;
create policy "Allow update for self or administrator"
on public.profiles for update
using (
    auth.jwt() ->> 'email' = email 
    or public.is_admin(auth.jwt() ->> 'email')
)
with check (
    auth.jwt() ->> 'email' = email 
    or public.is_admin(auth.jwt() ->> 'email')
);

-- --- TRANSACTIONS POLICIES ---

-- Allow users to create transaction requests
drop policy if exists "Allow users to submit transactions" on public.transactions;
create policy "Allow users to submit transactions"
on public.transactions for insert
with check (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
);

-- Users can read their own transactions ledger; administrators can read all
drop policy if exists "Allow transaction reading for self or administrator" on public.transactions;
create policy "Allow transaction reading for self or administrator"
on public.transactions for select
using (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
);

-- Only Administrators can alter or delete transaction records (to secure bookkeeping logs)
drop policy if exists "Allow transactions update for administrator only" on public.transactions;
create policy "Allow transactions update for administrator only"
on public.transactions for update
using (public.is_admin(auth.jwt() ->> 'email'))
with check (public.is_admin(auth.jwt() ->> 'email'));

-- --- TRADES POLICIES ---

-- Allow users to open trades
drop policy if exists "Allow trade insertion" on public.trades;
create policy "Allow trade insertion"
on public.trades for insert
with check (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
);

-- Users can read their own trades; administrators can read all
drop policy if exists "Allow trade read for self or administrator" on public.trades;
create policy "Allow trade read for self or administrator"
on public.trades for select
using (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
);

-- Users can close their own trades (update state); administrators can modify any trade parameters
drop policy if exists "Allow trade updates for self or administrator" on public.trades;
create policy "Allow trade updates for self or administrator"
on public.trades for update
using (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
)
with check (
    auth.jwt() ->> 'email' = user_email
    or public.is_admin(auth.jwt() ->> 'email')
);

-- ==========================================================
-- SEEDING DEFAULT ADMINISTRATOR RULES
-- ==========================================================
-- To initiate the specified administrator instantly, we pre-assign their role.
-- When the user with email 'mutwirib964@gmail.com' registers or logs in, 
-- their record will have the default 'admin' role, enabling full capabilities.

insert into public.profiles (email, name, role, wallet_balance, is_kyc_verified)
values ('mutwirib964@gmail.com', 'Admin Mutwiri', 'admin', 0.0000, 'verified')
on conflict (email) do update set role = 'admin', is_kyc_verified = 'verified';
