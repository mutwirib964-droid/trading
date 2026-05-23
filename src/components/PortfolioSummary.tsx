import React from 'react';
import { User } from '../types';
import { Wallet, Landmark, TrendingUp, ShieldCheck, ArrowUpRight, ArrowDownRight, CreditCard, PieChart } from 'lucide-react';

interface PortfolioSummaryProps {
  user: User;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
}

export default function PortfolioSummary({ user, onOpenDeposit, onOpenWithdraw }: PortfolioSummaryProps) {
  const isDemo = user.accountMode === 'DEMO';
  const totalWealth = isDemo 
    ? (user.demoBalance ?? 10000)
    : user.walletBalance + user.investedCapital + user.copyTradingAllocated;
  const netEarnings = isDemo ? (user.demoProfits ?? 0) : user.profits;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Capital Dashboard Card */}
      <div className="vfx-gradient-card border border-gray-800 rounded-lg p-3.5 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-500" />
        
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-gray-400 text-[10px] font-mono tracking-wider font-bold">AVAILABLE BALANCE</span>
          <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-0.5">
          <h2 className="text-white text-xl md:text-2xl font-bold font-mono tracking-tight">
            ${(isDemo ? (user.demoBalance ?? 10000) : user.walletBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className="flex items-center gap-1 text-[9px] text-gray-500 font-mono uppercase tracking-wider">
            <span>{isDemo ? "PRACTICE MARGIN" : "PREMIUM TRADING"}</span>
            <div className={`w-1 h-1 rounded-full ${isDemo ? "bg-amber-400" : "bg-emerald-500"}`} />
            <span className={isDemo ? "text-amber-400" : "text-emerald-400"}>{isDemo ? "SIMULATED" : "SECURED"}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={onOpenDeposit}
            disabled={isDemo}
            className="flex-1 py-1 text-center text-[10px] uppercase tracking-wide font-extrabold rounded bg-emerald-500 disabled:opacity-30 hover:bg-emerald-400 text-[#0b0f19] cursor-pointer transition-all"
          >
            Deposit Funds
          </button>
          <button
            onClick={onOpenWithdraw}
            disabled={isDemo}
            className="flex-1 py-1 text-center text-[10px] uppercase tracking-wide font-extrabold rounded bg-gray-900 disabled:opacity-30 hover:bg-gray-800 border border-gray-800 text-white cursor-pointer transition-all"
          >
            Withdraw Balance
          </button>
        </div>
      </div>

      {/* Institutional Asset Distribution Card */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-gray-400 text-[10px] font-mono tracking-wider font-bold">ASSET DISTRIBUTION</span>
          <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <PieChart className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-white text-base md:text-lg font-bold font-mono">
              ${totalWealth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-gray-500 text-[8px] font-mono uppercase">TOTAL AUM</span>
          </div>

          <div className="space-y-1 text-[10px] font-mono">
            {/* ProgressBar Row */}
            <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden flex">
              <div 
                style={{ width: `${isDemo ? 100 : (user.walletBalance / (totalWealth || 1)) * 100}%` }} 
                className={isDemo ? "bg-amber-500 h-full" : "bg-emerald-500 h-full"}
                title="Wallet Balance"
              />
              {!isDemo && (
                <>
                  <div 
                    style={{ width: `${(user.copyTradingAllocated / (totalWealth || 1)) * 100}%` }} 
                    className="bg-blue-400 h-full"
                    title="Copy Trading"
                  />
                  <div 
                    style={{ width: `${(user.investedCapital / (totalWealth || 1)) * 100}%` }} 
                    className="bg-amber-400 h-full"
                    title="Invested Yields"
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[8.5px] text-gray-500 mt-1">
              <div className="flex items-center gap-1 truncate col-span-1">
                <div className={`w-1.5 h-1.5 rounded shrink-0 ${isDemo ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span className="truncate">{isDemo ? 'Demo Balance' : `Wallet (${Math.round((user.walletBalance / (totalWealth || 1)) * 100)}%)`}</span>
              </div>
              {!isDemo && (
                <>
                  <div className="flex items-center gap-1 truncate col-span-1">
                    <div className="w-1.5 h-1.5 rounded bg-blue-400 shrink-0" />
                    <span className="truncate">Copy ({Math.round((user.copyTradingAllocated / (totalWealth || 1)) * 100)}%)</span>
                  </div>
                  <div className="flex items-center gap-1 truncate col-span-1">
                    <div className="w-1.5 h-1.5 rounded bg-amber-400 shrink-0" />
                    <span className="truncate">Earn ({Math.round((user.investedCapital / (totalWealth || 1)) * 100)}%)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profit Ledger Card */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-gray-400 text-[10px] font-mono tracking-wider font-bold">ACCUMULATED GAINS</span>
          <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-0.5">
            <h3 className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netEarnings >= 0 ? '+' : ''}${netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h3>
            <p className="text-[9px] font-mono text-gray-500 uppercase">{isDemo ? "PRACTICE PERFORMANCE" : "REALIZED NET PROFIT"}</p>
          </div>

          <div className="flex items-center justify-between bg-gray-900/60 p-2 rounded border border-gray-850 text-[9px] font-mono">
            <div className="flex items-center gap-1 text-gray-400">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>{isDemo ? "Demo simulator:" : "Copy trading yield:"}</span>
            </div>
            <span className="text-emerald-400 font-bold">{isDemo ? "ACTIVE" : "+2.48% (24H)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
