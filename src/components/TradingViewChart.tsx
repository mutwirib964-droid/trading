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
  onPriceTick: (assetId: string, newPrice: number) => void;
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

  const tickCounterRef = useRef<number>(0);
  const loadedKeyRef = useRef<string>('');

  const priceRef = useRef(activeAsset.price);
  priceRef.current = activeAsset.price;

  const categoryRef = useRef(activeAsset.category);
  categoryRef.current = activeAsset.category;

  const activeAssetIdRef = useRef(activeAsset.id);
  activeAssetIdRef.current = activeAsset.id;

  const onPriceTickRef = useRef(onPriceTick);
  useEffect(() => {
    onPriceTickRef.current = onPriceTick;
  }, [onPriceTick]);

  // Generate initial simulated candles based on a highly realistic drift-diffusion random walk model
  useEffect(() => {
    const basePrice = activeAsset.price;
    const change24h = activeAsset.change24h || 0;
    const initialCandles: ChartCandle[] = [];
    const length = 100;

    // Determine volatility and wick parameters based on asset category
    let vol = 0.0015;
    let wick = 0.002;
    if (activeAsset.category === 'forex') {
      vol = 0.0001;
      wick = 0.00015;
    } else if (activeAsset.category === 'crypto') {
      vol = 0.0035;
      wick = 0.005;
    } else if (activeAsset.category === 'stocks') {
      vol = 0.0008;
      wick = 0.0012;
    }

    // Scale volatility by timeframe
    if (timeframe === '1m') {
      vol *= 0.5;
      wick *= 0.5;
    } else if (timeframe === '1H') {
      vol *= 1.8;
      wick *= 1.8;
    } else if (timeframe === '1D') {
      vol *= 3.5;
      wick *= 3.5;
    }

    // Setup random walk starting price backwards based on 24h change
    const startPrice = basePrice / (1 + change24h / 100);
    let current = startPrice;
    const rawPrices: number[] = [startPrice];

    for (let i = 1; i <= length; i++) {
      // Gentle drift towards our final target close price
      const idealPrice = startPrice + (basePrice - startPrice) * (i / length);
      const meanReversion = (idealPrice - current) * 0.15;
      const change = (Math.random() - 0.5) * vol + meanReversion / current;
      current = current * (1 + change);
      rawPrices.push(current);
    }

    // Align the final price perfectly with the current base price
    const finalClose = rawPrices[length];
    const diff = basePrice - finalClose;

    for (let i = 0; i < length; i++) {
      let open = rawPrices[i] + diff * (i / length);
      let close = rawPrices[i + 1] + diff * ((i + 1) / length);

      // Generate clean realistic candle wicks (high / low extremes)
      const rand1 = Math.random();
      const rand2 = Math.random();
      const high = Math.max(open, close) + (rand1 * wick * ((open + close) / 2));
      const low = Math.min(open, close) - (rand2 * wick * ((open + close) / 2));

      const volume = Math.round(Math.random() * 100 + 20);

      const dateObj = new Date();
      if (timeframe === '1m') dateObj.setMinutes(dateObj.getMinutes() - (length - i));
      else if (timeframe === '5m') dateObj.setMinutes(dateObj.getMinutes() - (length - i) * 5);
      else if (timeframe === '1H') dateObj.setHours(dateObj.getHours() - (length - i));
      else dateObj.setDate(dateObj.getDate() - (length - i));

      const digits = activeAsset.category === 'forex' ? 4 : 2;
      initialCandles.push({
        time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open: Number(open.toFixed(digits)),
        high: Number(high.toFixed(digits)),
        low: Number(low.toFixed(digits)),
        close: Number(close.toFixed(digits)),
        volume,
      });
    }

    tickCounterRef.current = 0;
    loadedKeyRef.current = `${activeAsset.id}_${timeframe}`;
    setCandles(initialCandles);
  }, [activeAsset.id, timeframe]);

  // Live simulation ticks
  useEffect(() => {
    const ticksPerCandle = 8;
    const currentAssetId = activeAsset.id;

    const intervalId = setInterval(() => {
      if (candles.length === 0) return;

      const loadedKey = loadedKeyRef.current;
      const expectedKey = `${currentAssetId}_${timeframe}`;

      // Prevent processing any delayed/stale events for assets no longer currently loaded
      if (loadedKey !== expectedKey || activeAssetIdRef.current !== currentAssetId) {
        return;
      }

      const currentPrice = priceRef.current;
      const currentCategory = categoryRef.current;

      // Determine micro tick volatility based on asset categories
      let tickVol = 0.0003;
      if (currentCategory === 'forex') tickVol = 0.00003;
      else if (currentCategory === 'crypto') tickVol = 0.0007;
      else if (currentCategory === 'stocks') tickVol = 0.0002;

      // Scale minor ticks with timeframe
      if (timeframe === '1m') tickVol *= 0.6;
      else if (timeframe === '1H') tickVol *= 1.4;
      else if (timeframe === '1D') tickVol *= 2.2;

      // Gentle random tick movement with subtle drift
      const change = (Math.random() - 0.5) * tickVol;
      const nextTickPrice = Number((currentPrice * (1 + change)).toFixed(currentCategory === 'forex' ? 4 : 2));

      // Precision push back of state to the parent, explicitly bound to security asset ID
      onPriceTickRef.current(currentAssetId, nextTickPrice);

      setCandles((prev) => {
        // Double check thread / context safety
        if (loadedKeyRef.current !== expectedKey || prev.length === 0) {
          return prev;
        }

        const next = [...prev];
        const last = { ...next[next.length - 1] };

        tickCounterRef.current += 1;
        if (tickCounterRef.current >= ticksPerCandle) {
          // Commit finalized values to active open candle slot
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;

          // Push a brand new active streaming candle slot
          tickCounterRef.current = 0;
          const dateObj = new Date();
          const newCandle: ChartCandle = {
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            open: nextTickPrice,
            high: nextTickPrice,
            low: nextTickPrice,
            close: nextTickPrice,
            volume: Math.round(Math.random() * 80 + 20),
          };

          return [...next.slice(1), newCandle];
        } else {
          // Dynamic live update within active open block
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;
          return next;
        }
      });
    }, 1500);

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
            
            // TradingView Theme Colors
            const strokeColor = isUp ? '#089981' : '#f23645';
            const fillColor = isUp ? '#089981' : '#f23645';

            const candleWidth = Math.max(4, (chartWidth - 80) / zoomLevel * 0.7);

            return (
              <g key={idx}>
                {/* Wick shadow (High-Low extreme extremes) */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={strokeColor}
                  strokeWidth="1.5"
                />
                {/* Body candle block (Open-Close body) */}
                <rect
                  x={x - candleWidth / 2}
                  y={Math.min(openY, closeY)}
                  width={candleWidth}
                  height={Math.max(1.5, Math.abs(closeY - openY))}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="0.8"
                  className="hover:brightness-125"
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
