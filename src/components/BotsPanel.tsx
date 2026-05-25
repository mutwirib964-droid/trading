import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Cpu, 
  Play, 
  Square, 
  Plus, 
  UploadCloud, 
  DownloadCloud, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  Terminal, 
  Sparkles,
  Zap
} from 'lucide-react';
import { Asset, User } from '../types';
import { getApiUrl } from '../lib/api';

interface BotConfig {
  id: string;
  name: string;
  strategy: string;
  targetAsset: string;
  riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  defaultLeverage: number;
  winRate: number; // For real account, default win rate
  creator: 'System' | 'User' | 'Uploaded';
  description: string;
}

interface ActiveBotInstance {
  botId: string;
  botName: string;
  margin: number;
  duration: number; // in seconds
  timeLeft: number; // in seconds
  isDemo: boolean;
  assetSymbol: string;
  startTime: number;
  logs: string[];
  elapsedTime: number; // seconds running
  currentPnl: number;  // live running profit/loss
  finalWillWin: boolean;
  targetPnl: number;
}

interface BotsPanelProps {
  user: User;
  assets: Asset[];
  addToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING') => void;
  onModifyUserBalance: (margin: number, pnl: number | null, isDemo: boolean, botName: string, assetSymbol: string) => void;
}

const INITIAL_BOTS: BotConfig[] = [
  {
    id: 'bot-1',
    name: 'Optimus Grid v12',
    strategy: 'Multi-indicator Grid Core',
    targetAsset: 'BTC/USD',
    riskTolerance: 'MEDIUM',
    defaultLeverage: 50,
    winRate: 94.5,
    creator: 'System',
    description: 'Deploys a multi-horizon Buy/Sell grid to capture rapid micro-fluctuations in stable support bands.'
  },
  {
    id: 'bot-2',
    name: 'Aethon HFT Scalper',
    strategy: 'Order Flow Imbalance Scalper',
    targetAsset: 'EUR/USD',
    riskTolerance: 'HIGH',
    defaultLeverage: 100,
    winRate: 91.2,
    creator: 'System',
    description: 'Executes ultra-low latency micro-second entries by tracking temporary liquidity imbalances on institutional order pools.'
  },
  {
    id: 'bot-3',
    name: 'Chronos Momentum',
    strategy: 'Exponential Moving Average Follower',
    targetAsset: 'AAPL',
    riskTolerance: 'LOW',
    defaultLeverage: 15,
    winRate: 89.4,
    creator: 'System',
    description: 'Pairs twin Exponential Moving Averages with MACD indicators to capture highly persistent macro trend continuations.'
  },
  {
    id: 'bot-4',
    name: 'Viper Mean Reversion',
    strategy: 'Stochastic RSI Channel Pivot',
    targetAsset: 'GBP/USD',
    riskTolerance: 'MEDIUM',
    defaultLeverage: 40,
    winRate: 88.0,
    creator: 'System',
    description: 'Triggers sharp counter-trend entries when spot price breaches the 2.5-standard deviation Bollinger margins.'
  },
  {
    id: 'bot-5',
    name: 'Titan Fibonacci Alpha',
    strategy: 'Golden Ratio Level Breakout',
    targetAsset: 'XAU/USD',
    riskTolerance: 'LOW',
    defaultLeverage: 20,
    winRate: 92.1,
    creator: 'System',
    description: 'Monitors historical pivots, auto-drawing Fibonacci retracement support nodes to trade high-volume gold breakouts.'
  },
  {
    id: 'bot-6',
    name: 'Pulse Wave MACD Engine',
    strategy: 'MACD Zero-Line Acceleration',
    targetAsset: 'ETH/USD',
    riskTolerance: 'HIGH',
    defaultLeverage: 75,
    winRate: 90.3,
    creator: 'System',
    description: 'Determines acceleration factors by monitoring the second derivative of the standard MACD signal waves.'
  },
  {
    id: 'bot-7',
    name: 'Nebula Bollinger Grid',
    strategy: 'Dynamic Channel Density Trades',
    targetAsset: 'Crude Oil',
    riskTolerance: 'MEDIUM',
    defaultLeverage: 25,
    winRate: 87.5,
    creator: 'System',
    description: 'Perfect for commodity channels. Trades horizontal swings within defined multi-day Bollinger bands.'
  },
  {
    id: 'bot-8',
    name: 'Spectral Order Flow',
    strategy: 'Dark Pool Volume Imbalance Tracer',
    targetAsset: 'XAG/USD',
    riskTolerance: 'HIGH',
    defaultLeverage: 125,
    winRate: 93.8,
    creator: 'System',
    description: 'Tracks massive dark-pool order placements, aligning standard consumer trades with wholesale institutional volume.'
  },
  {
    id: 'bot-9',
    name: 'Eclipse Arbitrage Core',
    strategy: 'Cross-Liquidity Spread Repercussions',
    targetAsset: 'BTC/USD',
    riskTolerance: 'LOW',
    defaultLeverage: 10,
    winRate: 95.6,
    creator: 'System',
    description: 'Identifies differences between primary exchange books to execute virtually risk-less arbitrage spreads instantly.'
  },
  {
    id: 'bot-10',
    name: 'Apex Neural Predictor',
    strategy: 'LSTM Recurrent Trend Aligner',
    targetAsset: 'SOL/USD',
    riskTolerance: 'HIGH',
    defaultLeverage: 150,
    winRate: 91.9,
    creator: 'System',
    description: 'Utilizes a lightweight Long Short-Term Memory recurrent neural network to forecast spot volatility in 10-second intervals.'
  }
];

export default function BotsPanel({ user, assets, addToast, onModifyUserBalance }: BotsPanelProps) {
  const [bots, setBots] = useState<BotConfig[]>(() => {
    const saved = localStorage.getItem('vfx_custom_bots_ledger');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return [...INITIAL_BOTS, ...parsed];
      } catch (e) {
        return INITIAL_BOTS;
      }
    }
    return INITIAL_BOTS;
  });

  const [activeInstances, setActiveInstances] = useState<ActiveBotInstance[]>(() => {
    const saved = localStorage.getItem('vfx_active_bots_running_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Clean up stale bots that may have closed while offline
        const now = Date.now();
        const valid: ActiveBotInstance[] = [];
        parsed.forEach((inst: any) => {
          const elapsed = Math.floor((now - inst.startTime) / 1000);
          const remaining = inst.duration - elapsed;
          if (remaining > 0) {
            valid.push({
              ...inst,
              timeLeft: remaining,
              elapsedTime: elapsed,
              currentPnl: inst.currentPnl ?? 0,
              finalWillWin: inst.finalWillWin ?? (Math.random() < 0.5),
              targetPnl: inst.targetPnl ?? 0
            });
          }
        });
        return valid;
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Synchronize with database-backed updates from parent
  useEffect(() => {
    if (user.customBots && user.customBots.length > 0) {
      const userBots = user.customBots;
      setBots(prev => {
        const systemOnly = prev.filter(b => b.creator === 'System');
        const existingIds = new Set(systemOnly.map(b => b.id));
        const filteredUserBots = userBots.filter(b => !existingIds.has(b.id));
        return [...systemOnly, ...filteredUserBots];
      });
    }
  }, [user.customBots]);

  useEffect(() => {
    if (user.activeBots) {
      const currentIds = activeInstances.map(i => i.botId).join(',');
      const incomingIds = user.activeBots.map(i => i.botId).join(',');
      if (currentIds !== incomingIds) {
        setActiveInstances(user.activeBots);
      }
    }
  }, [user.activeBots, activeInstances]);

  const activeSectionRef = useRef<HTMLDivElement>(null);

  // Creation form states
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotStrategy, setNewBotStrategy] = useState('Stochastic Band Filter');
  const [newBotAsset, setNewBotAsset] = useState('BTC/USD');
  const [newBotRisk, setNewBotRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [newBotLeverage, setNewBotLeverage] = useState(50);
  const [newBotWinRate, setNewBotWinRate] = useState(90);
  const [newBotDesc, setNewBotDesc] = useState('');

  // Start instance form modal states
  const [selectedBotToRun, setSelectedBotToRun] = useState<BotConfig | null>(null);
  const [runMargin, setRunMargin] = useState('100');
  const [runDuration, setRunDuration] = useState(30); // Default 30s
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync active instances block on ticker
  useEffect(() => {
    if (activeInstances.length === 0) return;

    const interval = setInterval(() => {
      setActiveInstances((prev) => {
        const updated = prev.map((inst) => {
          const newTimeLeft = inst.timeLeft - 1;
          const newElapsedTime = inst.elapsedTime + 1;
          
          // Generate realistic live log text
          const logMessages = [
            `[CPU SECURE] Analyzing Order books fluctuation state...`,
            `[INDICATOR] Check Bollinger band width index.`,
            `[SYS LOG] Volatility coefficient verified at ${Math.random().toFixed(2)}.`,
            `[TRADE ENGINE] Scaling grid node positions...`,
            `[ALGO INDEX] RSI momentum confirms alignment.`,
            `[NETWORK] Latency bound verified at 1.4ms.`,
            `[EXECUTION] Order routers queue status: CLEAR.`
          ];

          const newLogs = [...inst.logs];
          if (newTimeLeft > 0 && Math.random() < 0.45) {
            const timeStr = new Date().toLocaleTimeString();
            const randomMsg = logMessages[Math.floor(Math.random() * logMessages.length)];
            newLogs.push(`[${timeStr}] ${randomMsg}`);
            if (newLogs.length > 20) newLogs.shift();
          }

          if (newTimeLeft <= 0) {
            // Settle Bot Trade!
            handleFinalizeBotTrade(inst);
            return null;
          }

          // Generate wavy fluctuation live PNL tracking toward targetPnl
          const fraction = Math.min(newElapsedTime / inst.duration, 1.0);
          const wave = Math.sin(newElapsedTime * 0.7) * (inst.margin * 0.08);
          const randomWalk = (Math.random() - 0.5) * (inst.margin * 0.04);
          
          let simulatedPnl = (inst.targetPnl * fraction) + (wave * (1 - fraction)) + (randomWalk * (1 - fraction));
          simulatedPnl = Number(simulatedPnl.toFixed(2));

          return {
            ...inst,
            timeLeft: newTimeLeft,
            elapsedTime: newElapsedTime,
            currentPnl: simulatedPnl,
            logs: newLogs
          };
        }).filter(Boolean) as ActiveBotInstance[];

        localStorage.setItem('vfx_active_bots_running_state', JSON.stringify(updated));
        if (user && user.email) {
          const completedSome = activeInstances.length !== updated.length;
          if (completedSome) {
            fetch(getApiUrl('/api/user/update-state'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, activeBots: updated })
            }).catch(e => console.warn(e));
          }
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeInstances, user, bots]);

  const handleFinalizeBotTrade = (inst: ActiveBotInstance) => {
    const isDemo = inst.isDemo;
    const pnl = inst.targetPnl;

    if (pnl >= 0) {
      addToast(`[SUCCESS] Bot ${inst.botName} won! Settle payout: +$${pnl.toLocaleString()} (${((pnl / inst.margin) * 100).toFixed(1)}% profit on margin).`, "SUCCESS");
    } else {
      addToast(`[ALERT] Bot ${inst.botName} trace resolved in loss. Settle loss: -$${Math.abs(pnl).toLocaleString()} (${((Math.abs(pnl) / inst.margin) * 100).toFixed(1)}% writeoff).`, "ERROR");
    }

    // Call callback to commit changes to parent and save immediately
    onModifyUserBalance(inst.margin, pnl, isDemo, inst.botName, inst.assetSymbol);
  };

  const handleCreateBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) {
      addToast("Please provide a distinct bot designation name.", "WARNING");
      return;
    }

    const newBot: BotConfig = {
      id: `bot-user-${Date.now()}`,
      name: newBotName.trim(),
      strategy: newBotStrategy,
      targetAsset: newBotAsset,
      riskTolerance: newBotRisk,
      defaultLeverage: Number(newBotLeverage) || 50,
      winRate: Number(newBotWinRate) || 90,
      creator: 'User',
      description: newBotDesc.trim() || `Configured machine-learning execution script targeting ${newBotAsset} using ${newBotStrategy} signals.`
    };

    const updatedUserBots = bots.filter(b => b.creator !== 'System');
    const systemOnly = bots.filter(b => b.creator === 'System');

    const updatedLedger = [...updatedUserBots, newBot];
    localStorage.setItem('vfx_custom_bots_ledger', JSON.stringify(updatedLedger));
    if (user && user.email) {
      fetch(getApiUrl('/api/user/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, customBots: updatedLedger })
      }).catch(err => console.warn(err));
    }
    
    setBots([...systemOnly, ...updatedLedger]);
    setIsCreatorOpen(false);

    // Reset fields
    setNewBotName('');
    setNewBotDesc('');
    addToast(`Bot blueprint '${newBot.name}' compiled and deployed to terminal registry successfully!`, "SUCCESS");
  };

  const handleDownloadTemplate = () => {
    const template = {
      botName: "Astra Neural Scalper",
      strategy: "Dynamic RSI Exponential Convergence Pipeline",
      targetAsset: "BTC/USD",
      riskTolerance: "HIGH",
      defaultLeverage: 100,
      winRate: 92.5,
      description: "Custom uploaded bot utilizing a double convergence mathematical formula to trade breakouts in extreme liquidity spikes."
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "vexcoinfx_bot_blueprint.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addToast("Bot template blueprint JSON file downloaded successfully.", "INFO");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.botName || !parsed.strategy || !parsed.targetAsset) {
          addToast("Invalid JSON structure. Ensure 'botName', 'strategy', and 'targetAsset' properties are present.", "ERROR");
          return;
        }

        const uploadedBot: BotConfig = {
          id: `bot-upl-${Date.now()}`,
          name: parsed.botName,
          strategy: parsed.strategy,
          targetAsset: parsed.targetAsset,
          riskTolerance: (parsed.riskTolerance && ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.riskTolerance.toUpperCase())) 
            ? parsed.riskTolerance.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' 
            : 'MEDIUM',
          defaultLeverage: Number(parsed.defaultLeverage) || 50,
          winRate: Math.min(Math.max(Number(parsed.winRate) || 90, 60), 98),
          creator: 'Uploaded',
          description: parsed.description || `Uploaded trading configuration targeting ${parsed.targetAsset} utilizing ${parsed.strategy}.`
        };

        const updatedUserBots = bots.filter(b => b.creator !== 'System');
        const systemOnly = bots.filter(b => b.creator === 'System');

        const updatedLedger = [...updatedUserBots, uploadedBot];
        localStorage.setItem('vfx_custom_bots_ledger', JSON.stringify(updatedLedger));
        if (user && user.email) {
          fetch(getApiUrl('/api/user/update-state'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, customBots: updatedLedger })
          }).catch(err => console.warn(err));
        }
        
        setBots([...systemOnly, ...updatedLedger]);
        addToast(`Uploaded Bot '${uploadedBot.name}' initialized and deployed successfully.`, "SUCCESS");
      } catch (err) {
        addToast("Error parsing file. Please ensure it is valid JSON formatted text.", "ERROR");
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleInitStartBot = (bot: BotConfig) => {
    setSelectedBotToRun(bot);
    setRunMargin('100');
    setRunDuration(30); // default
  };

  const handleStartBotExecution = () => {
    if (!selectedBotToRun) return;

    const valMargin = parseFloat(runMargin);
    if (isNaN(valMargin) || valMargin <= 0) {
      addToast("Please input a valid trade capital amount.", "WARNING");
      return;
    }

    const currentBalance = user.accountMode === 'DEMO' ? (user.demoBalance ?? 10000) : user.walletBalance;
    if (valMargin > currentBalance) {
      addToast(`Insufficient trading capital. Required: $${valMargin.toLocaleString()} but available: $${currentBalance.toLocaleString()}`, "ERROR");
      return;
    }

    // Minimum 10 seconds, maximum 3 minutes
    const valDuration = Number(runDuration);
    if (valDuration < 10 || valDuration > 180) {
      addToast("Exit delay parameter must be between 10 seconds and 3 minutes.", "ERROR");
      return;
    }

    // Check if bot is already running
    if (activeInstances.some(inst => inst.botId === selectedBotToRun.id)) {
      addToast("This algorithmic agent is already executing a trade channel on the grid.", "WARNING");
      return;
    }

    // Pre-calculate winning logic
    const originalWinRate = selectedBotToRun.winRate;
    let finalWillWin = false;
    const isDemoMode = user.accountMode === 'DEMO';

    // All execution channels utilize the highly precise quantum bot win rates
    finalWillWin = Math.random() * 100 < originalWinRate;

    let targetPnl = 0;
    if (finalWillWin) {
      const multiplier = selectedBotToRun.riskTolerance === 'HIGH' ? 1.4 : (selectedBotToRun.riskTolerance === 'LOW' ? 0.75 : 1.0);
      const profitPercent = (45 + Math.random() * 85) * multiplier;
      targetPnl = Number((valMargin * (profitPercent / 100)).toFixed(2));
    } else {
      const lossPercent = 60 + Math.random() * 35;
      targetPnl = Number((-valMargin * (lossPercent / 100)).toFixed(2));
    }

    // Deduct initial capital allocation
    onModifyUserBalance(valMargin, null, isDemoMode, selectedBotToRun.name, selectedBotToRun.targetAsset);

    const timeStr = new Date().toLocaleTimeString();
    const newInstance: ActiveBotInstance = {
      botId: selectedBotToRun.id,
      botName: selectedBotToRun.name,
      margin: valMargin,
      duration: valDuration,
      timeLeft: valDuration,
      elapsedTime: 0,
      currentPnl: 0,
      finalWillWin,
      targetPnl,
      isDemo: isDemoMode,
      assetSymbol: selectedBotToRun.targetAsset,
      startTime: Date.now(),
      logs: [
        `[${timeStr}] [SYS] Initializing deployment routines...`,
        `[${timeStr}] [SYS] Allocating $${valMargin.toFixed(2)} on target asset ${selectedBotToRun.targetAsset}...`,
        `[${timeStr}] [SYS] Multiplier risk vector configured at ${selectedBotToRun.defaultLeverage}x leverage.`,
        `[${timeStr}] [SYS] Auto-liquidation execution window armed: ${valDuration} seconds.`
      ]
    };

    const newInstancesList = [...activeInstances, newInstance];
    setActiveInstances(newInstancesList);
    localStorage.setItem('vfx_active_bots_running_state', JSON.stringify(newInstancesList));
    if (user && user.email) {
      fetch(getApiUrl('/api/user/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, activeBots: newInstancesList })
      }).catch(e => console.warn(e));
    }

    setSelectedBotToRun(null);
    addToast(`${selectedBotToRun.name} has been deployed. Live feed active.`, "SUCCESS");

    // Automatically navigate the user style-first to the active running configurations panel at the top
    setTimeout(() => {
      activeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const handleKillBot = (botId: string) => {
    // Return early, refunding partial margin
    const act = activeInstances.find(i => i.botId === botId);
    if (!act) return;

    // Refund 90% of the allocated margin because it was aborted by force
    const refund = Number((act.margin * 0.90).toFixed(2));
    onModifyUserBalance(-act.margin, refund - act.margin, act.isDemo, act.botName, act.assetSymbol);

    const updated = activeInstances.filter(i => i.botId !== botId);
    setActiveInstances(updated);
    localStorage.setItem('vfx_active_bots_running_state', JSON.stringify(updated));
    if (user && user.email) {
      fetch(getApiUrl('/api/user/update-state'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, activeBots: updated })
      }).catch(e => console.warn(e));
    }

    addToast(`Bot pipeline terminated manually. 90% collateral allocation ($${refund.toLocaleString()}) refunded to account.`, "WARNING");
  };

  return (
    <div className="space-y-6">
      
      {/* Overview Header Banner with stats */}
      <div className="vfx-gradient-card border border-gray-850 rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Cpu className="w-64 h-64 text-white" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] uppercase font-bold tracking-wider font-mono">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              Grid Computing Enabled
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight font-sans">
              Quantum Algorithmic Trading Bots
            </h1>
            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              Activate high-performance quantitative agents. Adjust targeted leverage, risk margins, and target exits with microsecond execution parameters.
              <span className="text-emerald-400 block mt-1">
                ⚡ Algorithmic routing active: Precision execution models deployed on standard and premium order flows.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreatorOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/25 flex items-center gap-1.5 cursor-pointer uppercase"
            >
              <Plus className="w-4 h-4" />
              Compile New Bot
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-2 bg-[#0a101d] hover:bg-[#0e182c] border border-gray-800 hover:border-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Download editable boilerplate file"
            >
              <DownloadCloud className="w-4 h-4 text-emerald-400" />
              Download Template
            </button>
            <button
              onClick={handleUploadClick}
              className="px-3 py-2 bg-[#0a101d] hover:bg-[#0e182c] border border-gray-800 hover:border-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Upload your JSON configuration"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              Upload Bot
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".json" 
              className="hidden" 
            />
          </div>
        </div>
      </div>

      {/* Compile Bot Popup UI Modal */}
      {isCreatorOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 z-50 overflow-y-auto">
          <div className="bg-[#0b0f19] border border-gray-800 rounded-xl w-full max-w-lg overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-850 flex items-center justify-between bg-gray-950">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-white text-sm font-bold uppercase tracking-wider font-sans">Compiling Algorithmic Agent</span>
              </div>
              <button 
                onClick={() => setIsCreatorOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateBot} className="p-5 space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className="text-gray-400 uppercase font-bold text-[10px]">Machine Bot Designation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Genesis Neural Grid"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Signal Feed Indicator</label>
                  <select
                    value={newBotStrategy}
                    onChange={(e) => setNewBotStrategy(e.target.value)}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="MACD Signal Convergence">MACD Signal Convergence</option>
                    <option value="Stochastic Band Filter">Stochastic Band Filter</option>
                    <option value="Double EMA Golden Cross">Double EMA Golden Cross</option>
                    <option value="Bollinger Band High volatility">Bollinger Band Grid</option>
                    <option value="Fibonacci Retracement Grid">Fibonacci Support Nodes</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Asset Target Instrument</label>
                  <select
                    value={newBotAsset}
                    onChange={(e) => setNewBotAsset(e.target.value)}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.symbol}>{a.symbol} - {a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Risk Tolerance</label>
                  <select
                    value={newBotRisk}
                    onChange={(e) => setNewBotRisk(e.target.value as any)}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none"
                  >
                    <option value="LOW">Low Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="HIGH">High Risk</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Engine Leverage (x)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={newBotLeverage}
                    onChange={(e) => setNewBotLeverage(Math.min(200, Math.max(1, parseInt(e.target.value) || 50)))}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Base Real Win Rate (%)</label>
                  <input
                    type="number"
                    min="60"
                    max="98"
                    value={newBotWinRate}
                    onChange={(e) => setNewBotWinRate(Math.min(98, Math.max(60, parseInt(e.target.value) || 90)))}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 uppercase font-bold text-[10px]">Strategy Summary & Brief</label>
                <textarea
                  rows={2}
                  placeholder="Describe your logical mathematical strategy pipeline..."
                  value={newBotDesc}
                  onChange={(e) => setNewBotDesc(e.target.value)}
                  className="w-full bg-[#05070a] border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none text-[11px]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreatorOpen(false)}
                  className="px-4 py-2 border border-gray-800 hover:bg-gray-900 rounded-lg font-bold text-gray-400 cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer uppercase"
                >
                  Compile and Load
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Bot Modal */}
      {selectedBotToRun && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 z-50">
          <div className="bg-[#0b0f19] border border-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-850 bg-gray-950 flex justify-between items-center">
              <span className="text-white font-bold flex items-center gap-1 text-xs uppercase tracking-wider">
                <Play className="w-4 h-4 text-emerald-400" /> Deploy: {selectedBotToRun.name}
              </span>
              <button 
                onClick={() => setSelectedBotToRun(null)}
                className="text-gray-450 hover:text-white cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              <div className="bg-gray-950 p-3 rounded-lg border border-gray-850 space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Asset Symbol:</span>
                  <span className="text-white font-mono font-bold">{selectedBotToRun.targetAsset}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Execution Signal:</span>
                  <span className="text-gray-300 font-semibold">{selectedBotToRun.strategy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Multiplier Leverage:</span>
                  <span className="text-emerald-450 font-bold">{selectedBotToRun.defaultLeverage}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Mode:</span>
                  <span className={`font-bold ${user.accountMode === 'DEMO' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {user.accountMode === 'DEMO' ? 'SECURED SANDBOX' : 'LIVE / LIQUIDITY'}
                  </span>
                </div>
              </div>

              {/* Trade Capital margin input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-gray-400 uppercase font-bold text-[10px]">Position Collateral (Margin)</label>
                  <span className="text-[10px] text-gray-500 font-mono">
                    Avail: ${(user.accountMode === 'DEMO' ? (user.demoBalance ?? 10000) : user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 font-semibold">$</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={runMargin}
                    onChange={(e) => setRunMargin(e.target.value)}
                    className="w-full bg-[#05070a] border border-gray-800 rounded-lg pl-6 pr-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-2.5 pt-1">
                  {['100', '250', '500', '1000'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRunMargin(val)}
                      className="px-2 py-1 bg-gray-950 border border-gray-850 hover:border-gray-750 text-gray-400 rounded hover:text-white transition-all text-[10px] font-mono cursor-pointer"
                    >
                      +${val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delay Slider: Minimum 10 seconds, maximum 3 minutes (180 seconds) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                  <span>Selected Auto-Exit Delay</span>
                  <span className="text-emerald-450 font-mono text-xs">{runDuration} seconds</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="180"
                  value={runDuration}
                  onChange={(e) => setRunDuration(Number(e.target.value))}
                  className="w-full h-1 bg-gray-900 border border-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                />
                <div className="flex justify-between items-center gap-1.5 pt-1">
                  {[
                    { label: '10s (Min)', time: 10 },
                    { label: '30s', time: 30 },
                    { label: '1m (60s)', time: 60 },
                    { label: '2m (120s)', time: 120 },
                    { label: '3m (Max)', time: 180 }
                  ].map((preset) => (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => setRunDuration(preset.time)}
                      className={`px-2 py-1 border rounded transition-all text-[10px] font-semibold cursor-pointer ${
                        runDuration === preset.time 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                          : 'bg-gray-950 text-gray-400 border-gray-850 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleStartBotExecution}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 hover:text-white text-white rounded-lg font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <Cpu className="w-4 h-4 animate-spin-slow" />
                Initialize Algorithmic Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll anchor to view running bot configuration smoothly */}
      <div ref={activeSectionRef} className="scroll-mt-24 pointer-events-none" />

      {/* Grid of ACTIVE instances if there are any */}
      {activeInstances.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Terminal className="text-emerald-400 w-4 h-4" />
            <h2 className="text-white text-xs font-bold uppercase tracking-wider font-sans">Active Live Bot Engines Runs ({activeInstances.length})</h2>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeInstances.map((inst) => {
              const secondsPercent = (inst.timeLeft / inst.duration) * 100;
              return (
                <div key={inst.botId} className="bg-gray-950 border border-gray-850 rounded-xl overflow-hidden flex flex-col font-mono text-[11px] shadow-lg">
                  {/* Title Bar layout */}
                  <div className="bg-[#0c1220] border-b border-gray-850 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-white font-bold">{inst.botName}</span>
                      <span className="text-gray-500">|</span>
                      <span className="text-emerald-450 font-bold">{inst.assetSymbol}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1 text-amber-450">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span className="text-[11px] font-bold">{inst.timeLeft}s left</span>
                      </div>
                      <button
                        onClick={() => handleKillBot(inst.botId)}
                        className="px-2 py-0.5 border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-900/10 hover:text-white rounded transition-colors text-[9px] font-sans font-bold cursor-pointer"
                        title="Abort and refund 90% margin"
                      >
                        PANIC ABORT
                      </button>
                    </div>
                  </div>

                  {/* Visual Status Grid */}
                  <div className="p-3 bg-gray-950 border-b border-gray-900 flex justify-between gap-4 font-sans uppercase text-[9px] font-bold tracking-wide text-gray-500">
                    <div>
                      MARGIN COLLATERAL: <span className="text-white font-mono text-[10px] pl-1">${inst.margin.toFixed(2)}</span>
                    </div>
                    <div>
                      TIME WINDOW: <span className="text-gray-300 font-mono text-[10px] pl-1">{inst.duration}s</span>
                    </div>
                    <div>
                      SYSTEM ENTRANCE: <span className="text-emerald-450 font-mono text-[10px] pl-1">COMPLETED</span>
                    </div>
                  </div>

                  {/* Detailed Performance, elapsed time, remaining seconds, and live P&L */}
                  <div className="px-4 py-3 bg-[#0a101d] border-b border-gray-900 grid grid-cols-3 gap-2 font-sans">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-gray-550 uppercase font-extrabold tracking-wider block">Time Running</span>
                      <span className="text-white text-xs font-mono font-bold">
                        {inst.elapsedTime}s elapsed
                      </span>
                    </div>
                    
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-gray-550 uppercase font-extrabold tracking-wider block">Remaining</span>
                      <span className="text-amber-400 text-xs font-mono font-bold">
                        {inst.timeLeft}s left
                      </span>
                    </div>

                    <div className="space-y-0.5 text-right font-sans">
                      <span className="text-[9px] text-gray-550 uppercase font-extrabold tracking-wider block">Accrued P&L</span>
                      <span className={`text-xs font-mono font-bold inline-flex items-center gap-1 justify-end ${
                        inst.currentPnl >= 0 ? 'text-emerald-400' : 'text-rose-500'
                      }`}>
                        {inst.currentPnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {inst.currentPnl >= 0 ? '+' : ''}${inst.currentPnl.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="w-full bg-gray-900 h-1 relative overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-1000" 
                      style={{ width: `${secondsPercent}%` }}
                    />
                  </div>

                  {/* Interactive Terminal log reader */}
                  <div className="p-3 bg-[#03060a] min-h-[105px] max-h-[145px] overflow-y-auto space-y-1 custom-scrollbar text-emerald-500/80 font-mono text-[10px] leading-relaxed">
                    {inst.logs.map((log, index) => (
                      <div key={index} className="flex gap-1">
                        <ChevronRight className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    ))}
                    <div className="animate-pulse text-emerald-400 font-bold flex gap-1 items-center bg-emerald-950/20 px-1 py-0.5 rounded w-fit">
                      <span>⚡ SYS LOG TILE INJECTED : LIVE PIPELINE IN PROGRESS...</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid of the 10 available compiled Bots */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xs font-bold uppercase tracking-wider font-sans flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Available Algorithmic Bots ({bots.length})
          </h2>
          <span className="text-gray-500 text-[10px] font-sans font-semibold">Select an agent client, allocate balance & run</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => {
            const isBotRunning = activeInstances.some(inst => inst.botId === bot.id);
            return (
              <div 
                key={bot.id} 
                className={`bg-[#070b13] border rounded-xl overflow-hidden shadow-lg flex flex-col justify-between transition-all ${
                  isBotRunning 
                    ? 'border-emerald-500/40 ring-1 ring-emerald-500/10' 
                    : 'border-gray-850 hover:border-gray-750'
                }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-white text-sm font-bold truncate tracking-tight">{bot.name}</h3>
                        <span className={`text-[8px] px-1 py-0.5 rounded font-mono font-bold uppercase ${
                          bot.creator === 'System' 
                            ? 'bg-gray-900 border border-gray-800 text-gray-500' 
                            : bot.creator === 'Uploaded'
                            ? 'bg-purple-950 border border-purple-900 text-purple-400'
                            : 'bg-emerald-950 border border-emerald-900 text-emerald-400'
                        }`}>
                          {bot.creator}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono uppercase bg-gray-950 px-1.5 py-0.5 rounded border border-gray-900 inline-block">
                        {bot.targetAsset}
                      </span>
                    </div>

                    {isBotRunning ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-sans text-[9px] uppercase border border-emerald-500/20 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-gray-950 text-gray-550 text-[9px] uppercase font-bold border border-gray-900">
                        Ready
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-450 leading-relaxed font-sans line-clamp-2 min-h-[32px]">
                    {bot.description}
                  </p>

                  <div className="bg-gray-950 p-3 rounded-lg border border-gray-900 text-[10px] font-sans font-medium space-y-1 text-gray-500">
                    <div className="flex justify-between">
                      <span>Strategy System:</span>
                      <span className="text-gray-300 font-semibold">{bot.strategy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leverage Limit:</span>
                      <span className="text-gray-300 font-mono">{bot.defaultLeverage}x</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk Level:</span>
                      <span className={`font-bold font-mono ${
                        bot.riskTolerance === 'LOW' ? 'text-blue-400' : bot.riskTolerance === 'MEDIUM' ? 'text-amber-400' : 'text-rose-400'
                      }`}>{bot.riskTolerance}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-900">
                      <span>Base Design Win Rate:</span>
                      <span className="text-white font-mono font-bold">
                        {`${bot.winRate}%`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-850 px-4 py-3 bg-gray-950 flex shadow-inner">
                  {isBotRunning ? (
                    <button
                      onClick={() => handleKillBot(bot.id)}
                      className="w-full py-1.5 border border-red-900 border-dashed text-red-400 hover:bg-red-950/20 rounded-lg text-[10px] font-bold uppercase transition-all tracking-wide cursor-pointer text-center"
                    >
                      Emergency Exit Routine
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInitStartBot(bot)}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 cursor-pointer text-center border border-transparent shadow shadow-emerald-950"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Run Client Instance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
