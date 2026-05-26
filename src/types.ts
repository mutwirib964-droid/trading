export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'crypto' | 'forex' | 'stocks';
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  sparkline: number[];
}

export interface User {
  loggedIn: boolean;
  email: string;
  name: string;
  walletBalance: number;
  investedCapital: number;
  profits: number;
  copyTradingAllocated: number;
  activePositions: Position[];
  isKycVerified: 'unverified' | 'pending' | 'verified';
  kycDocType?: string;
  promoCodeUsed?: string;
  accountMode: 'REAL' | 'DEMO';
  demoBalance: number;
  demoPositions: Position[];
  demoProfits: number;
  role?: 'user' | 'marketer' | 'admin';
  kycUploadedAt?: string;
  id?: string; // supabase user uuid
  phone?: string;
  customBots?: any[];
  activeBots?: any[];
}

export interface Position {
  id: string;
  assetSymbol: string;
  assetName: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  amount: number;
  leverage: number;
  margin: number;
  pnl: number;
  timestamp: string;
  isDemo?: boolean;
  accountMode?: 'REAL' | 'DEMO';
}

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'INVEST' | 'REDEEM' | 'COPY_ALLOCATE' | 'COPY_RELEASE';
  amount: number;
  asset: string;
  address?: string;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
}

export interface CopyTrader {
  id: string;
  name: string;
  avatar: string;
  roi: number;
  winRate: number;
  risk: number;
  followers: number;
  aum: number;
  pnlHistory: number[];
  slogan: string;
  minAllocate: number;
  maxAllocate: number;
}

export interface StakingPlan {
  id: string;
  name: string;
  minDeposit: number;
  maxDeposit?: number;
  roiLabel: string;
  periodDays: number;
  description: string;
  badge?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: 'OPEN' | 'RESOLVED';
  date: string;
  messages: {
    sender: 'user' | 'support';
    text: string;
    timestamp: string;
  }[];
}

export function getTransactionDisplayLabel(tx: { id: string; type: string; asset?: string }) {
  const idLower = (tx.id || '').toLowerCase();
  const assetLower = (tx.asset || '').toLowerCase();
  const typeLower = (tx.type || '').toLowerCase();

  // 1. Bot
  if (idLower.includes('bot') || assetLower.includes('bot')) {
    return "BOT";
  }
  // 2. Copy Trading
  if (idLower.includes('copy') || idLower.includes('release') || assetLower.includes('copy') || assetLower.includes('allocation trade') || assetLower.includes('release allocation')) {
    return "COPY ALLOCATED TRADING";
  }
  // 3. Yield
  if (idLower.includes('stake') || idLower.includes('redeem') || idLower.includes('invest') || typeLower === 'invest' || typeLower === 'redeem') {
    return "YIELD";
  }
  // 4. Financial Deposit
  if (idLower.includes('fin') && typeLower === 'deposit') {
    return "DEPOSIT";
  }
  // 5. Financial Withdrawal
  if (idLower.includes('fin') && typeLower === 'withdrawal') {
    return "WITHDRAWAL";
  }
  // 6. Trade at terminal
  if (idLower.startsWith('tx-') && !idLower.includes('fin') && !idLower.includes('bot') && !idLower.includes('copy') && !idLower.includes('release') && !idLower.includes('stake') && !idLower.includes('redeem')) {
    return "TRADES";
  }

  // Fallback defaults
  if (typeLower === 'deposit') {
    return "DEPOSIT";
  }
  if (typeLower === 'withdrawal') {
    return "WITHDRAWAL";
  }
  
  return tx.type;
}
