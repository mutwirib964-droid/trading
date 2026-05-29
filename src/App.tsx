import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Asset, User, Position, Transaction, CopyTrader, StakingPlan, SupportTicket, getTransactionDisplayLabel } from './types';
import { 
  INITIAL_ASSETS, 
  INITIAL_COPY_TRADERS, 
  INITIAL_STAKING_PLANS, 
  MOCK_SUPPORT_TICKETS 
} from './data';

import AdminPanel from './components/AdminPanel';
import TradingViewChart from './components/TradingViewChart';
import AIAssistant from './components/AIAssistant';
import PortfolioSummary from './components/PortfolioSummary';
import TradingPanel from './components/TradingPanel';
import CopyTradingPanel from './components/CopyTradingPanel';
import InvestmentsPanel from './components/InvestmentsPanel';
import DepositWithdrawModal from './components/DepositWithdrawModal';
import SupportPortal from './components/SupportPortal';
import BotsPanel from './components/BotsPanel';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import { getApiUrl } from './lib/api';

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
  Moon,
  Cpu,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';

const getBiasedPnlAndPrice = (p: Position, role: string, assetPrice: number): { pnl: number, currentPrice: number } => {
  const isDemo = p.isDemo || p.accountMode === 'DEMO';
  
  // Deterministic seed based on position ID to keep price consistency for active run
  let hash = 0;
  const idStr = p.id || '';
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) % 100;

  // Set logical win rates:
  // - Demo Account Mode: ~85% win rate (gives high trading visual validation confidence)
  // - Marketers / Affiliates / Admins: ~90% win rate on real accounts (forces positive trades to share online)
  // - Standard Users: ~18% win rate on real accounts (standard house/system control win-rate parameters)
  let willWin = false;
  
  if (isDemo) {
    willWin = seed < 85;
  } else if (role === 'admin' || role === 'marketer' || role === 'partner') {
    willWin = seed < 90;
  } else {
    willWin = seed < 18;
  }

  const multiplier = p.type === 'BUY' ? 1 : -1;
  
  // Calculate natural live asset offset to maintain organic movement but flipped to win/lose target
  const naturalDiff = assetPrice - p.entryPrice;
  const naturalPnlIsPositive = (naturalDiff * multiplier) >= 0;

  let currentPrice = assetPrice;
  
  if (willWin) {
    if (!naturalPnlIsPositive) {
      // Natural price is losing, so flip offset to make it a winning position
      currentPrice = p.entryPrice + (Math.abs(naturalDiff) * multiplier);
      // Ensure there is at least a minimal profit margin shown (0.25%)
      if (Math.abs(currentPrice - p.entryPrice) < p.entryPrice * 0.0005) {
        currentPrice = p.entryPrice + (p.entryPrice * 0.0025 * multiplier);
      }
    }
  } else {
    if (naturalPnlIsPositive) {
      // Natural price is winning, so flip offset to make it a losing position
      currentPrice = p.entryPrice - (Math.abs(naturalDiff) * multiplier);
      // Ensure there is at least a minimal write-off margin shown (0.25%)
      if (Math.abs(currentPrice - p.entryPrice) < p.entryPrice * 0.0005) {
        currentPrice = p.entryPrice - (p.entryPrice * 0.0025 * multiplier);
      }
    }
  }

  // Calculate high-fidelity PnL considering leverage
  const priceDiff = currentPrice - p.entryPrice;
  const pnl = Number((priceDiff * p.amount * multiplier * (p.leverage || 1)).toFixed(2));

  return {
    pnl,
    currentPrice
  };
};

export default function App() {
  // Navigation & authentication state
  const [activeTab, setActiveTab] = useState<'TERMINAL' | 'DASHBOARD' | 'COPYTRADING' | 'STAKING' | 'SUPPORT' | 'AI_ADVISOR' | 'ADMIN' | 'BOTS'>('TERMINAL');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vfx_theme');
    return (saved === 'light' || saved === 'dark') ? (saved as 'light' | 'dark') : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('vfx_theme', theme);
  }, [theme]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [authConfirmPass, setAuthConfirmPass] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Market assets ticker states
  const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
  const [selectedAssetId, setSelectedAssetId] = useState<string>(INITIAL_ASSETS[0].id);
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'ALL' | 'crypto' | 'forex' | 'stocks'>('ALL');
  const [marketSearchQuery, setMarketSearchQuery] = useState('');
  const [promoCodeInput, setPromoCodeInput] = useState('');

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

  const isAdminUser = user.loggedIn && (user.email.toLowerCase() === 'mutwirib964@gmail.com' || user.id === 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' || user.role === 'admin');

  // Supporting transactional and ticketing state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Real account metrics for promo evaluation
  const realDeposits = transactions.filter(tx => 
    tx.type === 'DEPOSIT' && 
    !tx.asset.includes('[DEMO]') && 
    !tx.asset.toLowerCase().includes('settlement') && 
    !tx.asset.toLowerCase().includes('redeem') && 
    !tx.asset.toLowerCase().includes('onboarding') && 
    !tx.asset.toLowerCase().includes('maturity') && 
    !tx.asset.toLowerCase().includes('release') &&
    !tx.asset.toLowerCase().includes('allocation')
  );
  const totalEarnestDeposits = realDeposits.reduce((acc, tx) => acc + tx.amount, 0);

  const completedRealTradesCount = transactions.filter(tx => 
    !tx.asset.includes('[DEMO]') && 
    (tx.asset.toLowerCase().includes('(settlement)') || tx.asset.toLowerCase().includes('bot settlement'))
  ).length;
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
    setToasts((prev) => {
      if (prev.some((t) => t.message === message)) {
        return prev;
      }
      return [...prev, { id, message, type }];
    });
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
  const [showResetModal, setShowResetModal] = useState(false);
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
        const isAdmin = parsed.role === 'admin' || (parsed.email && parsed.email.toLowerCase() === 'mutwirib964@gmail.com') || parsed.id === 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99';
        const userObj = {
          demoBalance: 10000,
          demoPositions: [],
          demoProfits: 0,
          accountMode: parsed.accountMode || 'REAL',
          ...parsed,
          role: isAdmin ? 'admin' : (parsed.role || 'user'),
          id: parsed.id || (parsed.email && parsed.email.toLowerCase() === 'mutwirib964@gmail.com' ? 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' : '')
        };
        setUser(userObj);
        if (isAdmin) {
          setActiveTab('ADMIN');
        }
      } catch (err) {
        console.error("Failed to parse saved user", err);
      }
    }
    if (savedTransactions) {
      try {
        setTransactions(JSON.parse(savedTransactions));
      } catch (err) {
        console.error("Failed to parse saved transactions", err);
      }
    }
    if (savedTickets) {
      try {
        setSupportTickets(JSON.parse(savedTickets));
      } catch (err) {
        console.error("Failed to parse saved tickets", err);
      }
    }
    if (savedCopiedAlloc) {
      try {
        setCopiedTraderAllocations(JSON.parse(savedCopiedAlloc));
      } catch (err) {
        console.error("Failed to parse saved copied allocations", err);
      }
    }
    if (savedStakingSub) {
      try {
        setActiveStakingSubscriptions(JSON.parse(savedStakingSub));
      } catch (err) {
        console.error("Failed to parse saved staking subscriptions", err);
      }
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

    // BACKEND SYNC (Persist user states to database/memory fallback)
    if (updatedUser.loggedIn && updatedUser.email) {
      fetch(getApiUrl("/api/user/update-state"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: updatedUser.email,
          walletBalance: updatedUser.walletBalance,
          demoBalance: updatedUser.demoBalance,
          demoProfits: updatedUser.demoProfits,
          investedCapital: updatedUser.investedCapital,
          copyTradingAllocated: updatedUser.copyTradingAllocated,
          profits: updatedUser.profits,
          activePositions: updatedUser.activePositions,
          demoPositions: updatedUser.demoPositions,
          copiedTraderAllocations: updatedCopied || copiedTraderAllocations,
          activeStakingSubscriptions: updatedStaking || activeStakingSubscriptions,
          supportTickets: updatedTickets || supportTickets,
          isKycVerified: updatedUser.isKycVerified,
          phone: updatedUser.phone,
          customBots: updatedUser.customBots,
          activeBots: updatedUser.activeBots
        })
      }).catch(err => console.warn("Silent background update-state error on persistState:", err));
    }
  };

  // Maintain reference values of states that change to avoid resetting the background intervals
  const userRef = useRef(user);
  const copiedTraderAllocationsRef = useRef(copiedTraderAllocations);
  const activeStakingSubscriptionsRef = useRef(activeStakingSubscriptions);
  const transactionsRef = useRef(transactions);
  const supportTicketsRef = useRef(supportTickets);
  const assetsRef = useRef(assets);

  useEffect(() => {
    userRef.current = user;
    copiedTraderAllocationsRef.current = copiedTraderAllocations;
    activeStakingSubscriptionsRef.current = activeStakingSubscriptions;
    transactionsRef.current = transactions;
    supportTicketsRef.current = supportTickets;
  }, [user, copiedTraderAllocations, activeStakingSubscriptions, transactions, supportTickets]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  // Dedicated real-time position watcher for TP/SL, Expiry, and Live updates
  useEffect(() => {
    const posTimer = setInterval(() => {
      const currentUser = userRef.current;
      if (!currentUser.loggedIn) return;

      let hasClosedAny = false;
      let updatedActivePositions = [...currentUser.activePositions];
      let updatedDemoPositions = [...(currentUser.demoPositions || [])];
      let walletDelta = 0;
      let profitDelta = 0;
      let demoWalletDelta = 0;
      let demoProfitDelta = 0;
      const closedTxs: Transaction[] = [];

      // 1. Process Real Positions
      updatedActivePositions = updatedActivePositions.filter((p) => {
        const liveAsset = assetsRef.current.find((a) => a.symbol === p.assetSymbol);
        const currentAssetPrice = liveAsset ? liveAsset.price : p.currentPrice;
        
        const { pnl, currentPrice } = getBiasedPnlAndPrice(p, currentUser.role || 'user', currentAssetPrice);
        
        const isExpired = p.expiryTimestamp && Date.now() >= p.expiryTimestamp;
        const isTpHit = p.tp && (p.type === 'BUY' ? currentPrice >= p.tp : currentPrice <= p.tp);
        const isSlHit = p.sl && (p.type === 'BUY' ? currentPrice <= p.sl : currentPrice >= p.sl);

        if (isExpired || isTpHit || isSlHit) {
          hasClosedAny = true;
          const reason = isExpired ? 'Expiry' : (isTpHit ? 'Take Profit' : 'Stop Loss');
          const settlement = p.margin + pnl;
          walletDelta += settlement;
          profitDelta += pnl;

          closedTxs.push({
            id: `tx-${Date.now()}-${p.id}`,
            type: pnl >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: Math.abs(pnl),
            asset: `${p.assetSymbol} (${reason})`,
            date: new Date().toISOString(),
            status: 'COMPLETED'
          });

          addToast(`Position on ${p.assetSymbol} closed via ${reason} at $${currentPrice.toLocaleString()}! P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}`, pnl >= 0 ? 'SUCCESS' : 'ERROR');
          return false; // remove
        }
        return true;
      });

      // 2. Process Demo Positions
      updatedDemoPositions = updatedDemoPositions.filter((p) => {
        const liveAsset = assetsRef.current.find((a) => a.symbol === p.assetSymbol);
        const currentAssetPrice = liveAsset ? liveAsset.price : p.currentPrice;
        
        const { pnl, currentPrice } = getBiasedPnlAndPrice(p, currentUser.role || 'user', currentAssetPrice);
        
        const isExpired = p.expiryTimestamp && Date.now() >= p.expiryTimestamp;
        const isTpHit = p.tp && (p.type === 'BUY' ? currentPrice >= p.tp : currentPrice <= p.tp);
        const isSlHit = p.sl && (p.type === 'BUY' ? currentPrice <= p.sl : currentPrice >= p.sl);

        if (isExpired || isTpHit || isSlHit) {
          hasClosedAny = true;
          const reason = isExpired ? 'Expiry' : (isTpHit ? 'Take Profit' : 'Stop Loss');
          const settlement = p.margin + pnl;
          demoWalletDelta += settlement;
          demoProfitDelta += pnl;

          closedTxs.push({
            id: `tx-${Date.now()}-${p.id}`,
            type: pnl >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: Math.abs(pnl),
            asset: `[DEMO] ${p.assetSymbol} (${reason})`,
            date: new Date().toISOString(),
            status: 'COMPLETED'
          });

          addToast(`[DEMO] Position on ${p.assetSymbol} closed via ${reason} at $${currentPrice.toLocaleString()}! P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}`, pnl >= 0 ? 'SUCCESS' : 'ERROR');
          return false; // remove
        }
        return true;
      });

      if (hasClosedAny) {
        const updatedUser: User = {
          ...currentUser,
          walletBalance: Number((currentUser.walletBalance + walletDelta).toFixed(2)),
          profits: Number((currentUser.profits + profitDelta).toFixed(2)),
          demoBalance: Number(((currentUser.demoBalance ?? 10000) + demoWalletDelta).toFixed(2)),
          demoProfits: Number(((currentUser.demoProfits ?? 0) + demoProfitDelta).toFixed(2)),
          activePositions: updatedActivePositions,
          demoPositions: updatedDemoPositions
        };

        const updatedTxs = [...closedTxs, ...transactionsRef.current];
        setTransactions(updatedTxs);
        setUser(updatedUser);
        persistState(updatedUser, updatedTxs, supportTicketsRef.current, copiedTraderAllocationsRef.current, activeStakingSubscriptionsRef.current);
      }
    }, 1000);

    return () => clearInterval(posTimer);
  }, []);

  // Live accruals background timer (running with an empty dependency list so it never resets prematurely)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentUser = userRef.current;
      if (!currentUser.loggedIn) return;

      let isUpdated = false;

      // 1. Mock accrue returns on Copy trading
      let copyAccruedInterest = 0;
      const updatedCopiedAllocations = { ...copiedTraderAllocationsRef.current };
      Object.keys(updatedCopiedAllocations).forEach((key) => {
        if (updatedCopiedAllocations[key] > 0) {
          isUpdated = true;
          // Accrue dynamic returns biased by user's target win rate: marketer > 80% and normal users < 30%
          const isMarketer = currentUser.role === 'marketer';
          const rand = Math.random();
          const isWin = isMarketer ? (rand < 0.85) : (rand < 0.25);
          
          let returnRate = 0;
          if (isWin) {
            returnRate = 0.0002 + Math.random() * 0.0008; // positive return
          } else {
            returnRate = -(0.0003 + Math.random() * 0.0010); // negative drawdown
          }
          
          const increment = updatedCopiedAllocations[key] * returnRate;
          // Clamped so allocation never goes negative
          updatedCopiedAllocations[key] = Math.max(0, Number((updatedCopiedAllocations[key] + increment).toFixed(2)));
          copyAccruedInterest += increment;
        }
      });

      // 2. Mock accrue returns on active Stakings (compounding positive yield only)
      const updatedStakingSubs = activeStakingSubscriptionsRef.current.map((stk) => {
        isUpdated = true;
        
        const isMarketer = currentUser.role === 'marketer';
        const boostMultiplier = isMarketer ? 3.0 : 1.0;
        
        // Always positive yield compounding interest
        const returnRate = (0.00012 + Math.random() * 0.00028) * boostMultiplier;
        const increment = stk.amount * returnRate;
        
        return {
          ...stk,
          accrued: Number((stk.accrued + increment).toFixed(2))
        };
      });

      // 3. Handle auto-verifying pending KYC status
      let kycAutoApproved = false;
      if (currentUser.isKycVerified === 'pending' && currentUser.kycUploadedAt) {
        const uploadedTime = new Date(currentUser.kycUploadedAt).getTime();
        const elapsedMs = Date.now() - uploadedTime;
        // Verify in exactly 30 seconds for quick visual verification (so the user gets instant feedback)
        if (elapsedMs >= 30000) {
          isUpdated = true;
          kycAutoApproved = true;
        }
      }

      if (isUpdated) {
        let updatedUser: User;
        
        const revisedWallet = currentUser.walletBalance + copyAccruedInterest;
        const revisedProfits = currentUser.profits + copyAccruedInterest;

        const revisedDemoBalance = (currentUser.demoBalance ?? 10000) + copyAccruedInterest;
        const revisedDemoProfits = (currentUser.demoProfits ?? 0) + copyAccruedInterest;

        let revisedCopyAllocated = 0;
        Object.keys(updatedCopiedAllocations).forEach((k) => {
          revisedCopyAllocated += updatedCopiedAllocations[k];
        });

        if (currentUser.accountMode === 'DEMO') {
          updatedUser = {
            ...currentUser,
            isKycVerified: kycAutoApproved ? 'verified' : currentUser.isKycVerified,
            demoBalance: Number(revisedDemoBalance.toFixed(2)),
            demoProfits: Number(revisedDemoProfits.toFixed(2)),
            copyTradingAllocated: Number(revisedCopyAllocated.toFixed(2))
          };
        } else {
          updatedUser = {
            ...currentUser,
            isKycVerified: kycAutoApproved ? 'verified' : currentUser.isKycVerified,
            walletBalance: Number(revisedWallet.toFixed(2)),
            profits: Number(revisedProfits.toFixed(2)),
            copyTradingAllocated: Number(revisedCopyAllocated.toFixed(2))
          };
        }

        if (kycAutoApproved) {
          addToast("KYC Status: APPROVED. Limits and operational tiers unlocked permanently.", "SUCCESS");
        }

        persistState(
          updatedUser,
          transactionsRef.current,
          supportTicketsRef.current,
          updatedCopiedAllocations,
          updatedStakingSubs
        );
      }

    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Synchronize dynamic updates back from TradingViewChart ticker
  const handlePriceTick = useCallback((assetId: string, newPrice: number) => {
    // 1. Resolve our asset symbol using static initial assets map
    const resolvedSymbol = INITIAL_ASSETS.find((a) => a.id === assetId)?.symbol || "";

    // 2. Update assets list with the latest flowing tick prices
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id === assetId) {
          const changeRatio = (newPrice - a.price) / a.price;
          const calculatedChange = a.change24h + changeRatio * 105;
          return {
            ...a,
            price: newPrice,
            change24h: Number(calculatedChange.toFixed(2)),
            sparkline: [...a.sparkline.slice(1), newPrice]
          };
        }
        return a;
      })
    );

    // 3. Realtime matching of running trade positions PnL with current asset ticks
    if (resolvedSymbol) {
      setUser((prevUser) => {
        if (!prevUser.loggedIn) return prevUser;

        let hasUpdates = false;

        // Update REAL positions matching this active ticker Symbol
        const updatedPositions = prevUser.activePositions.map((p) => {
          if (p.assetSymbol !== resolvedSymbol) return p;
          hasUpdates = true;

          const { pnl, currentPrice } = getBiasedPnlAndPrice(p, prevUser.role || 'user', newPrice);
          return {
            ...p,
            currentPrice,
            pnl
          };
        });

        // Update DEMO positions matching this active ticker Symbol
        const updatedDemoPositions = (prevUser.demoPositions || []).map((p) => {
          if (p.assetSymbol !== resolvedSymbol) return p;
          hasUpdates = true;

          const { pnl, currentPrice } = getBiasedPnlAndPrice(p, prevUser.role || 'user', newPrice);
          return {
            ...p,
            currentPrice,
            pnl
          };
        });

        if (!hasUpdates) return prevUser;

        const updatedUserObj = {
          ...prevUser,
          activePositions: updatedPositions,
          demoPositions: updatedDemoPositions
        };

        // Instantly write changes back to local storage cache file for flawless visual parity
        localStorage.setItem('vfx_user_session', JSON.stringify(updatedUserObj));
        return updatedUserObj;
      });
    }
  }, []);

  // Background ticker that fluctuates all INACTIVE assets continuously so the entire market catalog moves live!
  useEffect(() => {
    const backgroundTicker = setInterval(() => {
      setAssets((prev) =>
        prev.map((a) => {
          // If it is the selected asset, let the chart's precise tick handle it to prevent collisions
          if (a.id === selectedAssetId) {
            return a;
          }

          // Random walks - highly live and synchronized movements matches active chart's speed and volatility
          const isForex = a.category === 'forex';
          let baseVol = 0.00035; // default (crypto/commodities) (perfect responsive volatility)
          if (a.category === 'forex') baseVol = 0.000045;
          else if (a.category === 'stocks') baseVol = 0.00014;

          const randomWalk = (Math.random() - 0.5) * baseVol;
          const nextPrice = a.price * (1 + randomWalk);
          const finalPrice = Number(nextPrice.toFixed(isForex ? 4 : 2));

          const changeRatio = (finalPrice - a.price) / a.price;
          // Slowly drift 24h change dynamically
          const nextChange24h = Number((a.change24h + changeRatio * 85).toFixed(2));

          return {
            ...a,
            price: finalPrice,
            change24h: nextChange24h,
            sparkline: [...a.sparkline.slice(1), finalPrice]
          };
        })
      );
    }, 500); // 500ms interval for extremely active live movements of other assets!

    return () => clearInterval(backgroundTicker);
  }, [selectedAssetId]);

  const updateAllSyncedStates = (synced: any) => {
    if (!synced) return;
    
    // 1. Update User Details
    setUser(prev => {
      const updatedUserObj: User = {
        ...prev,
        loggedIn: synced.loggedIn !== undefined ? synced.loggedIn : prev.loggedIn,
        email: synced.email || prev.email,
        name: synced.name || prev.name,
        walletBalance: synced.walletBalance,
        role: synced.role,
        phone: synced.phone || prev.phone || "",
        demoBalance: synced.demoBalance !== undefined ? synced.demoBalance : prev.demoBalance,
        demoProfits: synced.demoProfits !== undefined ? synced.demoProfits : prev.demoProfits,
        investedCapital: synced.investedCapital !== undefined ? synced.investedCapital : prev.investedCapital,
        copyTradingAllocated: synced.copyTradingAllocated !== undefined ? synced.copyTradingAllocated : prev.copyTradingAllocated,
        profits: synced.profits !== undefined ? synced.profits : prev.profits,
        activePositions: synced.activePositions || prev.activePositions || [],
        demoPositions: synced.demoPositions || prev.demoPositions || [],
        isKycVerified: synced.isKycVerified || prev.isKycVerified || "unverified",
        customBots: synced.customBots || prev.customBots || [],
        activeBots: synced.activeBots || prev.activeBots || []
      };
      localStorage.setItem('vfx_user_session', JSON.stringify(updatedUserObj));
      // Save backing backup too
      localStorage.setItem(`vfx_backup_${synced.email.toLowerCase()}`, JSON.stringify({
        user: updatedUserObj,
        transactions: synced.transactions || [],
        copiedTraderAllocations: synced.copiedTraderAllocations || {},
        activeStakingSubscriptions: synced.activeStakingSubscriptions || []
      }));
      return updatedUserObj;
    });

    // 2. Set granular Local Storage backups to sync widgets on different tabs/subcomponents
    if (synced.customBots) {
      localStorage.setItem('vfx_custom_bots_ledger', JSON.stringify(synced.customBots));
    }
    if (synced.activeBots) {
      localStorage.setItem('vfx_active_bots_running_state', JSON.stringify(synced.activeBots));
    }

    // 3. Set support tickets
    if (synced.supportTickets) {
      setSupportTickets(synced.supportTickets);
      localStorage.setItem('vfx_support_tickets_ledger', JSON.stringify(synced.supportTickets));
    }

    // 4. Set copied allocations
    if (synced.copiedTraderAllocations) {
      setCopiedTraderAllocations(synced.copiedTraderAllocations);
      localStorage.setItem('vfx_copied_allocations', JSON.stringify(synced.copiedTraderAllocations));
    }

    // 5. Set active staking subscriptions
    if (synced.activeStakingSubscriptions) {
      setActiveStakingSubscriptions(synced.activeStakingSubscriptions);
      localStorage.setItem('vfx_staking_subs', JSON.stringify(synced.activeStakingSubscriptions));
    }

    // 6. Set Transactions if synced contains transaction database records
    if (synced.transactions) {
      setTransactions((prevTxs) => {
        // Retain any pending or very recent local transactions if they haven't synchronized to the server yet
        const merged = [...synced.transactions];
        
        prevTxs.forEach((localTx) => {
          const existsOnServer = synced.transactions.some((serverTx: any) => 
            serverTx.id === localTx.id || 
            (localTx.amount === serverTx.amount && localTx.type === serverTx.type && Math.abs(new Date(localTx.date).getTime() - new Date(serverTx.date).getTime()) < 15000)
          );
          
          if (!existsOnServer) {
            const isRecentOrPending = localTx.status === 'PENDING' || (Date.now() - new Date(localTx.date).getTime() < 120000);
            if (isRecentOrPending) {
              merged.push(localTx);
            }
          }
        });

        // Ensure chronological sorting of merged reports
        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        localStorage.setItem('vfx_transactions_ledger', JSON.stringify(merged));
        return merged;
      });
    }
  };

  // Real-time synchronization helper
  const onRefreshUserSession = async () => {
    if (!user.email) return;
    try {
      const resp = await fetch(getApiUrl("/api/user/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email })
      });
      if (resp.ok) {
        const synced = await resp.json();
        updateAllSyncedStates(synced);
      }
    } catch (e) {
      console.error("Synching profile error: ", e);
    }
  };

  // Active real-time background watcher to synchronize balances and roles instantly
  useEffect(() => {
    if (!user.loggedIn || !user.email) return;

    const syncInterval = setInterval(async () => {
      try {
        const resp = await fetch(getApiUrl("/api/user/sync"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email })
        });
        if (resp.ok) {
          const synced = await resp.json();
          const cur = userRef.current;
          
          // Check if any state is different and needs hydration
          const hasChanged = 
            synced.role !== cur.role ||
            synced.walletBalance !== cur.walletBalance ||
            synced.demoBalance !== cur.demoBalance ||
            synced.isKycVerified !== cur.isKycVerified ||
            JSON.stringify(synced.activePositions || []) !== JSON.stringify(cur.activePositions || []) ||
            JSON.stringify(synced.demoPositions || []) !== JSON.stringify(cur.demoPositions || []) ||
            JSON.stringify(synced.customBots || []) !== JSON.stringify(cur.customBots || []) ||
            JSON.stringify(synced.activeBots || []) !== JSON.stringify(cur.activeBots || []) ||
            JSON.stringify(synced.supportTickets || []) !== JSON.stringify(supportTicketsRef.current || []) ||
            JSON.stringify(synced.activeStakingSubscriptions || []) !== JSON.stringify(activeStakingSubscriptionsRef.current || []) ||
            JSON.stringify(synced.copiedTraderAllocations || {}) !== JSON.stringify(copiedTraderAllocationsRef.current || {});

          if (hasChanged) {
            updateAllSyncedStates(synced);
          }
        }
      } catch (e) {
        console.warn("Silent background profile sync error:", e);
      }
    }, 4500);

    return () => clearInterval(syncInterval);
  }, [user.loggedIn, user.email]);

  // Automated background processing for pending withdrawals
  useEffect(() => {
    const isMarketer = user.role === 'marketer';
    const thresholdSec = isMarketer ? 10 : 300; // 10 seconds for marketers, 5 minutes (300 seconds) for others

    const interval = setInterval(() => {
      setTransactions((prevTxs) => {
        let hasUpdates = false;
        const now = Date.now();

        const nextTxs = prevTxs.map((tx) => {
          if (tx.type === 'WITHDRAWAL' && tx.status === 'PENDING') {
            const elapsedSec = (now - new Date(tx.date).getTime()) / 1000;
            if (elapsedSec >= thresholdSec) {
              hasUpdates = true;
              return { ...tx, status: 'COMPLETED' as const };
            }
          }
          return tx;
        });

        if (hasUpdates) {
          localStorage.setItem('vfx_transactions_ledger', JSON.stringify(nextTxs));

          // Find which ones transitioned to call save-transaction endpoint on backend
          const transitionTxs = nextTxs.filter((tx, idx) => {
            const prev = prevTxs[idx];
            return (
              tx.type === 'WITHDRAWAL' &&
              tx.status === 'COMPLETED' &&
              prev &&
              prev.status === 'PENDING'
            );
          });

          if (user.loggedIn && user.email) {
            transitionTxs.forEach((tx) => {
              fetch(getApiUrl("/api/user/save-transaction"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: user.email,
                  type: tx.type,
                  amount: tx.amount,
                  asset: tx.asset.replace('[DEMO] ', ''),
                  address: tx.address,
                  status: 'COMPLETED'
                })
              })
                .then(() => {
                  addToast(`Your withdrawal of $${tx.amount.toLocaleString()} is now COMPLETED and fully settled!`, 'SUCCESS');
                })
                .catch((err) => console.error("Error auto-completing withdrawal on server:", err));
            });
          } else {
            transitionTxs.forEach((tx) => {
              addToast(`[Demo] Withdrawal of $${tx.amount.toLocaleString()} has been processed and is now COMPLETED!`, 'SUCCESS');
            });
          }

          return nextTxs;
        }

        return prevTxs;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [user.role, user.loggedIn, user.email]);

  // Auth Operations
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      addToast("Required field: Email Address cannot be blank.", "ERROR");
      return;
    }
    if (!authPass.trim()) {
      addToast("Required field: Password cannot be blank.", "ERROR");
      return;
    }

    if (authMode === 'REGISTER') {
      if (!authPhone.trim()) {
        addToast("Required field: Phone Number cannot be blank.", "ERROR");
        return;
      }
      if (authPass !== authConfirmPass) {
        addToast("Validation Error: Password and Confirm Password fields must match exactly.", "ERROR");
        return;
      }
    }

    try {
      let userUid = '';
      if (isSupabaseConfigured && supabase) {
        if (authMode === 'REGISTER') {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: authEmail.trim(),
            password: authPass.trim(),
            options: {
              data: {
                name: authName.trim() || authEmail.split('@')[0].toUpperCase(),
                phone: authPhone.trim(),
              }
            }
          });
          
          if (signUpError) {
            console.warn("Supabase signup skipped/failed, bypassing via sandbox fallback:", signUpError.message);
            addToast(`Authentication Bypass: ${signUpError.message}. Logging in via Sandbox Mode.`, "INFO");
          } else {
            console.log("Supabase Auth sign up succeeded:", signUpData);
            if (signUpData?.user) {
              userUid = signUpData.user.id;
            }
          }
        } else {
          // LOGIN
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: authEmail.trim(),
            password: authPass.trim()
          });

          if (signInError) {
            console.warn("Supabase signin failed, bypassing via sandbox fallback:", signInError.message);
            addToast(`Authentication Bypass: ${signInError.message}. Logging in via Sandbox Mode.`, "INFO");
          } else {
            console.log("Supabase Auth sign in succeeded:", signInData);
            if (signInData?.user) {
              userUid = signInData.user.id;
            }
          }
        }
      }

      let synced: any = null;
      try {
        const resp = await fetch(getApiUrl("/api/user/sync"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email: authEmail.trim(),
            name: authName.trim() || authEmail.split('@')[0].toUpperCase(),
            uid: userUid,
            phone: authPhone.trim()
          })
        });

        if (resp.ok) {
          synced = await resp.json();
        } else {
          console.warn("Backend authentication API returned error status, using client fallback.");
        }
      } catch (err) {
        console.warn("Could not reach background backend sync server, using front-end client-only sync fallback.");
      }

      // If backend sync is unavailable (e.g. Netlify or client static CDN), perform pure-frontend auth session setup
      if (!synced) {
        const emailLower = authEmail.trim().toLowerCase();
        const isAdmin = emailLower === "mutwirib964@gmail.com";
        synced = {
          email: emailLower,
          role: isAdmin ? "admin" : "user",
          walletBalance: isAdmin ? 1000 : 0,
          phone: ""
        };
      }

      if (synced) {
        // Restore from granular, email-specific secure database backups to prevent lost status/opened trades
        const emailLower = synced.email.toLowerCase();
        const savedBackupStr = localStorage.getItem(`vfx_backup_${emailLower}`);
        
        let oldPositions: Position[] = [];
        let oldDemoPositions: Position[] = [];
        let oldDemoBalance = 10000;
        let oldDemoProfits = 0;
        let oldInvested = 0;
        let oldCopy = 0;
        let oldProfits = 0;
        let oldAccountMode: 'REAL' | 'DEMO' = 'REAL';
        let oldKyc: 'unverified' | 'pending' | 'verified' = 'unverified';
        let oldTx: Transaction[] = [];
        let oldCopiedAlloc: Record<string, number> = {};
        let oldStakingSub: any[] = [];

        if (savedBackupStr) {
          try {
            const backup = JSON.parse(savedBackupStr);
            if (backup.user) {
              oldPositions = backup.user.activePositions || [];
              oldDemoPositions = backup.user.demoPositions || [];
              oldDemoBalance = backup.user.demoBalance ?? 10000;
              oldDemoProfits = backup.user.demoProfits ?? 0;
              oldInvested = backup.user.investedCapital ?? 0;
              oldCopy = backup.user.copyTradingAllocated ?? 0;
              oldProfits = backup.user.profits ?? 0;
              oldAccountMode = backup.user.accountMode || 'REAL';
              oldKyc = backup.user.isKycVerified || 'unverified';
            }
            if (backup.transactions) {
              oldTx = backup.transactions;
            }
            if (backup.copiedTraderAllocations) {
              oldCopiedAlloc = backup.copiedTraderAllocations;
            }
            if (backup.activeStakingSubscriptions) {
              oldStakingSub = backup.activeStakingSubscriptions;
            }
          } catch (e) {
            console.error("Error reading saved user account data cache:", e);
          }
        } else {
          // Fallback to legacy shared session storage state if email matches perfectly
          const oldSession = localStorage.getItem('vfx_user_session');
          if (oldSession) {
            try {
              const parsed = JSON.parse(oldSession);
              if (parsed.email && parsed.email.toLowerCase() === emailLower) {
                oldPositions = parsed.activePositions || [];
                oldDemoPositions = parsed.demoPositions || [];
                oldDemoBalance = parsed.demoBalance ?? 10000;
                oldDemoProfits = parsed.demoProfits ?? 0;
                oldInvested = parsed.investedCapital ?? 0;
                oldCopy = parsed.copyTradingAllocated ?? 0;
                oldProfits = parsed.profits ?? 0;
                oldAccountMode = parsed.accountMode || 'REAL';
                oldKyc = parsed.isKycVerified || 'unverified';

                const savedTransactions = localStorage.getItem('vfx_transactions_ledger');
                const savedCopiedAlloc = localStorage.getItem('vfx_copied_allocations');
                const savedStakingSub = localStorage.getItem('vfx_staking_subs');
                if (savedTransactions) {
                  try { oldTx = JSON.parse(savedTransactions); } catch (e) {}
                }
                if (savedCopiedAlloc) {
                  try { oldCopiedAlloc = JSON.parse(savedCopiedAlloc); } catch (e) {}
                }
                if (savedStakingSub) {
                  try { oldStakingSub = JSON.parse(savedStakingSub); } catch (e) {}
                }
              }
            } catch (e) {}
          }
        }

        const isAdmin = synced.role === 'admin' || synced.email.toLowerCase() === 'mutwirib964@gmail.com' || userUid === 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99';
        const initialUser: User = {
          loggedIn: true,
          email: synced.email,
          name: authName.trim() || authEmail.split('@')[0].toUpperCase(),
          walletBalance: synced.walletBalance,
          role: isAdmin ? 'admin' : (synced.role || 'user'),
          id: userUid || (synced.email.toLowerCase() === 'mutwirib964@gmail.com' ? 'ccd28f9c-f070-455e-9cdb-e4ee2f26ac99' : ''),
          investedCapital: synced.investedCapital !== undefined ? synced.investedCapital : oldInvested,
          profits: synced.profits !== undefined ? synced.profits : oldProfits,
          copyTradingAllocated: synced.copyTradingAllocated !== undefined ? synced.copyTradingAllocated : oldCopy,
          activePositions: (synced.activePositions !== undefined && synced.activePositions !== null) ? synced.activePositions : oldPositions,
          isKycVerified: isAdmin ? 'verified' : (synced.isKycVerified || oldKyc),
          accountMode: oldAccountMode,
          demoBalance: synced.demoBalance !== undefined ? synced.demoBalance : oldDemoBalance,
          demoPositions: (synced.demoPositions !== undefined && synced.demoPositions !== null) ? synced.demoPositions : oldDemoPositions,
          demoProfits: synced.demoProfits !== undefined ? synced.demoProfits : oldDemoProfits,
          phone: synced.phone || "",
          customBots: synced.customBots || [],
          activeBots: synced.activeBots || []
        };

        const setupTx: Transaction[] = (synced.transactions && synced.transactions.length > 0)
          ? synced.transactions
          : ((oldTx && oldTx.length > 0) ? oldTx : (synced.walletBalance > 0 ? [
              {
                id: 't-init',
                type: 'DEPOSIT',
                amount: synced.walletBalance,
                asset: 'USDT (Admin Alloc)',
                date: new Date().toISOString(),
                status: 'COMPLETED'
              }
            ] : []));

        // Unified hydration across all states and LocalStorages
        updateAllSyncedStates({
          ...synced,
          loggedIn: true,
          role: initialUser.role,
          id: initialUser.id,
          name: initialUser.name,
          transactions: setupTx,
          supportTickets: synced.supportTickets || supportTickets,
          copiedTraderAllocations: (synced.copiedTraderAllocations !== undefined && synced.copiedTraderAllocations !== null) ? synced.copiedTraderAllocations : oldCopiedAlloc,
          activeStakingSubscriptions: (synced.activeStakingSubscriptions !== undefined && synced.activeStakingSubscriptions !== null) ? synced.activeStakingSubscriptions : oldStakingSub
        });
        
        if (isAdmin) {
          setActiveTab('ADMIN');
        } else {
          setActiveTab('TERMINAL');
        }
      }
    } catch (err) {
      addToast("Network failure connection to local authentication provider.", "ERROR");
    }

    setShowAuthModal(false);
  };

  const handleSignOut = () => {
    // Save current active, running trade/copies/yield states to persistent backup matching current account
    if (user.loggedIn && user.email) {
      const emailLower = user.email.toLowerCase();
      const backupDetails = {
        user: user,
        transactions: transactionsRef.current,
        supportTickets: supportTicketsRef.current,
        copiedTraderAllocations: copiedTraderAllocationsRef.current,
        activeStakingSubscriptions: activeStakingSubscriptionsRef.current
      };
      localStorage.setItem(`vfx_backup_${emailLower}`, JSON.stringify(backupDetails));
    }

    const loggedOutUserObj: User = {
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
    };

    localStorage.setItem('vfx_user_session', JSON.stringify(loggedOutUserObj));
    localStorage.removeItem('vfx_transactions_ledger');
    localStorage.removeItem('vfx_support_tickets_ledger');
    localStorage.removeItem('vfx_copied_allocations');
    localStorage.removeItem('vfx_staking_subs');
    localStorage.removeItem('vfx_custom_bots_ledger');
    localStorage.removeItem('vfx_active_bots_running_state');

    setUser(loggedOutUserObj);
    setTransactions([]);
    setSupportTickets(MOCK_SUPPORT_TICKETS);
    setCopiedTraderAllocations({});
    setActiveStakingSubscriptions([]);
  };

  const handleResetAccount = () => {
    const emailLower = user.email ? user.email.toLowerCase() : "";
    const restoredUser: User = {
      ...user,
      activePositions: [],
      demoPositions: [],
      copyTradingAllocated: 0,
      activeBots: []
    };

    setCopiedTraderAllocations({});
    localStorage.removeItem('vfx_copied_allocations');
    localStorage.removeItem('vfx_active_bots_running_state');

    // Wipe states
    persistState(restoredUser, transactions, supportTickets, {}, []);

    // Clear also local backup so it doesn't restore on reload
    if (emailLower) {
      localStorage.removeItem(`vfx_backup_${emailLower}`);
    }

    setShowResetModal(false);
    addToast("Positions, bots, and copy trading allocations cleaned up successfully!", "SUCCESS");
  };

  // Trade executions logic
  const handleTradeExecute = (posDetails: Omit<Position, 'id' | 'timestamp' | 'pnl' | 'currentPrice'>) => {
    const isDemo = user.accountMode === 'DEMO';
    const currentBalance = isDemo ? (user.demoBalance ?? 10000) : user.walletBalance;

    if (posDetails.margin > currentBalance) {
      addToast(`Insufficient money in card! Available ${isDemo ? 'Demo' : 'Real'} portfolio: $${currentBalance.toLocaleString()}. Required margin: $${posDetails.margin.toLocaleString()}.`, 'ERROR');
      return;
    }

    const newPosition: Position = {
      ...posDetails,
      id: `p-${Date.now()}`,
      currentPrice: posDetails.entryPrice,
      pnl: 0,
      timestamp: new Date().toLocaleTimeString(),
      isDemo,
      accountMode: user.accountMode
    };

    let updatedUser: User;
    if (isDemo) {
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
    addToast(`Successfully executed ${posDetails.type.toUpperCase()} contract on ${posDetails.assetSymbol} with $${posDetails.margin.toLocaleString()} margin collateral!`, 'SUCCESS');
  };

  const handleClosePosition = (id: string, pnl: number) => {
    let updatedUser: User;
    let matchSymbol = 'Asset';

    // Find where the trade is housed! Check both lists to uniquely identify which account opened the trade
    const demoMatch = (user.demoPositions || []).find((p) => p.id === id);
    const realMatch = (user.activePositions || []).find((p) => p.id === id);
    const isDemoTrade = !!demoMatch || (realMatch ? false : user.accountMode === 'DEMO');

    if (isDemoTrade) {
      const match = demoMatch || (user.demoPositions || []).find((p) => p.id === id);
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
      const match = realMatch || user.activePositions.find((p) => p.id === id);
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
      asset: `${isDemoTrade ? '[DEMO] ' : ''}${matchSymbol} (Settlement)`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
    
    if (pnl >= 0) {
      addToast(`Position on ${matchSymbol} closed in profit! Settlement payout of +$${pnl.toFixed(2)} recorded on ledger.`, 'SUCCESS');
    } else {
      addToast(`Position on ${matchSymbol} closed in loss. Writeoff of -$${Math.abs(pnl).toFixed(2)} recorded on ledger.`, 'ERROR');
    }
  };

  const handleModifyUserBalance = (
    margin: number, 
    pnl: number | null, 
    isDemo: boolean, 
    botName: string, 
    assetSymbol: string,
    updatedActiveBots?: any[]
  ) => {
    let updatedUser: User;
    const isAllocation = pnl === null;
    const activeBots = updatedActiveBots !== undefined ? updatedActiveBots : user.activeBots;

    if (isDemo) {
      const currentDemoBalance = user.demoBalance ?? 10000;
      const currentDemoProfits = user.demoProfits ?? 0;
      if (isAllocation) {
        updatedUser = {
          ...user,
          demoBalance: Number((currentDemoBalance - margin).toFixed(2)),
          activeBots
        };
      } else {
        const settlement = margin + pnl;
        updatedUser = {
          ...user,
          demoBalance: Number((currentDemoBalance + settlement).toFixed(2)),
          demoProfits: Number((currentDemoProfits + pnl).toFixed(2)),
          activeBots
        };
      }
    } else {
      const currentWalletBalance = user.walletBalance ?? 0;
      const currentProfits = user.profits ?? 0;
      if (isAllocation) {
        updatedUser = {
          ...user,
          walletBalance: Number((currentWalletBalance - margin).toFixed(2)),
          activeBots
        };
      } else {
        const settlement = margin + pnl;
        updatedUser = {
          ...user,
          walletBalance: Number((currentWalletBalance + settlement).toFixed(2)),
          profits: Number((currentProfits + pnl).toFixed(2)),
          activeBots
        };
      }
    }

    const newTx: Transaction = {
      id: `tx-bot-${Date.now()}`,
      type: isAllocation ? 'COPY_ALLOCATE' : (pnl >= 0 ? 'DEPOSIT' : 'WITHDRAWAL'),
      amount: Math.abs(isAllocation ? margin : pnl),
      asset: `${isDemo ? '[DEMO] ' : ''}${isAllocation ? 'Bot Allocation' : 'Bot Settlement'}: ${botName} on ${assetSymbol}`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
  };

  // Copy trading allocations
  const handleAllocateCopy = (traderId: string, amount: number) => {
    const isDemo = user.accountMode === 'DEMO';
    const currentBalance = isDemo ? (user.demoBalance ?? 10000) : user.walletBalance;

    if (amount > currentBalance) {
      addToast(`Insufficient trading capital! Available portfolio: $${currentBalance.toLocaleString()}. Required allocation: $${amount.toLocaleString()}.`, 'ERROR');
      return;
    }

    const updatedCopiedAllocations = { ...copiedTraderAllocations };
    updatedCopiedAllocations[traderId] = (updatedCopiedAllocations[traderId] || 0) + amount;

    let updatedUser: User;
    if (isDemo) {
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
      asset: `${isDemo ? '[DEMO] ' : ''}Allocation Trade`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, updatedCopiedAllocations, activeStakingSubscriptions);
    addToast(`Successfully allocated $${amount.toLocaleString()} for expert mirror copy-trading!`, 'SUCCESS');
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
    addToast(`Successfully released allocation! Refunded $${refund.toLocaleString()} straight to your main portfolio.`, 'SUCCESS');
  };

  // Staking enrollment
  const handleSubscribeStaking = (planId: string, amount: number) => {
    const matchingPlan = INITIAL_STAKING_PLANS.find((p) => p.id === planId)!;
    const isDemo = user.accountMode === 'DEMO';
    const currentBalance = isDemo ? (user.demoBalance ?? 10000) : user.walletBalance;

    if (amount > currentBalance) {
      addToast(`Insufficient trading capital! Available portfolio: $${currentBalance.toLocaleString()}. Required stake: $${amount.toLocaleString()}.`, 'ERROR');
      return;
    }
    
    const newSubscription = {
      id: `stk-${Date.now()}`,
      planName: matchingPlan.name,
      amount,
      rateLabel: matchingPlan.roiLabel,
      endDays: matchingPlan.periodDays,
      accrued: 0
    };

    let updatedUser: User;
    if (isDemo) {
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
      asset: `${isDemo ? '[DEMO] ' : ''}${matchingPlan.name}`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    const updatedStaking = [...activeStakingSubscriptions, newSubscription];
    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, updatedStaking);
    addToast(`Successfully enrolled stake of $${amount.toLocaleString()} into the ${matchingPlan.name} smart plan!`, 'SUCCESS');
  };

  const handleRedeemStaking = (id: string, amount: number, accrued: number) => {
    const payout = amount + accrued;
    const isDemo = user.accountMode === 'DEMO';
    
    let updatedUser: User;
    if (isDemo) {
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
      asset: `${isDemo ? '[DEMO] ' : ''}Maturity Payout`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    const updatedStaking = activeStakingSubscriptions.filter((s) => s.id !== id);
    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, updatedStaking);
    addToast(`Successfully redeemed maturity staking rewards! Credited total payout of $${payout.toLocaleString()} to portfolio.`, 'SUCCESS');
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

  // Promotion redemption with strict deposit and trade counts checks
  const handleRedeemPromo = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) {
      addToast("Please enter a promotional code to redeem.", "ERROR");
      return;
    }

    if (user.accountMode !== 'REAL') {
      addToast("This promotional coupon is only eligible on the REAL account ledger. Please switch your account mode to REAL in the top selector to continue.", "ERROR");
      return;
    }

    // Double check previously redeemed transactions for duplicate preventions
    const alreadyRedeemed = transactions.some(tx => 
      !tx.asset.includes('[DEMO]') && 
      tx.asset.toLowerCase().includes('redeem: promo')
    );

    if (alreadyRedeemed) {
      addToast("Error: This promotional coupon has already been redeemed on your account.", "ERROR");
      return;
    }

    if (totalEarnestDeposits < 100) {
      addToast(`Eligibility Check Failed: You must deposit at least $100 USD on your Real account. Current deposits: $${totalEarnestDeposits.toLocaleString()}.`, "ERROR");
      return;
    }

    if (completedRealTradesCount <= 100) {
      addToast(`Eligibility Check Failed: You must complete more than 100 trades on your Real account. Current trades: ${completedRealTradesCount} / 100.`, "ERROR");
      return;
    }

    // Meets criteria perfectly. Award the maximum of $50 bonus.
    const bonusAmount = 50;
    const updatedUser: User = {
      ...user,
      walletBalance: Number((user.walletBalance + bonusAmount).toFixed(2)),
      promoCodeUsed: code
    };

    const newTx: Transaction = {
      id: `tx-promo-${Date.now()}`,
      type: 'DEPOSIT',
      amount: bonusAmount,
      asset: `Redeem: Promo Premium Reward (Code: ${code})`,
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);
    setPromoCodeInput('');
    addToast(`Congratulations! Promo code ${code} applied successfully. A premium trading reward of $${bonusAmount.toFixed(2)} has been credited to your real wallet.`, "SUCCESS");
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
                  text: "Hello, we have registered your case and escalated to our premium execution clearing desk. This is usually resolved within 1 business day. Thank you, NetacoinFX Support.",
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
    const isDemo = user.accountMode === 'DEMO';
    const currentBalance = isDemo ? (user.demoBalance ?? 10000) : user.walletBalance;

    if (type === 'WITHDRAWAL' && amount > currentBalance) {
      addToast(`Insufficient money in your portfolio! You requested to withdraw $${amount.toLocaleString()} but available balance is only $${currentBalance.toLocaleString()}.`, 'ERROR');
      return;
    }

    const multiplier = type === 'DEPOSIT' ? 1 : -1;
    let updatedUser: User;
    if (isDemo) {
      updatedUser = {
        ...user,
        phone: details.phone || user.phone || "",
        demoBalance: Number(((user.demoBalance ?? 10000) + amount * multiplier).toFixed(2))
      };
    } else {
      updatedUser = {
        ...user,
        phone: details.phone || user.phone || "",
        walletBalance: Number((user.walletBalance + amount * multiplier).toFixed(2))
      };
    }

    const initialStatus = type === 'DEPOSIT' ? 'SUCCESSFUL' : 'PENDING';

    const newTx: Transaction = {
      id: `tx-fin-${Date.now()}`,
      type,
      amount,
      asset: `${isDemo ? '[DEMO] ' : ''}${details.asset}`,
      address: details.address,
      date: new Date().toISOString(),
      status: initialStatus
    };

    persistState(updatedUser, [newTx, ...transactions], supportTickets, copiedTraderAllocations, activeStakingSubscriptions);

    // If on a Real account configuration, dispatch to backend database to persist transaction log
    if (!isDemo && user.email) {
      fetch(getApiUrl("/api/user/save-transaction"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          type,
          amount,
          asset: details.asset,
          address: details.address,
          status: initialStatus
        })
      }).catch((err) => console.error("Error backing up transaction to database:", err));
    }

    if (type === 'DEPOSIT') {
      addToast(`Deposit of $${amount.toLocaleString()} via ${details.asset} successfully credited to wallet balance!`, 'SUCCESS');
    } else {
      addToast(`Withdrawal of $${amount.toLocaleString()} to ${details.asset} submitted successfully and is now PENDING clearance.`, 'SUCCESS');
    }
  };

  // Filtered lists matching searches
  const filteredAssets = assets
    .filter((a) => assetCategoryFilter === 'ALL' || a.category === assetCategoryFilter)
    .filter((a) => a.symbol.toLowerCase().includes(marketSearchQuery.toLowerCase()) || a.name.toLowerCase().includes(marketSearchQuery.toLowerCase()));

  const getCalculatedPositions = (positions: Position[]) => {
    return positions.map((p) => {
      const liveAsset = assets.find((a) => a.symbol === p.assetSymbol);
      if (!liveAsset) return p;

      const { pnl, currentPrice } = getBiasedPnlAndPrice(p, user.role || 'user', liveAsset.price);
      return {
        ...p,
        currentPrice,
        pnl
      };
    });
  };

  const activeUserContext: User = {
    ...user,
    walletBalance: Number(user.accountMode === 'DEMO' ? (user.demoBalance ?? 10000) : (user.walletBalance ?? 0)),
    demoBalance: Number(user.demoBalance ?? 10000),
    demoProfits: Number(user.demoProfits ?? 0),
    investedCapital: Number(user.investedCapital ?? 0),
    copyTradingAllocated: Number(user.copyTradingAllocated ?? 0),
    profits: Number(user.accountMode === 'DEMO' ? (user.demoProfits ?? 0) : (user.profits ?? 0)),
    activePositions: getCalculatedPositions(user.accountMode === 'DEMO' ? (user.demoPositions ?? []) : (user.activePositions ?? [])),
    demoPositions: user.demoPositions ?? [],
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-gray-300 font-sans flex flex-col relative select-none">
      
      {/* 2. Primary Navigation Bar */}
      <header className="border-b border-gray-950 bg-[#070b13]/90 backdrop-blur sticky top-0 z-45 px-2 sm:px-3.5 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <img 
              src="/favicon.svg" 
              alt="NetacoinFX Logo" 
              className="w-7 h-7 select-none object-contain shadow-[0_0_12px_rgba(16,185,129,0.2)] shrink-0" 
              referrerPolicy="no-referrer"
            />
            <div className="hidden sm:block">
              <h1 className="text-white text-xs font-display font-black tracking-widest leading-none uppercase">
                NETACOIN<span className="text-emerald-400">FX</span>
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
                    className="bg-gray-950 border border-gray-800 hover:bg-gray-900 text-gray-400 hover:text-white px-1.5 sm:px-2 py-0.5 rounded text-[8.5px] sm:text-[9.5px] font-bold transition-all select-none cursor-pointer whitespace-nowrap"
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
              <Lock className="w-3 h-3" /> Sign In
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
            {isAdminUser ? (
              <button
                onClick={() => setActiveTab('ADMIN')}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded transition-all cursor-pointer ${
                  activeTab === 'ADMIN'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'text-gray-550 hover:text-white border border-transparent'
                }`}
                title="Admin Control"
              >
                <ShieldCheck className="w-5 h-5 mb-0.5" />
                <span className="text-[8px] font-bold tracking-tight font-sans text-center">Admin</span>
              </button>
            ) : (
              [
                { id: 'TERMINAL' as const, label: 'Terminal', icon: LineChart },
                { id: 'BOTS' as const, label: 'Bots', icon: Cpu },
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
              })
            )}
          </aside>
        )}

        {/* Scrollable workspace wrapper */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-14 md:pb-0">
          <main className="flex-1 p-3 md:p-4 overflow-y-auto">
            {user.loggedIn ? (
              <div className="space-y-4">
                {isAdminUser ? (
                  <AdminPanel
                    currentUser={activeUserContext}
                    addToast={addToast}
                    onRefreshUserSession={onRefreshUserSession}
                  />
                ) : (
                  <>
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
                    addToast={addToast}
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
                                <p className="text-white uppercase font-bold text-xxs tracking-wider">{getTransactionDisplayLabel(tx)}</p>
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
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value)}
                            placeholder="EX: NETACOIN_ELITE"
                            className="flex-1 bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none placeholder-gray-800 font-bold uppercase text-center"
                          />
                          <button
                            onClick={handleRedeemPromo}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase rounded-lg px-4 text-[10px] transition-all cursor-pointer"
                          >
                            Redeem
                          </button>
                        </div>

                        {/* Interactive Promo Eligibility checklist */}
                        <div className="mt-3.5 space-y-1.5 p-2.5 bg-gray-950/80 border border-gray-800/60 rounded-lg text-[10px]">
                          <div className="flex items-center justify-between text-gray-400 mb-1 border-b border-gray-850 pb-1.5 font-sans">
                            <span className="font-bold uppercase tracking-wider text-gray-500 text-[8.5px]">REDEEM CODE ELIGIBILITY Check</span>
                            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded text-[8.5px]">+$50.00 REWARD MAX</span>
                          </div>
                          
                          <div className="flex items-center justify-between font-sans">
                            <span className="text-gray-400">1. Real Account Mode Active:</span>
                            <span className={`font-bold transition-all ${user.accountMode === 'REAL' ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                              {user.accountMode === 'REAL' ? 'YES ✓' : 'NO ✗ (Switch Mode)'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between font-sans">
                            <span className="text-gray-400">2. Real Account Deposits (Min $100):</span>
                            <span className={`font-bold ${totalEarnestDeposits >= 100 ? 'text-emerald-400' : 'text-rose-450'}`}>
                              ${totalEarnestDeposits.toLocaleString(undefined, { minimumFractionDigits: 2 })} / $100.00 {totalEarnestDeposits >= 100 ? '✓' : '✗'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between font-sans">
                            <span className="text-gray-400">3. Real Completed Trades (⚓ &gt; 100):</span>
                            <span className={`font-bold ${completedRealTradesCount > 100 ? 'text-emerald-400' : 'text-rose-450'}`}>
                              {completedRealTradesCount} / 100 completed {completedRealTradesCount > 100 ? '✓' : '✗'}
                            </span>
                          </div>
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

            {/* SUBPAGE BOTS: QUANTUM ALGORITHMIC BOTS */}
            {activeTab === 'BOTS' && (
              <BotsPanel 
                user={activeUserContext}
                assets={assets}
                addToast={(msg, type) => addToast(msg, type === 'WARNING' ? 'INFO' : type)}
                onModifyUserBalance={handleModifyUserBalance}
              />
            )}

            {/* SUBPAGE 3: EXPERT COPY TRADING */}
            {activeTab === 'COPYTRADING' && (
              <CopyTradingPanel 
                user={activeUserContext} 
                copyTraders={INITIAL_COPY_TRADERS} 
                onAllocateCopy={handleAllocateCopy}
                onReleaseCopy={handleReleaseCopy}
                copiedTradersState={copiedTraderAllocations}
                addToast={addToast}
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
                addToast={addToast}
              />
            )}

            {/* SUBPAGE 5: AI TRADING ADVISOR CORE CHAT */}
            {activeTab === 'AI_ADVISOR' && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="vfx-gradient-card border border-gray-800 rounded-xl p-5 shadow-xl space-y-1 text-center">
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
                addToast={addToast}
              />
            )}
                  </>
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
                  Sign In
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
                  <div key={a.id} className="bg-[#0b0f19]/40 border border-gray-950 hover:border-emerald-500/20 rounded-lg p-3.5 shadow-xl font-mono text-xs flex flex-col justify-between hover:-translate-y-0.5 transition-all duration-300">
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
      {isAdminUser ? (
        <button
          onClick={() => setActiveTab('ADMIN')}
          className="flex flex-col items-center justify-center flex-1 py-0.5 transition-all text-rose-400"
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[8px] font-sans font-bold tracking-tight mt-0.5 text-center">Admin</span>
        </button>
      ) : (
        [
          { id: 'TERMINAL' as const, label: 'Terminal', icon: LineChart },
          { id: 'BOTS' as const, label: 'Bots', icon: Cpu },
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
        })
      )}
    </nav>
  )}

  {/* 4. Professional Footer */}
      <footer className="border-t border-gray-900 bg-[#070b13] py-6 px-6 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-500 tracking-wider font-sans gap-4 shrink-0 mt-auto">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <span className="font-bold text-gray-400">NETACOINFX © 2026 GENERAL CLEARING GROUP INC.</span>
          <span className="text-[9px] text-gray-650 max-w-xl leading-relaxed">
            All rights reserved. Trading financial instruments, including digital assets and derivatives, involves substantial risk.
          </span>
        </div>
        <div className="flex gap-4 text-gray-400 text-[10px] whitespace-nowrap">
          <a href="#terms" className="hover:text-emerald-400 transition-colors">Terms of Service</a>
          <span className="text-gray-800">|</span>
          <a href="#privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a>
          <span className="text-gray-800">|</span>
          <a href="#disclaimer" className="hover:text-emerald-400 transition-colors">Risk Disclosure</a>
        </div>
      </footer>

      {/* MODAL 1: AUTHENTICATION OVERLAY CLIENT PORTAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b0f19] border border-gray-950 rounded-lg max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto p-6 shadow-2xl relative font-sans text-xs text-left scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleAuthSubmit} className="space-y-4.5">
              <div className="text-center space-y-2.5 bg-gradient-to-r from-gray-950 to-gray-900 py-4.5 rounded border border-gray-950 mb-1 select-none flex flex-col items-center justify-center">
                <img 
                  src="/favicon.svg" 
                  alt="NetacoinFX Logo" 
                  className="w-10 h-10 select-none object-contain shadow-[0_0_16px_rgba(16,185,129,0.35)]" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> SECURE TRADING WEBPORTAL
                </span>
                <h3 className="text-white text-base font-display font-black uppercase tracking-widest leading-none">
                  NETACOIN<span className="text-emerald-400">FX</span> <span className="text-gray-400 font-mono font-medium text-[11px] block mt-1 tracking-wider leading-none">Trading Account Access</span>
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
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded py-2 px-3 focus:outline-none focus:border-emerald-500/40 font-semibold text-xs"
                  required
                />
              </div>

              {authMode === 'REGISTER' && (
                <div className="space-y-1.5">
                  <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Phone Number</span>
                  <input
                    type="tel"
                    placeholder="e.g., +254 700 000 000"
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded py-2 px-3 focus:outline-none focus:border-emerald-500/40 font-semibold text-xs"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={authPass}
                    onChange={(e) => setAuthPass(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-white rounded py-2 pl-3 pr-10 focus:outline-none focus:border-emerald-500/40 font-semibold text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authMode === 'REGISTER' && (
                <div className="space-y-1.5">
                  <span className="text-gray-500 text-[8.5px] font-mono uppercase tracking-wider block">Confirm Password</span>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={authConfirmPass}
                      onChange={(e) => setAuthConfirmPass(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded py-2 pl-3 pr-10 focus:outline-none focus:border-emerald-500/40 font-semibold text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

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
          transactions={user.accountMode === 'DEMO' ? transactions.filter(t => t.asset.includes('[DEMO]')) : transactions.filter(t => !t.asset.includes('[DEMO]'))}
          addToast={addToast}
        />
      )}

      {/* MODAL 3: WIPE / RESET ACCOUNT TRADES */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none">
          <div className="bg-[#181A20] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative flex flex-col text-gray-300 animate-slide-in">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-base font-bold mb-2 font-sans flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              Reset Account Trading State?
            </h3>
            <p className="text-xs mb-4 leading-relaxed font-sans text-gray-300">
              This action will instantly terminate all running expert bot trials, close all active/demo margin contract positions, and release any funds allocated for expert mirror copy-trading strategies. Your wallet balance will remain fully secure and unmodified.
            </p>
            <div className="flex gap-3 mt-2 font-sans">
              <button
                onClick={handleResetAccount}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs rounded transition-all cursor-pointer uppercase tracking-wider"
              >
                Yes, Clear All Trades
              </button>
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-gray-950 hover:bg-[#121826] text-gray-300 font-bold text-xs rounded transition-all cursor-pointer border border-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING POPUP TOAST SYSTEM - DESIGNED AT BOTTOM RIGHT */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[90%] md:w-80 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 backdrop-blur-md border rounded-xl p-3.5 shadow-2xl transition-all duration-300 relative overflow-hidden animate-slide-in ${
              theme === 'dark' 
                ? 'bg-[#0b0f19]/95 text-white border-gray-800' 
                : 'bg-white/95 text-gray-900 border-gray-200'
            } ${
              t.type === 'SUCCESS' 
                ? 'border-emerald-500/30' 
                : t.type === 'ERROR' 
                ? 'border-rose-500/30' 
                : 'border-blue-500/30'
            }`}
          >
            {/* Direct color sidebar border */}
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${
              t.type === 'SUCCESS' ? 'bg-emerald-500' : t.type === 'ERROR' ? 'bg-rose-500' : 'bg-blue-500'
            }`} />

            <div className="flex-1 min-w-0 pl-1.5 text-left font-sans">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={`text-[9px] uppercase font-bold tracking-wider font-mono ${
                  t.type === 'SUCCESS' 
                    ? 'text-emerald-500' 
                    : t.type === 'ERROR' 
                    ? 'text-rose-500' 
                    : 'text-blue-500 font-medium'
                }`}>
                  {t.type === 'SUCCESS' ? '✓ SYSTEM CONFIRMED' : t.type === 'ERROR' ? '⚠ ACTION REJECTED' : 'ℹ TRANSACTION INFO'}
                </span>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                  className={`transition-colors pointer-events-auto ${
                    theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-950'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className={`text-xs font-sans font-semibold leading-relaxed ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}>
                {t.message}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
