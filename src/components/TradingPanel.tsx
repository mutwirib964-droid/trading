import React, { useState, useEffect } from 'react';
import { Asset, User, Position } from '../types';
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Layers, BookOpen, Clock } from 'lucide-react';

interface TradingPanelProps {
  activeAsset: Asset;
  user: User;
  onTradeExecute: (position: Omit<Position, 'id' | 'timestamp' | 'pnl' | 'currentPrice'>) => void;
  onClosePosition: (id: string, pnl: number) => void;
  addToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO') => void;
}

export default function TradingPanel({ activeAsset, user, onTradeExecute, onClosePosition, addToast }: TradingPanelProps) {
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [orderMode, setOrderMode] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState(activeAsset.price.toString());
  const [leverage, setLeverage] = useState(10);
  const [usdAmount, setUsdAmount] = useState('500');
  
  // Realtime Order Book Bids and Asks simulation
  const [bids, setBids] = useState<{ price: number; size: number }[]>([]);
  const [asks, setAsks] = useState<{ price: number; size: number }[]>([]);

  useEffect(() => {
    setLimitPrice(activeAsset.price.toString());
  }, [activeAsset.id]);

  // Simulate OrderBook movements
  useEffect(() => {
    const base = activeAsset.price;
    const generateOrderBook = () => {
      const generatedBids: { price: number; size: number }[] = [];
      const generatedAsks: { price: number; size: number }[] = [];
      for (let i = 1; i <= 6; i++) {
        const spread = base * (activeAsset.category === 'forex' ? 0.0001 : 0.001) * i;
        generatedBids.push({
          price: Number((base - spread).toFixed(activeAsset.category === 'forex' ? 4 : 2)),
          size: Math.random() * 5 + 0.1
        });
        generatedAsks.push({
          price: Number((base + spread).toFixed(activeAsset.category === 'forex' ? 4 : 2)),
          size: Math.random() * 5 + 0.1
        });
      }
      setBids(generatedBids);
      setAsks(generatedAsks.reverse());
    };

    generateOrderBook();
    const interval = setInterval(generateOrderBook, 2800);
    return () => clearInterval(interval);
  }, [activeAsset.price, activeAsset.id]);

  const priceToUse = orderMode === 'MARKET' ? activeAsset.price : (parseFloat(limitPrice) || activeAsset.price);
  const totalMargin = parseFloat(usdAmount) || 0;
  const positionSizeUsd = totalMargin * leverage;
  const assetQuantity = positionSizeUsd / priceToUse;

  const handleQuickPercent = (pct: number) => {
    const calculated = Math.floor(user.walletBalance * pct);
    setUsdAmount(Math.max(10, calculated).toString());
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalMargin <= 0) return;

    if (user.accountMode === 'REAL' && totalMargin < 10) {
      addToast("The minimum manual trade stake is $10 for Real accounts.", "ERROR");
      return;
    }

    if (totalMargin > user.walletBalance) {
      addToast("Insufficient wallet balance for this margin commitment.", "ERROR");
      return;
    }

    onTradeExecute({
      assetSymbol: activeAsset.symbol,
      assetName: activeAsset.name,
      type: tradeType,
      entryPrice: priceToUse,
      amount: assetQuantity,
      leverage,
      margin: totalMargin
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 text-[11px]">
      {/* 1. Placing Trade Panel */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3 shadow-xl flex flex-col justify-between">
        <form onSubmit={handlePlaceOrder} className="space-y-3">
          {/* BUY/SELL Toggle Header */}
          <div className="flex bg-gray-950 p-0.5 rounded border border-gray-850">
            <button
              type="button"
              onClick={() => setTradeType('BUY')}
              className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-wide rounded transition-all duration-150 cursor-pointer ${
                tradeType === 'BUY'
                  ? 'bg-emerald-500 text-[#0b0f19]'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              LONG / BUY
            </button>
            <button
              type="button"
              onClick={() => setTradeType('SELL')}
              className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-wide rounded transition-all duration-150 cursor-pointer ${
                tradeType === 'SELL'
                  ? 'bg-rose-500 text-white'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              SHORT / SELL
            </button>
          </div>

          {/* Limit / Market controls */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#121826]/40 p-0.5 rounded border border-gray-850">
            {(['MARKET', 'LIMIT'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setOrderMode(mode)}
                className={`py-0.5 text-[9.5px] font-mono rounded cursor-pointer ${
                  orderMode === mode ? 'bg-gray-800 text-white font-bold' : 'text-gray-500 hover:text-gray-305'
                }`}
              >
                {mode} ORDER
              </button>
            ))}
          </div>

          {/* Form Fields container */}
          <div className="space-y-2.5 font-bold">
            {orderMode === 'LIMIT' && (
              <div className="space-y-1">
                <label className="text-gray-500 font-mono text-[8.5px] uppercase">LIMIT RATE (USD)</label>
                <div className="relative bg-gray-950 border border-gray-800 rounded py-1 px-2.5 focus-within:border-emerald-500/30 flex items-center">
                  <input
                    type="number"
                    step="0.0001"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-full bg-transparent text-white focus:outline-none text-[10.5px] font-bold font-mono"
                  />
                  <span className="text-gray-650 font-mono text-[9px] font-bold select-none pl-1.5">USD</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between items-center text-[8.5px] uppercase text-gray-500">
                <label>MARGIN COLLATERAL</label>
                <span>Avail: ${Math.floor(user.walletBalance)}</span>
              </div>
              <div className="relative bg-gray-950 border border-gray-800 rounded py-1 px-2.5 focus-within:border-emerald-500/30 flex items-center">
                <input
                  type="number"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  className="w-full bg-transparent text-white focus:outline-none text-[10.5px] font-bold font-mono"
                  min="10"
                />
                <span className="text-gray-650 font-mono text-[9px] font-bold select-none pl-1.5">USD</span>
              </div>

              {/* Percentage chips */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[0.1, 0.25, 0.5, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickPercent(pct)}
                    className="py-0.5 text-[9px] font-mono bg-[#121826] border border-gray-800 text-gray-550 hover:text-emerald-400 hover:border-emerald-500/25 rounded cursor-pointer"
                  >
                    {pct * 100}%
                  </button>
                ))}
              </div>
            </div>

            {/* Leverage selector */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[8.5px] font-mono">
                <span className="text-gray-500 uppercase">LEVERAGE MULTIPLIER</span>
                <span className="text-emerald-400 font-bold">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max={activeAsset.category === 'forex' ? '200' : '100'}
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[7.5px] font-mono text-gray-600">
                <span>1x</span>
                <span>25x</span>
                <span>50x</span>
                <span>100x</span>
                {activeAsset.category === 'forex' && <span>200x</span>}
              </div>
            </div>
          </div>

          {/* Leverage warning block */}
          {leverage >= 50 && (
            <div className="bg-amber-950/15 border border-amber-900/30 rounded p-2 flex items-start gap-1.5 text-amber-500 text-[9px] leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>High Leverage Advisory: Multipliers beyond 50x involve severe liquidation thresholds. Secure matching stop parameters.</span>
            </div>
          )}

          {/* Trade Math summary */}
          <div className="bg-[#121826]/40 p-2.5 rounded border border-gray-800/60 font-mono text-[9px] text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Execution Value:</span>
              <span className="text-white font-semibold">${positionSizeUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>Position Volume:</span>
              <span className="text-white font-semibold">{assetQuantity.toFixed(activeAsset.category === 'forex' ? 3 : 5)} units</span>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-1.5 rounded text-[10.5px] font-extrabold text-[#0b0f19] tracking-wide uppercase shadow-md transition-all duration-200 cursor-pointer ${
              tradeType === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-950/20' : 'bg-rose-500 hover:bg-rose-400 text-white'
            }`}
          >
            EXECUTE {tradeType === 'BUY' ? 'LONG' : 'SHORT'} ORDER
          </button>
        </form>
      </div>

      {/* 2. Order Book & Depth of Market panel */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3 shadow-xl">
        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-gray-800">
          <span className="text-white text-[11px] font-bold font-sans tracking-tight uppercase flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            LIVE ORDER BOOK
          </span>
          <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">LVL 2 DEPTH</span>
        </div>

        {/* Orderbook labels */}
        <div className="grid grid-cols-3 text-[9px] font-mono text-gray-500 font-semibold mb-1.5 uppercase">
          <span>Price (USD)</span>
          <span className="text-right">Size (Units)</span>
          <span className="text-right">Sum (Total)</span>
        </div>

        {/* Asks (Sells) */}
        <div className="space-y-1 mb-2">
          {asks.slice(0, 5).map((ask, idx) => (
            <div key={idx} className="relative grid grid-cols-3 text-[10.5px] font-mono text-rose-400 py-0.5">
              <div 
                style={{ width: `${Math.min(100, (ask.size / 5) * 100)}%` }} 
                className="absolute right-0 top-0 bottom-0 bg-rose-500/5 pointer-events-none"
              />
              <span>{ask.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}</span>
              <span className="text-right text-gray-400">{ask.size.toFixed(2)}</span>
              <span className="text-right text-gray-500">${(ask.price * ask.size).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>

        {/* Spread ticker bar */}
        <div className="bg-[#121826] border border-gray-800 rounded p-1.5 text-[11px] font-mono mb-2 font-bold flex justify-between px-2.5">
          <span className="text-emerald-400 flex items-center gap-1.5 font-mono">
            <TrendingUp className="w-3 h-3" />
            ${activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}
          </span>
          <span className="text-gray-550 uppercase text-[8.5px] tracking-wide self-center font-bold">Spread: 0.02%</span>
        </div>

        {/* Bids (Buys) */}
        <div className="space-y-1">
          {bids.slice(0, 5).map((bid, idx) => (
            <div key={idx} className="relative grid grid-cols-3 text-[10.5px] font-mono text-emerald-400 py-0.5">
              <div 
                style={{ width: `${Math.min(100, (bid.size / 5) * 100)}%` }} 
                className="absolute right-0 top-0 bottom-0 bg-emerald-500/5 pointer-events-none"
              />
              <span>{bid.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}</span>
              <span className="text-right text-gray-400">{bid.size.toFixed(2)}</span>
              <span className="text-right text-gray-500">${(bid.price * bid.size).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Security Guarantee & Info */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3 shadow-xl flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-800/60">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white text-[11px] font-bold font-sans uppercase">Institutional Security Guard</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
            VexcoinFX Elite incorporates state-of-the-art cold multi-signature wallets and strict institutional banking policies (including segmented liquidity preservation). All live orders are executed under optimal market parameters.
          </p>

          <div className="space-y-2 font-mono text-[9px] text-gray-500 border-t border-gray-850 pt-2.5">
            <div className="flex justify-between">
              <span>Clearing:</span>
              <span className="text-white font-semibold">Immediate</span>
            </div>
            <div className="flex justify-between">
              <span>Execution Latency:</span>
              <span className="text-emerald-400 font-semibold">12ms (Automated Routing)</span>
            </div>
            <div className="flex justify-between">
              <span>Stated Fee Tier:</span>
              <span className="text-white font-semibold">0.02% Pro-Lite</span>
            </div>
          </div>
        </div>

        <div className="bg-[#121826]/40 p-2.5 rounded border border-gray-800/60 flex items-center gap-2 text-gray-500 mt-3 text-[9.5px]">
          <Layers className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>VexcoinFX clearing network utilizes segmented accounts for customer deposits. Safeguarded by institutional security audits.</span>
        </div>
      </div>

      {/* 4. Active Positions table spanning full width below */}
      <div className="lg:col-span-3 bg-[#0b0f19] border border-gray-800 rounded-lg p-3 shadow-xl mt-0.5">
        <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-gray-800">
          <span className="text-white text-[11px] font-bold font-sans uppercase flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            OPEN MARGIN POSITIONS ({user.activePositions.length})
          </span>
          <span className="text-[9px] font-mono text-gray-500 uppercase font-bold">ACTIVE TRADES ONLY</span>
        </div>

        {user.activePositions.length === 0 ? (
          <div className="border border-dashed border-gray-800 rounded p-6 text-center text-[10px] text-gray-500 font-mono">
            No active leveraged margin options logged. Scale trading above to test position state matching.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10.5px] font-mono">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 uppercase pb-1.5 text-[9px]">
                  <th className="py-2">Symbol</th>
                  <th>Mode / Multiplier</th>
                  <th>Entry Price</th>
                  <th>Current price</th>
                  <th>Margin Collateral</th>
                  <th>Volume Rate</th>
                  <th>Profit / Loss</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {user.activePositions.map((pos) => {
                  const isGain = pos.pnl >= 0;
                  return (
                    <tr key={pos.id} className="border-b border-gray-850 hover:bg-gray-900/10">
                      <td className="py-2 font-sans font-bold text-white uppercase">{pos.assetSymbol}</td>
                      <td>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          pos.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {pos.type} {pos.leverage}x
                        </span>
                      </td>
                      <td className="text-gray-400">${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-white font-semibold">${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="text-gray-400">${pos.margin.toLocaleString()}</td>
                      <td className="text-gray-500">{pos.amount.toFixed(pos.assetSymbol.includes('forex') ? 3 : 5)}</td>
                      <td className={`font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isGain ? '+' : ''}${pos.pnl.toFixed(2)} ({isGain ? '+' : ''}{((pos.pnl / pos.margin) * 100).toFixed(1)}%)
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => onClosePosition(pos.id, pos.pnl)}
                          className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-[8.5px] font-bold uppercase tracking-wide rounded border border-rose-500/20 transition-all cursor-pointer"
                        >
                          CLOSE CONTRACT
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div></div>
  );
}
