import React, { useState } from 'react';
import { StakingPlan, User } from '../types';
import { Award, Briefcase, Calculator, Calendar, CheckCircle, Flame, Percent, RefreshCw, Layers } from 'lucide-react';

interface InvestmentsPanelProps {
  user: User;
  stakingPlans: StakingPlan[];
  onSubscribeStaking: (planId: string, amount: number) => void;
  activeStakes: { id: string; planName: string; amount: number; rateLabel: string; endDays: number; accrued: number }[];
  onRedeemStaking: (id: string, amount: number, accrued: number) => void;
}

export default function InvestmentsPanel({ user, stakingPlans, onSubscribeStaking, activeStakes, onRedeemStaking }: InvestmentsPanelProps) {
  // Calculator values state
  const [calcAmt, setCalcAmt] = useState('5000');
  const [selectedPlanId, setSelectedPlanId] = useState(stakingPlans[1].id); // default to Gold 90d
  const [subscribingPlan, setSubscribingPlan] = useState<StakingPlan | null>(null);
  const [subAmt, setSubAmt] = useState('1000');
  const [subSuccess, setSubSuccess] = useState<string | null>(null);

  // Compute calculated metrics
  const activePlan = stakingPlans.find(p => p.id === selectedPlanId) || stakingPlans[0];
  const principal = parseFloat(calcAmt) || 0;
  const apyRate = activePlan.id === 's1' ? 0.12 : activePlan.id === 's2' ? 0.28 : 0.45;
  const returnDaysFraction = activePlan.periodDays / 365;
  const projectedInterest = principal * apyRate * returnDaysFraction;
  const totalReturn = principal + projectedInterest;

  const handleOpenSubscribe = (plan: StakingPlan) => {
    setSubscribingPlan(plan);
    setSubAmt(plan.minDeposit.toString());
    setSubSuccess(null);
  };

  const handleExecuteSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscribingPlan) return;

    const amount = parseFloat(subAmt) || 0;
    if (amount < subscribingPlan.minDeposit) {
      alert(`Minimum deposit requirement for this premium contract is $${subscribingPlan.minDeposit}.`);
      return;
    }
    if (amount > user.walletBalance) {
      alert("Insufficient available liquid funds to complete this subscription.");
      return;
    }

    onSubscribeStaking(subscribingPlan.id, amount);
    setSubSuccess(`Successfully enrolled into ${subscribingPlan.name}! Accumulation starts immediately.`);
    setTimeout(() => {
      setSubscribingPlan(null);
      setSubSuccess(null);
    }, 2000);
  };

  return (
    <div className="space-y-4 text-[11px]">
      {/* Narrative Section Header */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-mono uppercase font-bold tracking-wide">
            <Flame className="w-3 h-3" /> GUARANTEED APY EARN
          </div>
          <h2 className="text-white text-base font-bold font-sans tracking-tight">Structured Yield Programs & Margin Staking</h2>
          <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
            Commit liquidity directly to VexcoinFX institutional swap-clearing pipelines. Staking returns are fully backed by exchange reserves and automatic reserve pools, generating yield every single minute with complete capital immunity guarantees.
          </p>
        </div>

        {/* Investment capital info indicator */}
        <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-center font-mono space-y-0.5 shrink-0 w-full md:w-auto">
          <span className="text-[9px] text-gray-500 uppercase font-bold">ACTIVE INVESTED CAPITAL</span>
          <p className="text-white text-base font-bold font-mono">
            ${user.investedCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Main Column layout: Plans Grid on left, Live Calculator on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        
        {/* Left column plans lists */}
        <div className="lg:col-span-2 space-y-3">
          <span className="text-white text-[10px] font-bold uppercase tracking-wide font-sans block">PROPOSED YIELD VEHICLES</span>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stakingPlans.map((plan) => (
              <div 
                key={plan.id}
                className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300"
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-500 text-[8px] font-mono uppercase">TIER CONTROLLER</span>
                    {plan.badge && (
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1 py-0.5 rounded text-[8.5px] uppercase font-bold font-mono">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  
                  <h4 className="text-white text-xs font-bold uppercase font-sans tracking-tight">{plan.name}</h4>
                  
                  <div className="py-1">
                    <span className="text-amber-500 text-[18px] font-bold font-mono leading-none">{plan.roiLabel}</span>
                  </div>

                  <p className="text-[10px] text-gray-400 font-sans leading-relaxed min-h-[36px]">
                    {plan.description}
                  </p>
                </div>

                <div className="border-t border-gray-805 pt-2.5 mt-3 space-y-2 font-mono text-[8.5px] text-gray-500">
                  <div className="flex justify-between">
                    <span>MINIMUM LOCKIN:</span>
                    <span className="text-white font-semibold">${plan.minDeposit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TERM TIMEFRAME:</span>
                    <span className="text-white font-semibold">{plan.periodDays} days lock</span>
                  </div>
                  
                  <button
                    onClick={() => handleOpenSubscribe(plan)}
                    className="w-full py-1.5 bg-[#121826] hover:bg-amber-500 hover:text-black border border-gray-800 hover:border-amber-500/40 text-[#ffffff] text-[9.5px] font-bold uppercase tracking-wide rounded transition-all duration-200 cursor-pointer"
                  >
                    Enroll Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column Interactive Interest Calculator */}
        <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-1 border-b border-gray-800 pb-1.5">
              <Calculator className="w-4 h-4 text-amber-500" />
              <h3 className="text-white text-[11px] font-bold uppercase tracking-wide">YIELD FORECAST TOOL</h3>
            </div>

            {/* Inputs */}
            <div className="space-y-2.5 font-mono text-[10.5px] font-semibold">
              <div className="space-y-1">
                <span className="text-gray-500 text-[8.5px] uppercase">CHOOSE REVENUE ACCOUNT</span>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded py-1.5 px-2 text-[10px] focus:outline-none focus:border-amber-500/30"
                >
                  {stakingPlans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name.toUpperCase()} ({p.roiLabel})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[8.5px] uppercase text-gray-500">
                  <span>PRINCIPAL AMOUNT (USD)</span>
                  <span>Min: ${activePlan.minDeposit}</span>
                </div>
                <div className="relative bg-gray-950 border border-gray-800 rounded py-1.5 px-2.5 focus-within:border-amber-500/30 flex items-center">
                  <input
                    type="number"
                    value={calcAmt}
                    onChange={(e) => setCalcAmt(e.target.value)}
                    className="w-full bg-transparent text-white focus:outline-none text-[10.5px] font-bold"
                    min={activePlan.minDeposit}
                  />
                  <span className="text-gray-600 pl-1.5 select-none font-bold text-[9px]">USD</span>
                </div>
              </div>
            </div>

            {/* Calculator output cards */}
            <div className="bg-gray-950 p-2.5 rounded border border-gray-850 space-y-2 font-mono text-[9.5px] text-gray-400">
              <div className="flex justify-between items-center border-b border-gray-805 pb-1.5">
                <span>APY Interest Multiplier:</span>
                <span className="text-amber-500 font-bold">{(apyRate * 100).toFixed(0)}% APY</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Duration Period:</span>
                <span className="text-white font-semibold">{activePlan.periodDays} Days</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Projected Interest:</span>
                <span className="text-emerald-400 font-bold font-mono">+${projectedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-805 pt-1.5 text-[10.5px] font-bold text-white">
                <span>Total Maturity Payout:</span>
                <span className="font-mono">${totalReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <p className="text-[8.5px] text-gray-500 font-mono leading-relaxed mt-3">
            *Yield projections represent compound contracts calculated over specific terms. Yield contracts are subject to localized exchange clearing schedules.
          </p>
        </div>
      </div>

      {/* Active Subscriptions list table */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-1.5">
          <span className="text-white text-[11px] font-bold font-sans uppercase flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-amber-500" />
            ACTIVE STAKING CONTRACTS ({activeStakes.length})
          </span>
          <span className="text-[9px] font-mono text-gray-500 uppercase font-black">YIELD ACCRUAL IN PROGRESS</span>
        </div>

        {activeStakes.length === 0 ? (
          <div className="border border-dashed border-gray-800 rounded p-6 text-center text-[10px] text-gray-500 font-mono">
            No active yield accounts initialized. Subscribe to a premium index above to lock capital parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10.5px] font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase pb-1.5 text-[9px]">
                  <th className="py-2">Staking Plan Name</th>
                  <th>Contract Size</th>
                  <th>APY Yield Rating</th>
                  <th>Remaining Lock</th>
                  <th>Accruing Profits (24H)</th>
                  <th className="text-right font-sans">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeStakes.map((stk) => (
                  <tr key={stk.id} className="border-b border-gray-850 hover:bg-gray-900/10">
                    <td className="py-2.5 font-sans font-bold text-white uppercase">{stk.planName}</td>
                    <td className="text-white font-semibold">${stk.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-amber-500 font-bold">{stk.rateLabel}</td>
                    <td className="text-gray-400">
                      <span className="flex items-center gap-1 text-gray-400 text-[9.5px]">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {stk.endDays} Days Left
                      </span>
                    </td>
                    <td className="text-emerald-400 font-bold font-mono">+${stk.accrued.toFixed(2)}</td>
                    <td className="text-right">
                      <button
                        onClick={() => onRedeemStaking(stk.id, stk.amount, stk.accrued)}
                        className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-[#0b0f19] text-[8.5px] font-bold uppercase tracking-wider rounded border border-amber-500/20 transition-all cursor-pointer"
                      >
                        REDEEM CONTRACT
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Overlay Modal */}
      {subscribingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-[#0b0f19] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSubscribingPlan(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-all p-1"
            >
              Close
            </button>

            {subSuccess ? (
              <div className="py-8 text-center space-y-4 font-sans">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-white text-sm font-bold uppercase">Contract Created</h3>
                <p className="text-xs text-gray-400 font-mono">{subSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleExecuteSubscribe} className="space-y-5">
                <div className="pb-3 border-b border-gray-800">
                  <h3 className="text-white text-xs font-bold uppercase font-sans tracking-wide">YIELD PROGRAM SUBSCRIPTION</h3>
                  <p className="text-xs font-mono text-amber-400 font-semibold">{subscribingPlan.name}</p>
                </div>

                <div className="space-y-2 text-xs font-sans">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span>ENTER PRINCIPAL STAKE (USD)</span>
                    <span className="text-gray-500">Available: ${Math.floor(user.walletBalance)}</span>
                  </div>
                  
                  <div className="relative bg-gray-950 border border-gray-800 rounded-lg py-2.5 px-3.5 focus-within:border-amber-500/40">
                    <input
                      type="number"
                      value={subAmt}
                      onChange={(e) => setSubAmt(e.target.value)}
                      className="w-full bg-transparent text-white text-sm font-bold focus:outline-none placeholder-gray-600"
                      min={subscribingPlan.minDeposit}
                      required
                    />
                    <span className="absolute right-3.5 text-gray-600 font-mono text-[10px]">USD</span>
                  </div>
                  <p className="text-[9px] text-gray-500 font-mono leading-relaxed">
                    *The deposit requirement for {subscribingPlan.name} is a minimum lock size of ${subscribingPlan.minDeposit}. Compound gains are accrued dynamically.
                  </p>
                </div>

                {/* Return estimation */}
                <div className="bg-[#121826]/40 p-3 rounded-lg border border-gray-800/60 font-sans text-[11px] text-gray-400 space-y-1.5 font-mono">
                  <div className="flex justify-between text-[10px]">
                    <span>Annual Rate:</span>
                    <span className="text-amber-500 font-bold">{subscribingPlan.roiLabel}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Lock-in Duration:</span>
                    <span className="text-white font-semibold">{subscribingPlan.periodDays} Days</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-[#0b0f19] font-bold text-[11px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                >
                  CONFIRM YIELD ENROLLMENT
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
