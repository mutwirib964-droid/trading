import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../types';
import { TrendingUp, TrendingDown, Eye, Activity, Sliders, ZoomIn, ZoomOut, Maximize2, Clock } from 'lucide-react';

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

// Global cache outside the component to survive mounts/unmounts across tab switches
const globalCandleCache: Record<string, ChartCandle[]> = {};

export default function TradingViewChart({ activeAsset, onPriceTick }: TradingViewChartProps) {
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '1H' | '1D'>('5m');
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [showMA10, setShowMA10] = useState(true);
  const [showEMA20, setShowEMA20] = useState(true);
  const [showFib, setShowFib] = useState(true);
  const [indicator, setIndicator] = useState<'VOLUME' | 'RSI' | 'MACD'>('VOLUME');
  const [zoomLevel, setZoomLevel] = useState(55); // increased density for premium aesthetic
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [timeMode, setTimeMode] = useState<'real' | 'simulated'>('real');
  const [countdownText, setCountdownText] = useState<string>('');
  const [progressFraction, setProgressFraction] = useState<number>(0);

  const tickCounterRef = useRef<number>(0);
  const loadedKeyRef = useRef<string>('');
  const waveCycleRef = useRef<number>(Math.random() * 200);

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

  // Generate initial simulated candles based on a professional Brownian motion random walk
  useEffect(() => {
    const cacheKey = `${activeAsset.id}_${timeframe}`;
    if (globalCandleCache[cacheKey]) {
      setCandles(globalCandleCache[cacheKey]);
      tickCounterRef.current = 0;
      loadedKeyRef.current = cacheKey;
      return;
    }

    const basePrice = activeAsset.price;
    const change24h = activeAsset.change24h || 0;
    const initialCandles: ChartCandle[] = [];
    const length = 100;

    // Define volatility parameters based on active category
    let vol = 0.012; // default volatility
    if (activeAsset.category === 'forex') {
      vol = 0.002;
    } else if (activeAsset.category === 'crypto') {
      vol = 0.025;
    } else if (activeAsset.category === 'stocks') {
      vol = 0.008;
    }

    // Scale volatility based on timeframe
    if (timeframe === '1m') {
      vol *= 0.4;
    } else if (timeframe === '1H') {
      vol *= 1.4;
    } else if (timeframe === '1D') {
      vol *= 2.8;
    }

    const startPrice = basePrice / (1 + change24h / 100);
    const rawWalkPrice: number[] = [startPrice];
    let current = startPrice;

    // 1. Generate core geometric random walk coordinates with momentum memory
    let momentum = 0;
    
    // Setup fine timeframe structural bias
    let driftFactor = 0;
    if (timeframe === '1m') {
      driftFactor = -0.001; // bearish bias for 1m
    } else if (timeframe === '5m') {
      driftFactor = 0.0005;  // bullish retracement
    } else if (timeframe === '1H') {
      driftFactor = 0.0008;  // strong waves
    } else {
      driftFactor = -0.0002;
    }

    for (let i = 1; i <= length; i++) {
      const stepNoise = (Math.random() - 0.5) * vol;
      momentum = 0.65 * momentum + stepNoise * 0.45 + driftFactor * vol;
      current = current * (1 + momentum + (Math.random() - 0.5) * vol * 0.15);
      rawWalkPrice.push(current);
    }

    // 2. Mathematically precise adjustment bridge: binds start and end perfectly to maintain asset accuracy
    const finalVal = rawWalkPrice[length];
    const correctionRatio = basePrice / finalVal;
    
    const calibratedPrices: number[] = [];
    for (let i = 0; i <= length; i++) {
      const t = i / length;
      // Interpolate multiplier scale to keep the authentic structure intact while meeting targets
      const stepCorrection = 1 + (correctionRatio - 1) * t;
      calibratedPrices.push(rawWalkPrice[i] * stepCorrection);
    }

    // 3. Transform prices into real candles with proportional, safe wicks
    const digits = activeAsset.category === 'forex' ? 4 : 2;

    for (let i = 0; i < length; i++) {
      let open = calibratedPrices[i];
      let close = calibratedPrices[i + 1];

      // Safe jitter gap
      const jitter = (Math.random() - 0.5) * (open * 0.0001);
      close += jitter;

      const bodySize = Math.abs(close - open);
      const avgPrice = (open + close) / 2;

      let wickScaleFactor = 0.0006;
      if (activeAsset.category === 'forex') wickScaleFactor = 0.0001;
      else if (activeAsset.category === 'stocks') wickScaleFactor = 0.00035;
      else if (activeAsset.category === 'crypto') wickScaleFactor = 0.0012;

      const baselineWick = avgPrice * wickScaleFactor;

      const topLimit = Math.max(open, close);
      const bottomLimit = Math.min(open, close);

      // Proportional random wicks
      const topWick = bodySize * (0.05 + Math.random() * 0.35) + Math.random() * baselineWick;
      const bottomWick = bodySize * (0.05 + Math.random() * 0.35) + Math.random() * baselineWick;

      const high = topLimit + topWick;
      const low = bottomLimit - bottomWick;

      const volume = Math.round(Math.random() * 85 + 15);

      const timestampEpoch = new Date();
      if (timeframe === '1m') timestampEpoch.setMinutes(timestampEpoch.getMinutes() - (length - i));
      else if (timeframe === '5m') timestampEpoch.setMinutes(timestampEpoch.getMinutes() - (length - i) * 5);
      else if (timeframe === '1H') timestampEpoch.setHours(timestampEpoch.getHours() - (length - i));
      else timestampEpoch.setDate(timestampEpoch.getDate() - (length - i));

      const timeLabel = timeframe === '1D'
        ? timestampEpoch.toLocaleDateString([], { month: 'short', day: '2-digit' })
        : timestampEpoch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      initialCandles.push({
        time: timeLabel,
        open: Number(open.toFixed(digits)),
        high: Number(high.toFixed(digits)),
        low: Number(low.toFixed(digits)),
        close: Number(close.toFixed(digits)),
        volume,
      });
    }

    globalCandleCache[cacheKey] = initialCandles;
    tickCounterRef.current = 0;
    loadedKeyRef.current = cacheKey;
    setCandles(initialCandles);
  }, [activeAsset.id, timeframe]);

  // Reset smooth progress state on core user variables change
  useEffect(() => {
    setProgressFraction(0);
  }, [activeAsset.id, timeframe, timeMode]);

  const simulatedProgressRef = useRef<number>(0);
  const lastTimeBlockRef = useRef<number>(0);

  // Live simulation ticks
  useEffect(() => {
    const currentAssetId = activeAsset.id;
    const currentCategory = activeAsset.category;

    simulatedProgressRef.current = 0;
    
    const now = Date.now();
    let periodMs = 60000;
    if (timeframe === '1m') periodMs = 60000;
    else if (timeframe === '5m') periodMs = 300000;
    else if (timeframe === '1H') periodMs = 3600000;
    else if (timeframe === '1D') periodMs = 86400000;

    lastTimeBlockRef.current = Math.floor(now / periodMs);

    const intervalId = setInterval(() => {
      // 1. Enforce Market Hours constraints (forex & stocks closed on weekends, crypto 24/7)
      if (currentCategory !== 'crypto') {
        const day = new Date().getDay();
        if (day === 0 || day === 6) {
          setCountdownText('CLOSED');
          return;
        }
      }

      if (candles.length === 0) return;

      const loadedKey = loadedKeyRef.current;
      const expectedKey = `${currentAssetId}_${timeframe}`;

      if (loadedKey !== expectedKey || activeAssetIdRef.current !== currentAssetId) {
        return;
      }

      const currentPrice = priceRef.current;

      // Increment wave cycle for continuous fluid motion
      waveCycleRef.current = (waveCycleRef.current || 0) + 0.035;

      // Base volatility parameters to ensure distinct, non-stagnant price movement
      let baseVol = 0.00035; // default (crypto/commodities) (reduced from 0.0016 for realistic smoothness)
      if (currentCategory === 'forex') baseVol = 0.00004; // (reduced from 0.00024)
      else if (currentCategory === 'stocks') baseVol = 0.00012; // (reduced from 0.00065)

      // Scale volatility safely based on timeframe
      if (timeframe === '1m') baseVol *= 0.8;
      else if (timeframe === '1H') baseVol *= 1.4;
      else if (timeframe === '1D') baseVol *= 2.0;

      // Dynamic wave trend combines basic sine/cosine waves to model natural bullish + bearish waves slowly
      const waveDrift = Math.sin(waveCycleRef.current) * 0.00008 + Math.cos(waveCycleRef.current * 0.35) * 0.00004;

      // Stochastic noise term
      const noise = (Math.random() - 0.5) * baseVol;

      // Combine drift wave with white noise for realistic, smooth volatility
      const change = waveDrift + noise;
      const nextTickPrice = Number((currentPrice * (1 + change)).toFixed(currentCategory === 'forex' ? 4 : 2));

      // Push price tick to parent context smoothly
      onPriceTickRef.current(currentAssetId, nextTickPrice);

      const RightNow = Date.now();
      let shouldSpawnNew = false;
      let remainingMs = 0;

      let currFraction = 0;

      if (timeMode === 'real') {
        let blockMs = 60000;
        if (timeframe === '1m') blockMs = 60000;
        else if (timeframe === '5m') blockMs = 300000;
        else if (timeframe === '1H') blockMs = 3600000;
        else if (timeframe === '1D') blockMs = 86400000;

        const currentBlock = Math.floor(RightNow / blockMs);
        remainingMs = blockMs - (RightNow % blockMs);

        const totalSecs = Math.max(0, Math.floor(remainingMs / 1000));
        const mm = Math.floor(totalSecs / 60);
        const ss = totalSecs % 60;
        setCountdownText(`${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);

        if (currentBlock > lastTimeBlockRef.current) {
          shouldSpawnNew = true;
          lastTimeBlockRef.current = currentBlock;
        }

        const elapsed = blockMs - remainingMs;
        currFraction = elapsed / blockMs;
      } else {
        // Fast-forward simulated timelines - significantly lengthened to allow gradual order-block formation
        let simulatedLimit = 45000; // 45 seconds for 1m
        if (timeframe === '1m') simulatedLimit = 45000;
        else if (timeframe === '5m') simulatedLimit = 90000; // 90 seconds
        else if (timeframe === '1H') simulatedLimit = 180000;
        else if (timeframe === '1D') simulatedLimit = 300000;

        simulatedProgressRef.current += 500;
        remainingMs = Math.max(0, simulatedLimit - simulatedProgressRef.current);

        const totalSecs = Math.max(0, Math.floor(remainingMs / 1000));
        const mm = Math.floor(totalSecs / 60);
        const ss = totalSecs % 60;
        setCountdownText(`⚡ ${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`);

        if (simulatedProgressRef.current >= simulatedLimit) {
          shouldSpawnNew = true;
          simulatedProgressRef.current = 0;
        }

        currFraction = simulatedProgressRef.current / simulatedLimit;
      }

      setProgressFraction(shouldSpawnNew ? 0 : currFraction);

      setCandles((prev) => {
        if (loadedKeyRef.current !== expectedKey || prev.length === 0) {
          return prev;
        }

        const next = [...prev];
        const last = { ...next[next.length - 1] };

        let result: ChartCandle[];

        if (shouldSpawnNew) {
          // Commit finalized candle values
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;

          const dateObj = new Date();
          const newTimeLabel = timeframe === '1D'
            ? dateObj.toLocaleDateString([], { month: 'short', day: '2-digit' })
            : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const newCandle: ChartCandle = {
            time: newTimeLabel,
            open: nextTickPrice,
            high: nextTickPrice,
            low: nextTickPrice,
            close: nextTickPrice,
            volume: Math.round(Math.random() * 80 + 20),
          };

          result = [...next.slice(1), newCandle];
        } else {
          last.close = nextTickPrice;
          last.high = Math.max(last.high, nextTickPrice);
          last.low = Math.min(last.low, nextTickPrice);
          next[next.length - 1] = last;
          result = next;
        }

        globalCandleCache[expectedKey] = result;
        return result;
      });
    }, 500);

    return () => clearInterval(intervalId);
  }, [candles.length, timeframe, activeAsset.id, timeMode]);

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

  // Chart Dimensions (Multi-Pane)
  const chartWidth = 720;
  const chartHeight = 390; // taller to fit indicators comfortably
  const rightMargin = 85;
  const leftMargin = 15;
  const drawableWidth = chartWidth - rightMargin - leftMargin;

  const mainMinY = 15;
  const mainMaxY = 240; // bottom bound of candlesticks pane

  // Projection coordinate conversions
  const getX = (index: number) => {
    const paddedZoom = zoomLevel + 1.8;
    return (index / paddedZoom) * drawableWidth + leftMargin;
  };

  const getY = (price: number) => {
    return mainMaxY - ((price - minPrice) / priceRange) * (mainMaxY - mainMinY);
  };

  // Technical Simple Moving Average (SMA)
  const getMA = (index: number, period: number) => {
    const globalIndex = candles.length - zoomLevel + index;
    if (globalIndex < period || globalIndex >= candles.length) return null;
    const slice = candles.slice(globalIndex - period, globalIndex);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return sum / period;
  };

  // Technical Exponential Moving Average (EMA)
  const getEMA = (index: number, period: number) => {
    const globalIndex = candles.length - zoomLevel + index;
    if (globalIndex < period || globalIndex >= candles.length) return null;
    
    let ema = 0;
    const seedSlice = candles.slice(0, period);
    const seedSum = seedSlice.reduce((acc, curr) => acc + curr.close, 0);
    ema = seedSum / period;

    const k = 2 / (period + 1);
    for (let i = period; i <= globalIndex; i++) {
      ema = candles[i].close * k + ema * (1 - k);
    }
    return ema;
  };

  // Relative Strength Index (RSI 14)
  const getRSI = (index: number, period: number = 14) => {
    const globalIndex = candles.length - zoomLevel + index;
    if (globalIndex < period || globalIndex >= candles.length) return 50; // Neutral default
    
    let gains = 0;
    let losses = 0;
    for (let i = globalIndex - period + 1; i <= globalIndex; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff > 0) {
        gains += diff;
      } else {
        losses += Math.abs(diff);
      }
    }
    
    if (losses === 0) return 100;
    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
  };

  // Moving Average Convergence Divergence (MACD 12, 26, 9)
  const getMACD = (index: number) => {
    const globalIndex = candles.length - zoomLevel + index;
    if (globalIndex < 26 || globalIndex >= candles.length) {
      return { macd: 0, signal: 0, hist: 0 };
    }
    
    const ema12 = getEMA(index, 12) || candles[globalIndex].close;
    const ema26 = getEMA(index, 26) || candles[globalIndex].close;
    const macdVal = ema12 - ema26;
    
    const prevMacdValues: number[] = [];
    for (let i = Math.max(0, index - 8); i <= index; i++) {
      const e12 = getEMA(i, 12) || candles[candles.length - zoomLevel + i].close;
      const e26 = getEMA(i, 26) || candles[candles.length - zoomLevel + i].close;
      prevMacdValues.push(e12 - e26);
    }
    const signalVal = prevMacdValues.length > 0
      ? prevMacdValues.reduce((acc, curr) => acc + curr, 0) / prevMacdValues.length
      : 0;
      
    return {
      macd: macdVal,
      signal: signalVal,
      hist: macdVal - signalVal
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Nearest item index determination
    const relativeX = (x / rect.width) * chartWidth;
    const adjustedX = relativeX - leftMargin;
    const paddedZoom = zoomLevel + 1.8;
    const indexFloat = (adjustedX / drawableWidth) * paddedZoom;
    const index = Math.min(zoomLevel - 1, Math.max(0, Math.round(indexFloat)));

    if (visibleCandles[index]) {
      setHoverIndex(index);
      setHoverPos({ x: getX(index), y: getY(visibleCandles[index].close) });
    }
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
        <div className="flex items-center gap-2.5">
          {/* Candle Countdown Badge */}
          {countdownText && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/25 font-mono text-[9px] text-emerald-400 font-semibold uppercase animate-pulse">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>{countdownText}</span>
            </div>
          )}

          {/* Clock Mode Selector */}
          <div className="flex items-center gap-0.5 bg-[#121826] p-0.5 rounded-lg border border-gray-800">
            <button
              onClick={() => setTimeMode('real')}
              className={`px-2 py-0.5 text-[9px] font-mono font-medium rounded transition-all cursor-pointer ${
                timeMode === 'real'
                  ? 'bg-blue-500/15 border border-blue-500/35 text-blue-400'
                  : 'text-gray-500 hover:text-white'
              }`}
              title="Align with standard real-time clocks"
            >
              REAL
            </button>
            <button
              onClick={() => setTimeMode('simulated')}
              className={`px-2 py-0.5 text-[9px] font-mono font-medium rounded transition-all cursor-pointer ${
                timeMode === 'simulated'
                  ? 'bg-amber-500/15 border border-amber-500/35 text-amber-400'
                  : 'text-gray-500 hover:text-white'
              }`}
              title="Accelerated simulation timeline"
            >
              FAST ⚡
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1.5 bg-[#121826] p-1 rounded-lg border border-gray-800">
            {(['1m', '5m', '1H', '1D'] as const).map((it) => (
              <button
                key={it}
                onClick={() => setTimeframe(it)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all duration-200 cursor-pointer ${
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
      </div>

      {/* Main Terminal Stage */}
      <div className="relative">
        {/* Floating TradingView Legends and Settings matching Picture 2 */}
        <div className="absolute top-2 left-2 flex items-center flex-wrap gap-2.5 bg-[#0b0f19]/85 backdrop-blur border border-gray-800/60 rounded px-2.5 py-1.5 text-[9px] font-mono text-gray-400 select-none z-10">
          <button 
            onClick={() => setShowMA10(!showMA10)} 
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title="Toggle Moving Average 10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className={showMA10 ? "text-amber-400 font-bold" : "line-through text-gray-650"}>MA (10)</span>
          </button>
          <button 
            onClick={() => setShowEMA20(!showEMA20)} 
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title="Toggle Exponential Moving Average 20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className={showEMA20 ? "text-purple-400 font-bold" : "line-through text-gray-650"}>EMA (20)</span>
          </button>
          <button 
            onClick={() => setShowFib(!showFib)} 
            className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            title="Toggle Fibonacci Retracement Levels"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span className={showFib ? "text-teal-400 font-bold" : "line-through text-gray-650"}>FIBONACCI LEVELS</span>
          </button>
        </div>

        {/* Dynamic Tooltip details on hover */}
        {hoverIndex !== null && visibleCandles[hoverIndex] && (
          <div className="absolute top-11 left-2 bg-[#121826]/95 border border-emerald-500/30 rounded p-2 text-[10px] font-mono text-gray-300 pointer-events-none z-10 shadow-lg backdrop-blur flex flex-col md:flex-row gap-2">
            <div>TIME: <span className="text-white">{visibleCandles[hoverIndex].time}</span></div>
            <div>OPEN: <span className="text-white">${visibleCandles[hoverIndex].open.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>HIGH: <span className="text-emerald-400">${visibleCandles[hoverIndex].high.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>LOW: <span className="text-rose-400">${visibleCandles[hoverIndex].low.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
            <div>CLOSE: <span className="text-white">{visibleCandles[hoverIndex].close.toFixed(activeAsset.category === 'forex' ? 4 : 2)}</span></div>
          </div>
        )}

        {/* Render Vector Graph */}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto cursor-crosshair overflow-visible select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <clipPath id="chart-viewport-clip">
              <rect x={leftMargin} y={0} width={drawableWidth} height={chartHeight} />
            </clipPath>
            <linearGradient id="left-fade-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0b0f19" stopOpacity="1" />
              <stop offset="100%" stopColor="#0b0f19" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Subtle Vertical Grid Lines (Matches Picture 2) wrapped in viewport clip */}
          <g clipPath="url(#chart-viewport-clip)">
            {visibleCandles.map((c, idx) => {
              if (idx % Math.round(zoomLevel / 7) === 0) {
                const x = getX(idx);
                return (
                  <line
                    key={`v-grid-${idx}`}
                    x1={x}
                    y1={20}
                    x2={x}
                    y2={330}
                    stroke="#1f2937"
                    strokeWidth="0.5"
                    strokeOpacity="0.2"
                    strokeDasharray="2 3"
                  />
                );
              }
              return null;
            })}
          </g>

          {/* Chart Horizontal Grid Lines (Bound to Main Candlestick Pane) */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = mainMinY + p * (mainMaxY - mainMinY);
            const gridPrice = maxPrice - p * priceRange;
            return (
              <g key={idx} className="opacity-30">
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={chartWidth - rightMargin}
                  y2={y}
                  stroke="#1f2937"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={chartWidth - rightMargin + 5}
                  y={y + 3}
                  fill="#9ca3af"
                  className="font-mono text-[9px]"
                >
                  ${gridPrice.toLocaleString(undefined, { maximumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}
                </text>
              </g>
            );
          })}

          {/* Fibonacci Retracement Levels based on Picture 2 Color Palettes */}
          {showFib && [
            { ratio: 1.0, color: '#f23645', label: '1.000 Fib (Max Resistance)' },
            { ratio: 0.786, color: '#f59e0b', label: '0.786 Fib' },
            { ratio: 0.618, color: '#eab308', label: '0.618 Fib (Golden Pocket)' },
            { ratio: 0.5, color: '#10b981', label: '0.500 Fib Neutral' },
            { ratio: 0.382, color: '#14b8a6', label: '0.382 Fib' },
            { ratio: 0.236, color: '#3b82f6', label: '0.236 Fib' },
            { ratio: 0.0, color: '#8b5cf6', label: '0.000 Fib (Min Support)' }
          ].map((level, idx) => {
            const price = minPrice + level.ratio * priceRange;
            const y = getY(price);
            return (
              <g key={`fib-${idx}`} className="opacity-70">
                <line
                  x1={leftMargin}
                  y1={y}
                  x2={chartWidth - rightMargin}
                  y2={y}
                  stroke={level.color}
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
                <text
                  x={leftMargin + 4}
                  y={y - 3}
                  fill={level.color}
                  className="font-mono text-[7px] font-semibold"
                >
                  {level.label} (${price.toLocaleString(undefined, { maximumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })})
                </text>
              </g>
            );
          })}

          {/* Viewport Clipped Dynamic Layers */}
          <g clipPath="url(#chart-viewport-clip)">
            {/* Time axis labels */}
            {visibleCandles.map((c, idx) => {
              if (idx % Math.round(zoomLevel / 5) === 0) {
                const x = getX(idx);
                return (
                  <text
                    key={idx}
                    x={x}
                    y={chartHeight - 8}
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
              
              // TradingView Premium Theme Colors
              const strokeColor = isUp ? '#089981' : '#f23645';
              const fillColor = isUp ? '#089981' : '#f23645';

              // Custom width adjustment for premium visual balance across viewports
              const candleWidth = Math.max(3.5, Math.min(13, (drawableWidth / zoomLevel) * 0.72));
              const bodyHeight = Math.max(1.8, Math.abs(closeY - openY));
              const bodyY = Math.min(openY, closeY);

              return (
                <g key={idx}>
                  {/* Wick shadow (High-Low extreme extremes) */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={strokeColor}
                    strokeWidth="1.2"
                  />
                  {/* Body candle block (Open-Close body) */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth="0.5"
                    className="hover:brightness-125 transition-all"
                  />
                </g>
              );
            })}

            {/* SMA (10) Line (Orange) */}
            {showMA10 && (
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.4"
                className="opacity-90"
                points={visibleCandles
                  .map((_, idx) => {
                    const ma = getMA(idx, 10);
                    return ma ? `${getX(idx)},${getY(ma)}` : '';
                  })
                  .filter(Boolean)
                  .join(' ')}
              />
            )}

            {/* EMA (20) Line (Purple/Indigo) */}
            {showEMA20 && (
              <polyline
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1.4"
                className="opacity-95"
                points={visibleCandles
                  .map((_, idx) => {
                    const ema = getEMA(idx, 20);
                    return ema ? `${getX(idx)},${getY(ema)}` : '';
                  })
                  .filter(Boolean)
                  .join(' ')}
              />
            )}
          </g>

          {/* Core Technical Secondary Indicator Pane Section */}
          {/* Horizontal Split-Pane Divider */}
          <line
            x1={leftMargin}
            y1={255}
            x2={chartWidth - rightMargin}
            y2={255}
            stroke="#1f2937"
            strokeWidth="0.8"
            strokeDasharray="4 4"
            strokeOpacity="0.45"
          />
          <text
            x={leftMargin}
            y={251}
            fill="#4b5563"
            className="font-mono text-[8px] font-bold uppercase tracking-wider select-none pointer-events-none"
          >
            {indicator} (14, 20) PANEL
          </text>

          {/* Volume Indicator Graph */}
          {indicator === 'VOLUME' && (
            <g clipPath="url(#chart-viewport-clip)">
              {visibleCandles.map((c, idx) => {
                const x = getX(idx);
                const maxVolume = Math.max(...visibleCandles.map(v => v.volume)) || 100;
                const barHeight = (c.volume / maxVolume) * 50;
                const y = 330 - barHeight;
                const barWidth = Math.max(2.5, Math.min(10, (drawableWidth / zoomLevel) * 0.45));
                const isUp = c.close >= c.open;
                const barColor = isUp ? 'rgba(8, 153, 129, 0.45)' : 'rgba(242, 54, 69, 0.45)';
                return (
                  <rect
                    key={`volume-${idx}`}
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={barColor}
                  />
                );
              })}
            </g>
          )}

          {/* RSI (Relative Strength Index) Graph */}
          {indicator === 'RSI' && (() => {
            const y70 = 330 - (70 / 100) * 60;
            const y50 = 330 - (50 / 100) * 60;
            const y30 = 330 - (30 / 100) * 60;
            return (
              <g>
                <rect
                  x={leftMargin}
                  y={y70}
                  width={drawableWidth}
                  height={y30 - y70}
                  fill="rgba(139, 92, 246, 0.05)"
                  stroke="rgba(139, 92, 246, 0.15)"
                  strokeWidth="0.5"
                />
                
                <line x1={leftMargin} y1={y70} x2={chartWidth - rightMargin} y2={y70} stroke="#374151" strokeWidth="0.5" strokeDasharray="1 3" />
                <line x1={leftMargin} y1={y50} x2={chartWidth - rightMargin} y2={y50} stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2 4" />
                <line x1={leftMargin} y1={y30} x2={chartWidth - rightMargin} y2={y30} stroke="#374151" strokeWidth="0.5" strokeDasharray="1 3" />
                
                <text x={chartWidth - rightMargin + 5} y={y70 + 3} fill="#8b5cf6" className="font-mono text-[7px] font-bold">70 (OB)</text>
                <text x={chartWidth - rightMargin + 5} y={y50 + 3} fill="#4b5563" className="font-mono text-[7px]">50</text>
                <text x={chartWidth - rightMargin + 5} y={y30 + 3} fill="#8b5cf6" className="font-mono text-[7px] font-bold">30 (OS)</text>

                <g clipPath="url(#chart-viewport-clip)">
                  <polyline
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.35"
                    points={visibleCandles.map((_, idx) => {
                      const rsiVal = getRSI(idx, 14);
                      const rsiY = 330 - (rsiVal / 100) * 60;
                      return `${getX(idx)},${rsiY}`;
                    }).join(' ')}
                  />
                </g>
              </g>
            );
          })()}

          {/* MACD Histogram and Curves Graph */}
          {indicator === 'MACD' && (() => {
            const macdValues = visibleCandles.map((_, idx) => getMACD(idx));
            const maxMacdAbs = Math.max(...macdValues.flatMap(m => [Math.abs(m.macd), Math.abs(m.signal), Math.abs(m.hist)])) || 0.0001;
            const getMacdY = (val: number) => {
              return 300 - (val / maxMacdAbs) * 28;
            };
            return (
              <g>
                <line x1={leftMargin} y1={300} x2={chartWidth - rightMargin} y2={300} stroke="#1f2937" strokeWidth="0.5" />
                
                <g clipPath="url(#chart-viewport-clip)">
                  {macdValues.map((v, idx) => {
                    const x = getX(idx);
                    const histY = getMacdY(v.hist);
                    const isUp = v.hist >= 0;
                    const barColor = isUp ? 'rgba(8, 153, 129, 0.45)' : 'rgba(242, 54, 69, 0.45)';
                    const barWidth = Math.max(1.5, Math.min(6, (drawableWidth / zoomLevel) * 0.4));
                    return (
                      <rect
                        key={`macd-${idx}`}
                        x={x - barWidth / 2}
                        y={isUp ? histY : 300}
                        width={barWidth}
                        height={Math.max(1, Math.abs(300 - histY))}
                        fill={barColor}
                      />
                    );
                  })}

                  <polyline
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.2"
                    points={visibleCandles.map((_, idx) => `${getX(idx)},${getMacdY(macdValues[idx].macd)}`).join(' ')}
                  />

                  <polyline
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="1.2"
                    points={visibleCandles.map((_, idx) => `${getX(idx)},${getMacdY(macdValues[idx].signal)}`).join(' ')}
                  />
                </g>
              </g>
            );
          })()}

          {/* Current Live Price Line */}
          <line
            x1={leftMargin}
            y1={getY(activeAsset.price)}
            x2={chartWidth - rightMargin}
            y2={getY(activeAsset.price)}
            stroke={activeAsset.change24h >= 0 ? '#10b981' : '#f43f5e'}
            strokeWidth="0.8"
            strokeDasharray="2 3"
          />
          <g transform={`translate(${chartWidth - rightMargin + 2}, ${getY(activeAsset.price) - 8})`}>
            <rect
              width="60"
              height="16"
              rx="3"
              fill={activeAsset.change24h >= 0 ? '#10b981' : '#f43f5e'}
            />
            <text
              x="30"
              y="11.5"
              textAnchor="middle"
              fill="#000"
              className="font-mono text-[9px] font-bold"
            >
              ${activeAsset.price.toLocaleString(undefined, { minimumFractionDigits: activeAsset.category === 'forex' ? 4 : 2 })}
            </text>
          </g>

          {/* Elegant fade mask to make older candles vanish silently on the left */}
          <rect
            x={leftMargin}
            y={0}
            width="55"
            height={chartHeight - 15}
            fill="url(#left-fade-gradient)"
            pointerEvents="none"
          />

          {/* Interactive cursor crosshair */}
          {hoverIndex !== null && (
            <g>
              {/* x-line */}
              <line
                x1={getX(hoverIndex)}
                y1="10"
                x2={getX(hoverIndex)}
                y2={345}
                stroke="#4b5563"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* y-line */}
              <line
                x1={leftMargin}
                y1={hoverPos.y}
                x2={chartWidth - rightMargin}
                y2={hoverPos.y}
                stroke="#4b5563"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
              {/* Hover Dot */}
              <circle
                cx={hoverPos.x}
                cy={hoverPos.y}
                r="3.5"
                fill="#10b981"
                stroke="#fff"
                strokeWidth="1.2"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Auxiliary chart metrics panel */}
      <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-gray-800">
        <div className="flex flex-wrap justify-between items-center gap-4 text-xs">
          {/* Overlays list */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500 uppercase font-mono font-medium mr-1.5">chart overlays:</span>
            <button
              onClick={() => setShowMA10(!showMA10)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all duration-150 cursor-pointer ${
                showMA10 ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showMA10 ? 'bg-[#fbbf24]' : 'bg-gray-650'}`} />
              MA(10)
            </button>
            <button
              onClick={() => setShowEMA20(!showEMA20)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all duration-150 cursor-pointer ${
                showEMA20 ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/40 text-[#8b5cf6]' : 'border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showEMA20 ? 'bg-[#8b5cf6]' : 'bg-gray-650'}`} />
              EMA(20)
            </button>
            <button
              onClick={() => setShowFib(!showFib)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-all duration-150 cursor-pointer ${
                showFib ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${showFib ? 'bg-teal-400' : 'bg-gray-650'}`} />
              FIBONACCI
            </button>
          </div>

          {/* Viewport scaling */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#121826] border border-gray-800 rounded-lg p-1 text-gray-400">
              <button
                onClick={() => setZoomLevel((prev) => Math.min(80, prev + 10))}
                disabled={zoomLevel >= 80}
                className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 cursor-pointer"
                title="Zoom Out (More candles)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] uppercase font-mono px-1 font-semibold">{zoomLevel}c</span>
              <button
                onClick={() => setZoomLevel((prev) => Math.max(20, prev - 10))}
                disabled={zoomLevel <= 20}
                className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 cursor-pointer"
                title="Zoom In (Fewer candles)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Secondary Indicators Choose Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500 uppercase font-mono font-medium mr-1.5">oscillators:</span>
          {(['VOLUME', 'RSI', 'MACD'] as const).map((ind) => (
            <button
              key={ind}
              onClick={() => setIndicator(ind)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded border transition-all duration-150 cursor-pointer font-bold ${
                indicator === ind
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'border-gray-800 text-gray-500 hover:text-white'
              }`}
            >
              {ind === 'VOLUME' ? '📊 VOLUME' : ind === 'RSI' ? '📈 RSI (14)' : '🌀 MACD (12,26,9)'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
