import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../types';
import { TrendingUp, TrendingDown, Eye, Activity, Sliders, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingViewChartProps {
  activeAsset: Asset;
  onPriceTick: (newPrice: number) => void;
}

export default function TradingViewChart({ activeAsset, onPriceTick }: TradingViewChartProps) {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '1H' | '1D'>('5m');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [showMA7, setShowMA7] = useState(true);
  const [showMA25, setShowMA25] = useState(true);
  const [indicator, setIndicator] = useState<'VOLUME' | 'RSI' | 'MACD'>('VOLUME');
  const [zoomLevel, setZoomLevel] = useState(30); // number of candles visible (30 to 80)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const phaseSeedRef = useRef<number>(0);
  const tickCounterRef = useRef<number>(0);
  const loadedKeyRef = useRef<string>('');

  const priceRef = useRef(activeAsset.price);
  priceRef.current = activeAsset.price;

  const categoryRef = useRef(activeAsset.category);
  categoryRef.current = activeAsset.category;

  const onPriceTickRef = useRef(onPriceTick);
  useEffect(() => {
    onPriceTickRef.current = onPriceTick;
  }, [onPriceTick]);

  // A continuous multi-harmonic mathematical market curve that creates rich organic wave patterns
  const getSimulatedPriceAtPhase = (phase: number, basePrice: number, category: string): number => {
    let amp = 0.009;
    if (category === 'forex') amp = 0.00045;
    else if (category === 'crypto') amp = 0.018;
    else if (category === 'stocks') amp = 0.0065;

    // 1. Slow macro wave representing general market cycles (bull phases, bear pullbacks)
    const macroTrend = Math.sin(phase / 28) * 1.5;

    // 2. Medium cycle wave modeling pullbacks, resistance retests, double bottoms
    const cycleRange = Math.cos(phase / 8) * Math.sin(phase / 18) * 0.8;

    // 3. High frequency short-term day swings and noise (zigzags)
    const shortTermSec = Math.sin(phase / 2.5) * Math.cos(phase / 4.8) * 0.35;

    // 4. Trend channels
    const channelDrift = Math.sin(phase / 65) * 0.7;

    const totalFluctuation = (macroTrend + cycleRange + shortTermSec + channelDrift) * amp;

    return basePrice * (1 + totalFluctuation);
  };

  // Generate initial simulated candles based on active asset price and continuous model
  useEffect(() => {
    // Generate simple seed based on asset id string hash combined with a randomized session offset 
    // to ensure the charts appear completely distinct and non-matching across logins and sessions
    const sessionOffsetKey = `vfx_chart_seed_offset_${activeAsset.id}`;
    let offsetStr = sessionStorage.getItem(sessionOffsetKey);
    if (!offsetStr) {
      offsetStr = String(Math.floor(Math.random() * 500) + 1);
      sessionStorage.setItem(sessionOffsetKey, offsetStr);
    }
    const offsetVal = parseInt(offsetStr) || 123;
    const hash = (activeAsset.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 10) + offsetVal) % 400 + 10;
    phaseSeedRef.current = hash;
    tickCounterRef.current = 0; // Reset live ticks progress counter

    const basePrice = activeAsset.price;
    const initialCandles: ChartCandle[] = [];
    const length = 100;

    // We align the final candle (index 99) close to match current active price 100% perfectly
    const modelPriceAtLast = getSimulatedPriceAtPhase(hash + 99, basePrice, activeAsset.category);
    const adjustmentRatio = modelPriceAtLast !== 0 ? basePrice / modelPriceAtLast : 1;

    // Configure custom wick scaling factors
    let wickFactor = 0.0006;
    if (activeAsset.category === 'forex') wickFactor = 0.00008;
    else if (activeAsset.category === 'crypto') wickFactor = 0.0018;
    else if (activeAsset.category === 'stocks') wickFactor = 0.0004;

    // Scale wicks/volatility of candles with timeframes
    if (timeframe === '1m') wickFactor *= 0.45;
    else if (timeframe === '1H') wickFactor *= 1.5;
    else if (timeframe === '1D') wickFactor *= 3.2;

    for (let i = 0; i < length; i++) {
      const openPhase = hash + i;
      const closePhase = hash + i + 1;

      const open = getSimulatedPriceAtPhase(openPhase, basePrice, activeAsset.category) * adjustmentRatio;
      const close = getSimulatedPriceAtPhase(closePhase, basePrice, activeAsset.category) * adjustmentRatio;

      // Deterministic pseudo-random seed values per index to make wicks beautiful
      const randSeed1 = Math.sin(openPhase * 1.7) * 0.5 + 0.5;
      const randSeed2 = Math.cos(closePhase * 2.3) * 0.5 + 0.5;
      
      const highWick = randSeed1 * (open + close) / 2 * wickFactor;
      const lowWick = randSeed2 * (open + close) / 2 * wickFactor;

      const high = Math.max(open, close) + highWick;
      const low = Math.min(open, close) - lowWick;

      const volume = Math.round((randSeed1 * 120) + 30);

      const dateObj = new Date();
      if (timeframe === '1m') dateObj.setMinutes(dateObj.getMinutes() - (length - i));
      else if (timeframe === '5m') dateObj.setMinutes(dateObj.getMinutes() - (length - i) * 5);
      else if (timeframe === '1H') dateObj.setHours(dateObj.getHours() - (length - i));
      else dateObj.setDate(dateObj.getDate() - (length - i));

      initialCandles.push({
        time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: Number(open.toFixed(activeAsset.category === 'forex' ? 4 : 2)),
        high: Number(high.toFixed(activeAsset.category === 'forex' ? 4 : 2)),
        low: Number(low.toFixed(activeAsset.category === 'forex' ? 4 : 2)),
        close: Number(close.toFixed(activeAsset.category === 'forex' ? 4 : 2)),
        volume,
      });
    }

    loadedKeyRef.current = `${activeAsset.id}_${timeframe}`;
    setCandles(initialCandles);
  }, [activeAsset.id, timeframe]);

  // Live simulation ticks
  useEffect(() => {
    const ticksPerCandle = 12;

    const intervalId = setInterval(() => {
      if (candles.length === 0) return;

      const currentSeed = phaseSeedRef.current;
      const currentPrice = priceRef.current;
      const currentCategory = categoryRef.current;

      // Increment live tick progress
      tickCounterRef.current += 1;
      const tickProgress = tickCounterRef.current / ticksPerCandle;

      // Align model curve with current activeAsset price
      const modelPriceAtLast = getSimulatedPriceAtPhase(currentSeed + 99, currentPrice, currentCategory);
      const adjustmentRatio = modelPriceAtLast !== 0 ? currentPrice / modelPriceAtLast : 1;

      // Evaluate raw continuous price at fractional state phase
      const currentPhase = currentSeed + 99 + tickProgress;
      const rawModelPrice = getSimulatedPriceAtPhase(currentPhase, currentPrice, currentCategory) * adjustmentRatio;

      // Micro bid-ask vibrance
      const scale = currentCategory === 'forex' ? 0.00004 : currentCategory === 'crypto' ? 0.0006 : 0.00015;
      const microNoise = (Math.sin(tickCounterRef.current * 1.8) * 0.4 + (Math.random() - 0.5) * 0.6) * currentPrice * scale;
      
      const nextTickPrice = Number((rawModelPrice + microNoise).toFixed(currentCategory === 'forex' ? 4 : 2));

      // Trigger state push back
      onPriceTickRef.current(nextTickPrice);

      setCandles((prev) => {
        if (loadedKeyRef.current !== `${activeAsset.id}_${timeframe}`) {
          return prev;
        }
        if (prev.length === 0) return prev;
        const next = [...prev];
        const last = { ...next[next.length - 1] };

        if (tickCounterRef.current >= ticksPerCandle) {
          // Append completed candle block and cycle seed phase
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;

          phaseSeedRef.current += 1;
          tickCounterRef.current = 0;

          const dateObj = new Date();
          const newCandle: ChartCandle = {
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            open: last.close,
            high: last.close,
            low: last.close,
            close: last.close,
            volume: Math.round(Math.random() * 100 + 15),
          };

          return [...next.slice(1), newCandle];
        } else {
          // Pulse the active open candle wicks and close
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;
          return next;
        }
      });
    }, 1200);

    return () => clearInterval(intervalId);
  }, [candles.length, timeframe, activeAsset.id]);

  // Handle candle sliced viewport
  const visibleCandles = candles.slice(-zoomLevel);

  if (visibleCandles.length === 0) {
    return (
      <div className="bg-[#0b0f19] border border-gray-800 rounded-xl p-6 shadow-xl h-[410px] flex flex-col items-center justify-center gap-3">
        <Activity className="w-8 h-8 animate-pulse text-emerald-400" />
        <span className="text-gray-500 font-mono text-[10px] uppercase tracking-wider">Synchronizing Market Data Streams...</span>
      </div>
    );
  }

  // Math helper vectors
  const minPrice = Math.min(...visibleCandles.map((c) => c.low)) * 0.9995;
  const maxPrice = Math.max(...visibleCandles.map((c) => c.high)) * 1.0005;
  const priceRange = (maxPrice - minPrice) || 1;

  // Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 350;

  // Projection coordinate conversion
  const getX = (index: number) => {
    return (index / (zoomLevel - 1)) * (chartWidth - 60) + 10;
  };

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 25;
  };

  // Technical moving average calc helper
  const getMA = (index: number, period: number) => {
    const globalIndex = candles.length - zoomLevel + index;
    if (globalIndex < period) return null;
    const slice = candles.slice(globalIndex - period, globalIndex);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return sum / period;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Nearest item index determination
    const relativeX = (x / rect.width) * chartWidth;
    const adjustedX = relativeX - 10;
    const totalW = chartWidth - 60;
    const indexFloat = (adjustedX / totalW) * (zoomLevel - 1);
    const index = Math.min(zoomLevel - 1, Math.max(0, Math.round(indexFloat)));

    setHoverIndex(index);
    setHoverPos({ x: getX(index), y: getY(visibleCandles[index].close) });
  };

  return (
    <div className="bg-[#0b0f19] border border-gray-800 rounded-xl p-3.5 shadow-xl h-[460px] flex flex-col justify-between overflow-hidden">
      {/* Ticker Metrics Bar */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-3 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold font-sans tracking-tight text-white flex items-center gap-1.5">
            {activeAsset.symbol}
            {activeAsset.change24h >= 0 ? (
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-rose-500" />
            )}
          </span>
          <span className="text-sm font-semibold rounded px-2 py-0.5 bg-gray-900 border border-gray-800 text-gray-400 uppercase">
            {activeAsset.category}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-gray-500">LAST VALUE</span>
            <span className={`font-bold text-sm ${activeAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">24H CHANGE</span>
            <span className={`font-bold ${activeAsset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activeAsset.change24h >= 0 ? '+' : ''}{activeAsset.change24h.toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">24H HIGH</span>
            <span className="text-white font-semibold">${activeAsset.high24h.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">24H LOW</span>
            <span className="text-white font-semibold">${activeAsset.low24h.toLocaleString()}</span>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-1.5 bg-[#121826] p-1 rounded-lg border border-gray-800">
          {(['1m', '5m', '1H', '1D'] as const).map((it) => (
            <button
              key={it}
              onClick={() => setTimeframe(it)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all duration-200 ${
                timeframe === it
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {it}
            </button>
          ))}
        </div>
      </div>

      {/* Main Terminal Stage */}
      <div className="relative">
        {/* Dynamic Tooltip details on hover */}
        {hoverIndex !== null && visibleCandles[hoverIndex] && (
          <div className="absolute top-2 left-2 bg-[#121826]/95 border border-emerald-500/30 rounded p-2.5 text-[10px] font-mono text-gray-300 pointer-events-none z-10 shadow-lg backdrop-blur flex gap-3">
            <div>TIME: <span className="text-white">{visibleCandles[hoverIndex].time}</span></div>
            <div>OPEN: <span className="text-white">${visibleCandles[hoverIndex].open.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>HIGH: <span className="text-emerald-400">${visibleCandles[hoverIndex].high.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>LOW: <span className="text-rose-400">${visibleCandles[hoverIndex].low.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>CLOSE: <span className="text-white">${visibleCandles[hoverIndex].close.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
          </div>
        )}

        {/* Render Vector Graph */}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto cursor-crosshair overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Chart Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = 20 + p * (chartHeight - 65);
            const gridPrice = maxPrice - p * priceRange;
            return (
              <g key={idx} className="opacity-40">
                <line
                  x1="10"
                  y1={y}
                  x2={chartWidth - 60}
                  y2={y}
                  stroke="#1f2937"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={chartWidth - 55}
                  y={y + 4}
                  fill="#9ca3af"
                  className="font-mono text-[9px]"
                >
                  ${gridPrice.toLocaleString(undefined, { maximumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}
                </text>
              </g>
            );
          })}

          {/* Time axis labels */}
          {visibleCandles.map((c, idx) => {
            if (idx % Math.round(zoomLevel / 5) === 0) {
              const x = getX(idx);
              return (
                <text
                  key={idx}
                  x={x}
                  y={chartHeight - 5}
                  fill="#4b5563"
                  textAnchor="middle"
                  className="font-mono text-[9px]"
                >
                  {c.time}
                </text>
              );
            }
            return null;
          })}

          {/* Candlestick graphics */}
          {visibleCandles.map((candle, idx) => {
            const x = getX(idx);
            const openY = getY(candle.open);
            const closeY = getY(candle.close);
            const highY = getY(candle.high);
            const lowY = getY(candle.low);

            const isUp = candle.close >= candle.open;
            const strokeColor = isUp ? '#10b981' : '#f43f5e';
            const fillColor = isUp ? '#059669' : '#e11d48';

            const candleWidth = Math.max(3, (chartWidth - 80) / zoomLevel * 0.65);

            return (
              <g key={idx}>
                {/* Wick shadow */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
                {/* Body candle block */}
                <rect
                  x={x - candleWidth / 2}
                  y={Math.min(openY, closeY)}
                  width={candleWidth}
                  height={Math.max(1.5, Math.abs(closeY - openY))}
                  fill={fillColor}
                  stroke={strokeColor}
                  className="transition-all duration-300 hover:brightness-125"
                />
              </g>
            );
          })}

          {/* Moving Average lines */}
          {showMA7 && (
            <polyline
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1.2"
              className="opacity-80"
              points={visibleCandles
                .map((_, idx) => {
                  const ma = getMA(idx, 7);
                  return ma ? `${getX(idx)},${getY(ma)}` : '';
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {showMA25 && (
            <polyline
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.2"
              className="opacity-80"
              points={visibleCandles
                .map((_, idx) => {
                  const ma = getMA(idx, 25);
                  return ma ? `${getX(idx)},${getY(ma)}` : '';
                })
                .filter(Boolean)
                .join(' ')}
            />
          )}

          {/* Current Live Price Line */}
          <line
            x1="10"
            y1={getY(activeAsset.price)}
            x2={chartWidth - 60}
            y2={getY(activeAsset.price)}
            stroke={activeAsset.change24h >= 0 ? '#10b981' : '#f43f5e'}
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />
          <g transform={`translate(${chartWidth - 58}, ${getY(activeAsset.price) - 8})`}>
            <rect
              width="55"
              height="16"
              rx="3"
              fill={activeAsset.change24h >= 0 ? '#10b981' : '#f43f5e'}
            />
            <text
              x="27.5"
              y="11.5"
              textAnchor="middle"
              fill="#000"
              className="font-mono text-[9px] font-bold"
            >
              ${activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 3 : 1 })}
            </text>
          </g>

          {/* Interactive cursor crosshair */}
          {hoverIndex !== null && (
            <g>
              {/* x-line */}
              <line
                x1={getX(hoverIndex)}
                y1="10"
                x2={getX(hoverIndex)}
                y2={chartHeight - 40}
                stroke="#6b7280"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* y-line */}
              <line
                x1="10"
                y1={hoverPos.y}
                x2={chartWidth - 60}
                y2={hoverPos.y}
                stroke="#6b7280"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* Hover Dot */}
              <circle
                cx={hoverPos.x}
                cy={hoverPos.y}
                r="4"
                fill="#10b981"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Auxiliary chart metrics panel */}
      <div className="flex flex-wrap justify-between items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-500 uppercase font-mono font-medium">overlays:</span>
          <button
            onClick={() => setShowMA7(!showMA7)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all duration-150 ${
              showMA7 ? 'bg-[#fbbf24]/10 border-[#fbbf24]/40 text-[#fbbf24]' : 'border-gray-800 text-gray-500'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${showMA7 ? 'bg-[#fbbf24]' : 'bg-gray-600'}`} />
            MA(7)
          </button>
          <button
            onClick={() => setShowMA25(!showMA25)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all duration-150 ${
              showMA25 ? 'bg-[#60a5fa]/10 border-[#60a5fa]/40 text-[#60a5fa]' : 'border-gray-800 text-gray-500'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${showMA25 ? 'bg-[#60a5fa]' : 'bg-gray-600'}`} />
            MA(25)
          </button>
        </div>

        {/* Viewport scaling */}
        <div className="flex items-center gap-2">

          <div className="flex items-center gap-1 bg-[#121826] border border-gray-800 rounded-lg p-1 text-gray-400">
            <button
              onClick={() => setZoomLevel((prev) => Math.min(80, prev + 10))}
              disabled={zoomLevel >= 80}
              className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30"
              title="Zoom Out (More candles)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] uppercase font-mono px-1 font-semibold">{zoomLevel}c</span>
            <button
              onClick={() => setZoomLevel((prev) => Math.max(20, prev - 10))}
              disabled={zoomLevel <= 20}
              className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30"
              title="Zoom In (Fewer candles)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
