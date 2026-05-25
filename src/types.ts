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
