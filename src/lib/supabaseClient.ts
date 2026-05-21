/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Fallback user / db methods in case client is not yet configured
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Sync user profile to Supabase
 */
export async function dbSyncUser(user: any) {
  if (!user || !user.loggedIn) return null;
  if (!supabase) {
    console.log("[Supabase Fallback] Syncing user locally:", user.email);
    return user;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        email: user.email.toLowerCase(),
        name: user.name,
        role: user.role || "user",
        phone: user.phone || null,
        wallet_balance: user.walletBalance,
        invested_capital: user.investedCapital,
        profits: user.profits,
        copy_trading_allocated: user.copyTradingAllocated,
        is_kyc_verified: user.isKycVerified,
        kyc_doc_type: user.kycDocType || null,
        kyc_uploaded_at: user.kycUploadedAt || null,
        account_mode: user.accountMode,
        demo_wallet_balance: user.demoBalance,
        demo_profits: user.demoProfits,
        updated_at: new Date().toISOString()
      }, { onConflict: "email" })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Supabase Error] dbSyncUser error:", err);
    return null;
  }
}

/**
 * Fetch profile details for a user Email
 */
export async function dbFetchUser(email: string) {
  if (!email) return null;
  if (!supabase) {
    console.log("[Supabase Fallback] Fetching user locally:", email);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Supabase Error] dbFetchUser error:", err);
    return null;
  }
}

/**
 * Record a deposit, withdrawal, or investment transaction
 */
export async function dbSaveTransaction(tx: {
  id: string;
  email: string;
  type: string;
  amount: number;
  asset: string;
  address?: string;
  status: string;
  date: string;
}) {
  if (!supabase) {
    console.log("[Supabase Fallback] Recording transaction locally:", tx.id);
    return tx;
  }

  try {
    const { data, error } = await supabase
      .from("transactions")
      .upsert({
        id: tx.id,
        user_email: tx.email.toLowerCase(),
        type: tx.type,
        amount: tx.amount,
        asset: tx.asset,
        address: tx.address || null,
        status: tx.status,
        created_at: tx.date || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Supabase Error] dbSaveTransaction error:", err);
    return null;
  }
}

/**
 * Record a manual or copy trade
 */
export async function dbSaveTrade(trade: {
  id: string;
  email: string;
  asset_symbol: string;
  asset_name: string;
  type: string; // BUY or SELL
  entry_price: number;
  current_price: number;
  amount: number;
  leverage: number;
  margin: number;
  pnl: number;
  status: string; // OPEN or CLOSED
  account_mode: string; // REAL or DEMO
  timestamp: string;
}) {
  if (!supabase) {
    console.log("[Supabase Fallback] Saving trade locally:", trade.id);
    return trade;
  }

  try {
    const { data, error } = await supabase
      .from("trades")
      .upsert({
        id: trade.id,
        user_email: trade.email.toLowerCase(),
        asset_symbol: trade.asset_symbol,
        asset_name: trade.asset_name,
        type: trade.type,
        entry_price: trade.entry_price,
        current_price: trade.current_price,
        amount: trade.amount,
        leverage: trade.leverage,
        margin: trade.margin,
        pnl: trade.pnl,
        status: trade.status,
        account_mode: trade.account_mode,
        created_at: trade.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("[Supabase Error] dbSaveTrade error:", err);
    return null;
  }
}

/**
 * Fetch total stats for administrators
 */
export async function dbFetchAdminOverview() {
  if (!supabase) return null;

  try {
    const { data: users, error: errUsers } = await supabase
      .from("profiles")
      .select("*");

    const { data: transactions, error: errTrans } = await supabase
      .from("transactions")
      .select("*");

    if (errUsers || errTrans) throw (errUsers || errTrans);

    return {
      users: users || [],
      transactions: transactions || []
    };
  } catch (err) {
    console.error("[Supabase Error] dbFetchAdminOverview error:", err);
    return null;
  }
}
