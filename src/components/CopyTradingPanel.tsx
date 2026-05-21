import React, { useState } from 'react';
import { CopyTrader, User, Transaction } from '../types';
import { Sparkles, Users, Award, ShieldAlert, CheckCircle, TrendingUp, DollarSign, X } from 'lucide-react';

interface CopyTradingPanelProps {
  user: User;
  copyTraders: CopyTrader[];
  onAllocateCopy: (traderId: string, amount: number) => void;
  onReleaseCopy: (traderId: string) => void;
  copiedTradersState: Record<string, number>; // mappings of traderId -> allocatedUsd
}

export default function CopyTradingPanel({ user, copyTraders, onAllocateCopy, onReleaseCopy, copiedTradersState }: CopyTradingPanelProps) {
  const [selectedTrader, setSelectedTrader] = useState<CopyTrader | null>(null);
  const [allocationAmt, setAllocationAmt] = useState('1000');
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);

  const handleOpenAllocate = (trader: CopyTrader) => {
    setSelectedTrader(trader);
    setAllocationSuccess(null);
  };

  const handleExecuteAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrader) return;

    const amount = parseFloat(allocationAmt) || 0;
    if (amount <= 0) return;
    if (amount < 20) {
      alert("Minimum allocation amount is $20.");
      return;
    }
    if (amount > user.walletBalance) {
      alert("Insufficient liquidity in active trading balance.");
      return;
    }

    onAllocateCopy(selectedTrader.id, amount);
    setAllocationSuccess(`Successfully allocated $${amount.toLocaleString()} to ${selectedTrader.name}. Automation started!`);
    setTimeout(() => {
      setSelectedTrader(null);
      setAllocationSuccess(null);
    }, 2000);
  };

  return (
    <div className="space-y-4 text-[11px]">
      {/* Narrative Intro Pitch */}
      <div className="bg-gradient-to-r from-[#121c2c] to-[#0c111c] border border-gray-800 rounded-lg p-3.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono uppercase font-extrabold tracking-wide">
            <Sparkles className="w-3 h-3" /> Elite Copier Program
          </div>
          <h2 className="text-white text-base font-bold font-sans tracking-tight">
            Automate Portfolio Allocation with Institutional Syndicates
          </h2>
          <p className="text-[10px] text-gray-400 max-w-2xl leading-relaxed font-sans">
            Instantly replicate top-performing quant strategies on the VexcoinFX network. Every strategy is delta-neutral monitored, preventing catastrophic drawdown through deep capital protection covenants. No performance fee unless you earn!
          </p>
        </div>

        <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center font-mono space-y-0.5 shrink-0">
          <span className="text-[9px] text-gray-500 uppercase font-bold">ACTIVE COPYING FUNDS</span>
          <p className="text-white text-base font-bold font-mono">
            ${user.copyTradingAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Grid of Copy Traders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {copyTraders.map((trader) => {
          const allocation = copiedTradersState[trader.id] || 0;
          const isCopied = allocation > 0;

          // Sparkline coordinates calc
          const maxPnl = Math.max(...trader.pnlHistory);
          const minPnl = Math.min(...trader.pnlHistory);
          const pnlRange = maxPnl - minPnl;
          const sparkPoints = trader.pnlHistory.map((val, idx) => {
            const x = (idx / (trader.pnlHistory.length - 1)) * 140;
            const y = 35 - ((val - minPnl) / (pnlRange || 1)) * 25; // slightly shorter coordinates bounding box
            return `${x},${y}`;
          }).join(' ');

          return (
            <div
              key={trader.id}
              className={`bg-[#0b0f19] border rounded-lg p-3.5 shadow-xl flex flex-col justify-between transition-all duration-300 hover:border-gray-750 ${
                isCopied ? 'border-emerald-500/40 shadow-emerald-950/5' : 'border-gray-800'
              }`}
            >
              {/* Header Profile Info */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={trader.avatar}
                      alt={trader.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded border border-gray-850 object-cover shrink-0"
                    />
                    <div>
                      <h4 className="text-white text-xs font-bold font-sans">{trader.name}</h4>
                      <p className="text-[8.5px] text-emerald-400 font-mono tracking-wide uppercase font-black">
                        WIN RATE: {trader.winRate}%
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-gray-500 text-[8.5px] uppercase block leading-none">ROI TOTAL</span>
                    <span className="text-emerald-400 text-sm md:text-base font-bold font-mono">+{trader.roi}%</span>
                  </div>
                </div>

                {/* Slogan */}
                <p className="text-[10px] text-gray-400 italic font-sans leading-relaxed mb-3 min-h-[30px]">
                  "{trader.slogan}"
                </p>

                {/* Core metrics metrics */}
                <div className="grid grid-cols-3 bg-[#121826]/40 p-2.5 rounded border border-gray-800/60 font-mono text-[9px] text-gray-500 mb-3 gap-1.5">
                  <div>
                    <span>Risk Level:</span>
                    <p className={`font-bold mt-0.5 ${trader.risk <= 2 ? 'text-emerald-400' : trader.risk === 3 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {trader.risk}/5 ({trader.risk <= 2 ? 'Low' : trader.risk === 3 ? 'Medium' : 'Aggressive'})
                    </p>
                  </div>
                  <div>
                    <span>Followers:</span>
                    <p className="text-white font-bold mt-0.5">{trader.followers.toLocaleString()}</p>
                  </div>
                  <div>
                    <span>Syndicate AUM:</span>
                    <p className="text-white font-bold mt-0.5">${(trader.aum / 1000000).toFixed(1)}M</p>
                  </div>
                </div>
              </div>

              {/* Performance Curve Sparkline bar */}
              <div className="flex items-center justify-between border-t border-gray-850 pt-2.5 mt-auto">
                <div>
                  <span className="text-[8px] font-mono text-gray-500 uppercase block">Performance trend</span>
                  <div className="mt-1">
                    <svg className="w-28 h-8 overflow-visible">
                      <polyline
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="1.5"
                        points={sparkPoints}
                      />
                    </svg>
                  </div>
                </div>

                {/* Action CTA Trigger */}
                <div>
                  {isCopied ? (
                    <div className="flex flex-col items-end gap-1 font-mono">
                      <span className="text-[8.5px] text-emerald-400 font-bold uppercase flex items-center gap-1 select-none">
                        <CheckCircle className="w-2.5 h-2.5" /> copying: ${allocation.toLocaleString()}
                      </span>
                      <button
                        onClick={() => onReleaseCopy(trader.id)}
                        className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-[8.5px] font-bold uppercase tracking-wide rounded border border-rose-500/20 transition-all cursor-pointer"
                      >
                        Release Capital
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenAllocate(trader)}
                      className="px-2.5 py-1 bg-[#121826] hover:bg-emerald-500 hover:text-black border border-gray-800 hover:border-emerald-500/40 text-white text-[9.5px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer"
                    >
                      Copy Strategy
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Allocation Overlay Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedTrader(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {allocationSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto text-xl">
                  <CheckCircle className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-white text-sm font-bold font-sans">Active Copy Verified</h3>
                <p className="text-xs text-gray-400">{allocationSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteAllocate} className="space-y-5">
                <div className="flex gap-3 items-center pb-3 border-b border-gray-800">
                  <img
                    src={selectedTrader.avatar}
                    alt={selectedTrader.name}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="text-white text-xs font-bold uppercase font-sans tracking-wide">Copy capital allocation</h3>
                    <p className="text-xs font-mono text-emerald-400 font-semibold">{selectedTrader.name}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-gray-400">ALLOCATE STAKE SIZE (USD)</span>
                    <span className="text-gray-500">Available: ${Math.floor(user.walletBalance)}</span>
                  </div>
                  
                  <div className="relative bg-gray-950 border border-gray-800 rounded-lg py-2.5 px-3.5 focus-within:border-emerald-500/40">
                    <div className="absolute left-3.5 text-gray-500 font-mono text-xs"><DollarSign className="w-4 h-4 text-gray-600" /></div>
                    <input
                      type="number"
                      value={allocationAmt}
                      onChange={(e) => setAllocationAmt(e.target.value)}
                      className="w-full bg-transparent text-white text-sm font-bold pl-5 focus:outline-none placeholder-gray-600"
                      min="20"
                      required
                    />
                    <span className="absolute right-3.5 text-gray-600 font-mono text-[10px]">USD</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono leading-relaxed font-sans">
                    *The allocated principal is securely held under priority copy-contract locks. Minimum copying allocation requires at least $20.
                  </p>
                </div>

                {/* Performance forecast info */}
                <div className="bg-[#121826]/40 p-3 rounded-lg border border-gray-800/60 font-sans text-[11px] leading-relaxed text-gray-400 space-y-1">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span>Expected ROI Performance:</span>
                    <span className="text-emerald-400 font-bold">~{selectedTrader.roi}% / Yr</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span>Contract Terms:</span>
                    <span className="text-white font-semibold">Cancel anytime with immediate release</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-[#0b0f19] font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  CONFIRM COPY ALLOCATION
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
