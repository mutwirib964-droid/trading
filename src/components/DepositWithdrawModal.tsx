import React, { useState, useEffect } from 'react';
import { User, Transaction, getTransactionDisplayLabel } from '../types';
import { CreditCard, Landmark, Check, Copy, ArrowUpRight, ArrowDownRight, Link, RefreshCw, X, Phone } from 'lucide-react';
import { getApiUrl } from '../lib/api';

interface DepositWithdrawModalProps {
  user: User;
  onClose: () => void;
  onModifyBalance: (type: 'DEPOSIT' | 'WITHDRAWAL', amount: number, details: Omit<Transaction, 'id' | 'date' | 'status' | 'amount' | 'type'> & { phone?: string }) => void;
  transactions: Transaction[];
  addToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO') => void;
}

export default function DepositWithdrawModal({ user, onClose, onModifyBalance, transactions, addToast }: DepositWithdrawModalProps) {
  const [tab, setTab] = useState<'DEPOSIT' | 'WITHDRAW' | 'LEDGER'>('DEPOSIT');
  const [depositMethod, setDepositMethod] = useState<'MPESA' | 'CRYPTO' | 'CARD' | 'WIRE'>('MPESA');
  const [withdrawMethod, setWithdrawMethod] = useState<'MPESA' | 'CRYPTO' | 'CARD' | 'WIRE'>('MPESA');

  // Polling STK Push States
  const [stkReference, setStkReference] = useState<string | null>(null);
  const [stkStatus, setStkStatus] = useState<'PENDING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'>('PENDING');
  const [pollSecondsLeft, setPollSecondsLeft] = useState(90);
  const [stkUsdValue, setStkUsdValue] = useState(0);
  const [stkPhoneValue, setStkPhoneValue] = useState('');

  // Input states
  const [mpesaPhone, setMpesaPhone] = useState(() => {
    return user.phone || localStorage.getItem('vfx_saved_phone') || '';
  });
  const [mpesaAmt, setMpesaAmt] = useState('17');
  const [cryptoAsset, setCryptoAsset] = useState('USDT (TRC20)');
  const [cryptoAddress, setCryptoAddress] = useState('TXuGgY17pZpqyY7scT21Pz88DkUnm9vBKa');
  const [cryptoAmt, setCryptoAmt] = useState('30');
  const [cardAmt, setCardAmt] = useState('40');
  const [cardNum, setCardNum] = useState('4111 2222 3333 4444');
  const [wireAmt, setWireAmt] = useState('50');

  // Withdrawal states
  const [withdrawAmt, setWithdrawAmt] = useState('30');
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawPhoneNum, setWithdrawPhoneNum] = useState(() => {
    return user.phone || localStorage.getItem('vfx_saved_phone') || '';
  });

  // Copy states
  const [copied, setCopied] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const KES_RATE = 130;

  const handleCopy = () => {
    navigator.clipboard.writeText(cryptoAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Poll M-Pesa transaction status on active reference update
  useEffect(() => {
    if (!stkReference || stkStatus !== 'PENDING') return;

    const pollInterval = setInterval(async () => {
      try {
        const resp = await fetch(getApiUrl(`/api/payhero/check-status?reference=${encodeURIComponent(stkReference)}`));
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'COMPLETED') {
            setStkStatus('COMPLETED');
            
            // Credit real balance and log transaction on client
            onModifyBalance('DEPOSIT', stkUsdValue, {
              asset: `M-Pesa (Code: Cleared)`,
              address: `STK Ref: ${stkReference.slice(-10)}`,
              phone: stkPhoneValue
            });
          } else if (data.status === 'FAILED') {
            setStkStatus('FAILED');
            addToast("M-Pesa transaction was Cancelled or Failed.", "ERROR");
          }
        }
      } catch (err) {
        console.error("Polling error in checkout:", err);
      }
    }, 1000); // Polling every 1 second for instant responsive feedback

    return () => {
      clearInterval(pollInterval);
    };
  }, [stkReference, stkStatus, stkUsdValue, stkPhoneValue]);

  // Handle countdown tracking safely without triggering nested rendering side effects
  useEffect(() => {
    if (!stkReference || stkStatus !== 'PENDING') return;

    if (pollSecondsLeft <= 0) {
      setStkStatus('TIMEOUT');
      addToast("M-Pesa PIN prompt timed out. Please initiate a new push if needed.", "ERROR");
      
      // Persist timed out transaction to database as FAILED standard transaction
      if (user.email) {
        fetch(getApiUrl("/api/user/save-transaction"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            type: "DEPOSIT",
            amount: stkUsdValue,
            asset: "M-Pesa Mobile Push (Timed Out)",
            address: `IPN Ref: ${stkReference} (${stkPhoneValue})`,
            status: "FAILED"
          })
        }).catch((err) => console.error("Error logging timeout to database:", err));
      }
      return;
    }

    const timer = setTimeout(() => {
      setPollSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [stkReference, stkStatus, pollSecondsLeft, stkUsdValue, stkPhoneValue, user]);

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(mpesaAmt) || 0;
    if (usd < 17) {
      addToast("Minimum M-Pesa deposit is $17 (KES 2,210)", "ERROR");
      return;
    }
    if (user.accountMode === 'DEMO') {
      addToast("Deposits only work for REAL accounts.", "ERROR");
      return;
    }

    setPaymentLoading(true);
    addToast(`Initiating instant STK push request of $${usd} (KES ${(usd * KES_RATE).toLocaleString()})...`, "INFO");

    try {
      const resp = await fetch(getApiUrl("/api/payhero/stkpush"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          phone: mpesaPhone,
          amount_usd: usd
        })
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        localStorage.setItem('vfx_saved_phone', mpesaPhone);
        
        // Save polling parameters & move to waiting screen
        setStkReference(data.reference);
        setStkUsdValue(usd);
        setStkPhoneValue(mpesaPhone);
        setStkStatus('PENDING');
        setPollSecondsLeft(90);
        
        addToast("STK push sent! Please unlock your phone and enter your M-Pesa PIN.", "SUCCESS");
      } else {
        addToast(data.error || "STK Push request was rejected by Payhero network.", "ERROR");
      }
    } catch (err) {
      console.error(err);
      addToast("Network connection error initiating STK push.", "ERROR");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleStandardDeposit = (e: React.FormEvent, method: 'CRYPTO' | 'CARD' | 'WIRE') => {
    e.preventDefault();
    if (user.accountMode === 'DEMO') {
      addToast("Deposits only function on REAL trading configurations.", "ERROR");
      return;
    }

    let amt = 0;
    let assetName = 'USD (Fiat)';
    let notes = 'Clearing settlement';

    if (method === 'CRYPTO') {
      amt = parseFloat(cryptoAmt) || 0;
      if (amt < 30) {
        addToast("Minimum Crypto deposit value is $30", "ERROR");
        return;
      }
      assetName = cryptoAsset;
      notes = cryptoAddress;
    } else if (method === 'CARD') {
      amt = parseFloat(cardAmt) || 0;
      if (amt < 40) {
        addToast("Minimum Credit Card deposit is $40", "ERROR");
        return;
      }
      assetName = 'USD (Credit Card)';
      notes = `Card ending in ${cardNum.slice(-4)}`;
    } else if (method === 'WIRE') {
      amt = parseFloat(wireAmt) || 0;
      if (amt < 50) {
        addToast("Minimum Bank Wire deposit is $50", "ERROR");
        return;
      }
      assetName = 'USD (Wire transfer)';
      notes = 'Blackstone Escrow Terminal';
    }

    onModifyBalance('DEPOSIT', amt, {
      asset: assetName,
      address: notes
    });
  };

  const handleWithdrawalRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (user.accountMode === 'DEMO') {
      addToast("Withdrawals are locked in DEMO mode.", "ERROR");
      return;
    }

    const amt = parseFloat(withdrawAmt) || 0;
    let minWithdrawal = 30;

    if (withdrawMethod === 'MPESA') {
      minWithdrawal = 30;
    } else if (withdrawMethod === 'CRYPTO') {
      minWithdrawal = 40;
    } else if (withdrawMethod === 'CARD') {
      minWithdrawal = 50;
    } else if (withdrawMethod === 'WIRE') {
      minWithdrawal = 70;
    }

    if (amt < minWithdrawal) {
      addToast(`Minimum withdrawal limit for ${withdrawMethod} is $${minWithdrawal}`, "ERROR");
      return;
    }

    if (amt > user.walletBalance) {
      addToast("Insufficient funds available on your Real ledger balance", "ERROR");
      return;
    }

    if (withdrawMethod === 'MPESA') {
      localStorage.setItem('vfx_saved_phone', withdrawPhoneNum);
    }

    onModifyBalance('WITHDRAWAL', amt, {
      asset: withdrawMethod === 'MPESA' ? `M-Pesa (${withdrawPhoneNum})` : `${withdrawMethod} Network`,
      address: withdrawMethod === 'MPESA' ? withdrawPhoneNum : withdrawAddr || 'Standard Bank Destination Routing',
      phone: withdrawMethod === 'MPESA' ? withdrawPhoneNum : undefined
    });

    setWithdrawAddr('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none">
      <div className="bg-[#181A20] border border-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden text-gray-300">
        
        {/* Header navigation */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4 shrink-0">
          <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800/80">
            {(['DEPOSIT', 'WITHDRAW', 'LEDGER'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold tracking-wide rounded border-none transition-all cursor-pointer ${
                  tab === t ? 'bg-emerald-500 text-black' : 'text-gray-400 hover:text-white bg-transparent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-all bg-transparent border-none cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Blocker Indicator */}
        {user.accountMode === 'DEMO' && (
          <div className="bg-amber-950/40 border border-amber-500/20 text-amber-500 p-3 rounded-lg text-xxs font-mono mb-4 text-left leading-normal flex flex-col gap-1 shrink-0">
            <div className="font-bold flex items-center gap-1">⚠️ PRACTICE ACCOUNT LIMIT</div>
            <span>Deposits & withdrawals only apply strictly to Real portfolios. Click real mode to unlock operations.</span>
          </div>
        )}

        {/* Content staging */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {stkReference ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-4 space-y-5 font-mono">
              <div className="bg-emerald-950/25 border border-emerald-500/25 p-4 rounded-xl w-full text-left space-y-2.5">
                <span className="text-emerald-400 text-xxs block font-bold tracking-widest uppercase">
                  ● Safe Channel STK Connection Active
                </span>
                <div className="text-[10px] text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Target Phone:</span>
                    <span className="text-white font-bold">{stkPhoneValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>M-Pesa Amount:</span>
                    <span className="text-white font-bold">KES {(stkUsdValue * 130).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ledger Value:</span>
                    <span className="text-emerald-400 font-bold">${stkUsdValue.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-[8px] border-t border-gray-800/80 pt-1.5 mt-1">
                    <span>Reference Hash:</span>
                    <span className="text-gray-500 font-mono select-all truncate max-w-[150px]">{stkReference}</span>
                  </div>
                </div>
              </div>

              {stkStatus === 'PENDING' && (
                <div className="p-6 flex flex-col items-center space-y-4 w-full">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-12 h-12 bg-amber-500/10 rounded-full animate-ping" />
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-white text-xs font-bold uppercase tracking-wider">Awaiting Wallet PIN Authorization</h3>
                    <p className="text-gray-400 text-[10px] leading-relaxed max-w-xs">
                      Safaricom network STK push dispatched! Enter your 4-digit M-Pesa PIN on your phone handset to clear the payment transaction.
                    </p>
                  </div>


                  {/* Countdown tracker is hidden as immediate API feedback is active */}


                </div>
              )}

              {stkStatus === 'COMPLETED' && (
                <div className="p-6 flex flex-col items-center space-y-4 w-full">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-emerald-400 text-xs font-bold uppercase tracking-widest font-display">SUCCESS CALLBACK CONFIRMED</h3>
                    <p className="text-gray-300 text-xxs font-semibold leading-relaxed max-w-sm">
                      Payhero gateway cleared. NetacoinFX has successfully synced ${stkUsdValue} USD to your account ledger!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStkReference(null);
                      onClose();
                    }}
                    className="w-full max-w-xs py-2 bg-emerald-500 hover:bg-emerald-400 text-black border-none font-bold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-all"
                  >
                    Done & Refresh Dashboard
                  </button>
                </div>
              )}

              {stkStatus === 'FAILED' && (
                <div className="p-6 flex flex-col items-center space-y-4 w-full">
                  <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center font-bold text-sm">
                    ✕
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-rose-400 text-xs font-bold uppercase tracking-widest">TRANSACTION FAILED</h3>
                    <p className="text-gray-400 text-xxs leading-relaxed max-w-sm">
                      The M-Pesa STK push transaction was cancelled, expired, or rejected. Please verify your line balance and retry.
                    </p>
                  </div>

                  <div className="flex gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => setStkReference(null)}
                      className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white border-none font-bold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-all"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStkReference(null);
                        onClose();
                      }}
                      className="flex-1 py-2 bg-gray-950 hover:bg-gray-900 text-gray-400 border border-gray-800 font-bold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {stkStatus === 'TIMEOUT' && (
                <div className="p-6 flex flex-col items-center space-y-4 w-full">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full flex items-center justify-center font-bold text-sm">
                    ⏳
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-amber-500 text-xs font-bold uppercase tracking-widest">TRANSACTION TIMED OUT</h3>
                    <p className="text-gray-400 text-xxs leading-relaxed max-w-sm font-semibold">
                      We did not receive any callback response from Safaricom carrier within 90 seconds.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStkReference(null)}
                    className="w-full max-w-xs py-2 bg-emerald-500 hover:bg-emerald-400 text-black border-none font-bold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-all"
                  >
                    Initiate New STK Request
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* TAB 1: DEPOSITS PORTAL */}
              {tab === 'DEPOSIT' && (
                <div className="space-y-4">
                  {/* Selector methods */}
                  <div className="grid grid-cols-4 gap-1 sm:gap-2 font-mono text-[9px] sm:text-[10px]">
                    {[
                      { id: 'MPESA', label: 'M-Pesa', icon: Phone },
                      { id: 'CRYPTO', label: 'Crypto', icon: Link },
                      { id: 'CARD', label: 'Card', icon: CreditCard },
                      { id: 'WIRE', label: 'Wire', icon: Landmark }
                    ].map((m) => {
                      const IconComp = m.icon;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setDepositMethod(m.id as any)}
                          className={`flex flex-col items-center gap-1.5 py-2 rounded-lg border transition-all cursor-pointer ${
                            depositMethod === m.id
                              ? 'border-emerald-500 bg-emerald-950/15 text-emerald-400 font-bold'
                              : 'border-gray-800 text-gray-500 hover:text-gray-300 bg-transparent'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* METHOD 1.0: Mpesa Kenya Payhero */}
                  {depositMethod === 'MPESA' && (
                    <form onSubmit={handleMpesaDeposit} className="space-y-4 text-left font-mono text-xs">
                      <div className="bg-emerald-950/20 border border-emerald-500/10 p-3 rounded-lg text-xxs text-emerald-400 leading-normal">
                        <span className="font-bold block mb-1">PAYHERO M-PESA INSTANT PORTAL</span>
                        Initiate an instant STK push to your Safaricom mobile phone. Minimum deposit limit is <b className="text-white">$17 (KES 2,210)</b>.
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-gray-500 text-[9px] uppercase font-bold">SAFARICOM M-PESA PHONE NUMBER</span>
                        <input
                          type="text"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          placeholder="Format: 2547XXXXXXXX or 07XXXXXXXX"
                          disabled={paymentLoading}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-500 uppercase font-bold">DEPOSIT QUANTITY (USD)</span>
                          <span className="text-emerald-400 font-bold">Min: $17</span>
                        </div>
                        <div className="relative flex items-center bg-gray-950 border border-gray-800 rounded-lg">
                          <input
                            type="number"
                            value={mpesaAmt}
                            onChange={(e) => setMpesaAmt(e.target.value)}
                            className="w-full bg-transparent border-none text-white py-2 pl-3 pr-10 focus:outline-none text-xs"
                            min="17"
                            disabled={paymentLoading}
                            required
                          />
                          <span className="absolute right-3 text-gray-500 text-xxs font-bold">USD</span>
                        </div>
                        <div className="text-[10px] text-gray-500 italic">
                          Equates to: <span className="text-white font-bold">KES {((parseFloat(mpesaAmt) || 0) * KES_RATE).toLocaleString()}</span> (at exchange rate KES {KES_RATE}/$)
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-emerald-500 text-black border-none font-bold text-[10px] tracking-widest uppercase rounded cursor-pointer transition-all hover:bg-emerald-400 font-mono flex items-center justify-center gap-1.5"
                        disabled={paymentLoading || user.accountMode === 'DEMO'}
                      >
                        {paymentLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> DISPATCHING STK PUSH SEND...
                          </>
                        ) : (
                          "INITIATE Safaricom M-Pesa push"
                        )}
                      </button>
                    </form>
                  )}

                  {/* METHOD 1.1: Crypto Address */}
                  {depositMethod === 'CRYPTO' && (
                    <div className="space-y-4">
                      <form onSubmit={(e) => handleStandardDeposit(e, 'CRYPTO')} className="space-y-3.5 text-left font-mono text-xs">
                        <span className="text-gray-500 text-[9px] uppercase font-bold">CHOOSE DEPOSIT CHAIN</span>
                        <select
                          value={cryptoAsset}
                          onChange={(e) => {
                            setCryptoAsset(e.target.value);
                            setCryptoAddress(e.target.value.includes('BTC') ? 'bc1qxy2kg3ut78dhzy03fhfvt67ff8tfthp9v68drc' : 'TXuGgY17pZpqyY7scT21Pz88DkUnm9vBKa');
                          }}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option>USDT (TRC20)</option>
                          <option>USDT (ERC20)</option>
                          <option>USDC (SOLANA)</option>
                          <option>Bitcoin (BTC)</option>
                        </select>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-gray-500 uppercase font-bold">DEPOSIT QUANTITY (USD)</span>
                            <span className="text-emerald-400 font-bold">Min: $30</span>
                          </div>
                          <input
                            type="number"
                            value={cryptoAmt}
                            onChange={(e) => setCryptoAmt(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                            min="30"
                            required
                          />
                        </div>

                        <div className="space-y-1.5 bg-gray-950/60 p-3.5 rounded-lg border border-gray-800 font-mono">
                          <div className="flex justify-between items-center text-[9px] text-gray-500">
                            <span>OFFICIAL ADDRESS (COPY)</span>
                            <span className="text-emerald-400 font-bold">Instant Credit</span>
                          </div>
                          <div className="flex items-center gap-2 bg-gray-900 p-2 rounded border border-gray-800">
                            <span className="flex-1 text-white font-mono text-xxs truncate tracking-wide select-all">{cryptoAddress}</span>
                            <button
                              type="button"
                              onClick={handleCopy}
                              className="bg-gray-950 hover:bg-emerald-500 hover:text-black p-1.5 border-none rounded transition-all cursor-pointer flex items-center justify-center text-xs"
                            >
                              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                            </button>
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={user.accountMode === 'DEMO'}
                          className="w-full py-2 bg-emerald-500 text-black border-none font-bold text-[10px] uppercase rounded-md transition-all tracking-wider cursor-pointer"
                        >
                          CLEAR FIAT DEPOSIT VALUE
                        </button>
                      </form>
                    </div>
                  )}

                  {/* METHOD 1.2: Credit Card */}
                  {depositMethod === 'CARD' && (
                    <form onSubmit={(e) => handleStandardDeposit(e, 'CARD')} className="space-y-4 font-mono text-xs text-left">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-500 uppercase font-bold">DEPOSIT VALUE (USD)</span>
                          <span className="text-emerald-400 font-bold">Min: $40</span>
                        </div>
                        <input
                          type="number"
                          value={cardAmt}
                          onChange={(e) => setCardAmt(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          min="40"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-gray-500 text-[9px] uppercase font-bold">CREDIT CARD NUMBER</span>
                        <input
                          type="text"
                          value={cardNum}
                          onChange={(e) => setCardNum(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="text-gray-500 text-[9px] uppercase font-bold">EXP DATE</span>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-gray-500 text-[9px] uppercase font-bold">CVC/CVV CODE</span>
                          <input
                            type="password"
                            placeholder="***"
                            maxLength={3}
                            className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={user.accountMode === 'DEMO'}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 border-none text-black font-bold text-[10px] uppercase tracking-wide rounded transition-all cursor-pointer"
                      >
                        SUBMIT TRANSACTION GATEWAY
                      </button>
                    </form>
                  )}

                  {/* METHOD 1.3: Bank Wire */}
                  {depositMethod === 'WIRE' && (
                    <form onSubmit={(e) => handleStandardDeposit(e, 'WIRE')} className="space-y-4 font-mono text-xs text-left">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-500 uppercase font-bold">WIRE VALUE (USD)</span>
                          <span className="text-emerald-400 font-bold">Min: $50</span>
                        </div>
                        <input
                          type="number"
                          value={wireAmt}
                          onChange={(e) => setWireAmt(e.target.value)}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          min="50"
                          required
                        />
                      </div>

                      <div className="bg-[#121826]/40 p-3.5 rounded-xl border border-gray-800 space-y-2.5 font-mono text-xxs font-semibold text-gray-400">
                        <span className="text-gray-500 text-[9px] uppercase font-bold block mb-1">RECEIVING INSTITUTION CHANNELS</span>
                        
                        <div className="space-y-1.5 border-t border-gray-800 pt-1.5 text-[10px]">
                          <div className="flex justify-between">
                            <span>Beneficiary:</span>
                            <span className="text-white">NetacoinFX Cleared Escrow Solutions</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Receiving Bank:</span>
                            <span className="text-white">Blackstone Clearing PLC</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Swift Code:</span>
                            <span className="text-white">BKSTUS33XXX</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Account Routing:</span>
                            <span className="text-white">0924-814-118-202</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Reference comment:</span>
                            <span className="text-emerald-400 font-bold">User_{user.email.split('@')[0]}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={user.accountMode === 'DEMO'}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 border-none text-black font-bold text-[10px] uppercase tracking-wide rounded transition-all cursor-pointer"
                      >
                        POST WIRE VERIFICATION LOG
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: WITHDRAWAL FORM */}
              {tab === 'WITHDRAW' && (
                <form onSubmit={handleWithdrawalRequest} className="space-y-4 text-left font-mono text-xs">
                  
                  <div className="space-y-1.5">
                    <span className="text-gray-500 text-[9px] uppercase font-bold">SELECT WITHDRAWAL SYSTEM</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['MPESA', 'CRYPTO', 'CARD', 'WIRE'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setWithdrawMethod(method)}
                          className={`py-1.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                            withdrawMethod === method
                              ? 'bg-emerald-500 text-black border-emerald-500'
                              : 'bg-transparent text-gray-400 border-gray-800 hover:text-white'
                          }`}
                        >
                          {method === 'MPESA' ? 'M-Pesa' : method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {withdrawMethod === 'MPESA' ? (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-gray-500 text-[9px] uppercase font-bold">SAFARICOM REGISTERED M-PESA PHONE</span>
                        <input
                          type="text"
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          value={withdrawPhoneNum}
                          onChange={(e) => setWithdrawPhoneNum(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-500 uppercase font-bold">DISBURSEMENT AMOUNT (USD)</span>
                          <span className="text-emerald-400 font-bold">Min: $30</span>
                        </div>
                        <div className="relative flex items-center bg-gray-950 border border-gray-800 rounded-lg">
                          <input
                            type="number"
                            className="w-full bg-transparent border-none text-white py-2 pl-3 pr-10 focus:outline-none"
                            value={withdrawAmt}
                            onChange={(e) => setWithdrawAmt(e.target.value)}
                            min="30"
                            required
                          />
                          <span className="absolute right-3 text-gray-500 text-xxs font-bold">USD</span>
                        </div>
                        <p className="text-[10px] text-gray-500 italic">
                          Equates to: <span className="text-white font-bold">KES {((parseFloat(withdrawAmt) || 0) * KES_RATE).toLocaleString()}</span> sent straight to your phone.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <span className="text-gray-500 text-[9px] uppercase font-bold">DESTINATION SPECIFICATIONS Address / IBAN</span>
                        <input
                          type="text"
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          placeholder={withdrawMethod === 'CRYPTO' ? "Enter recipient ERC20 or TRC20 destination wallet" : "Enter banking Swift/Aba Routing & Account details"}
                          value={withdrawAddr}
                          onChange={(e) => setWithdrawAddr(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-500 uppercase font-bold">DISBURSEMENT VALUE (USD)</span>
                          <span className="text-emerald-400 font-bold">
                            Min: {withdrawMethod === 'CRYPTO' ? '$40' : withdrawMethod === 'CARD' ? '$50' : '$70'}
                          </span>
                        </div>
                        <input
                          type="number"
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500"
                          value={withdrawAmt}
                          onChange={(e) => setWithdrawAmt(e.target.value)}
                          min={withdrawMethod === 'CRYPTO' ? "40" : withdrawMethod === 'CARD' ? "50" : "70"}
                          required
                        />
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={user.accountMode === 'DEMO'}
                    className="w-full py-2 bg-emerald-500 text-[#0b0f19] border-none font-bold text-[11px] uppercase tracking-wide rounded cursor-pointer transition-all hover:bg-emerald-400"
                  >
                    REQUEST LEDGER DISBURSEMENT
                  </button>
                </form>
              )}

              {/* TAB 3: TRANSACTION HISTORIC LEDGER */}
              {tab === 'LEDGER' && (
                <div className="space-y-3 text-left">
                  <span className="text-gray-500 text-[9px] font-mono uppercase font-bold">HISTORICAL CLEARANCE LOGS</span>

                  {transactions.length === 0 ? (
                    <div className="border border-dashed border-gray-800 rounded-lg p-8 text-center text-xs text-gray-500 font-mono">
                      No historical entries registered. Credit some assets above to populate ledger flows.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                      {transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="bg-gray-950/60 p-3 rounded-lg border border-gray-800/80 flex justify-between items-center font-mono text-[10px]"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded ${
                              tx.type === 'DEPOSIT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {tx.type === 'DEPOSIT' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-white font-bold uppercase tracking-wider">{getTransactionDisplayLabel(tx)}</p>
                              <p className="text-gray-500 text-[9px]">{new Date(tx.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                              {tx.address && <p className="text-gray-600 text-[8px] truncate max-w-[150px]">{tx.address}</p>}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className={`font-bold ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {tx.type === 'DEPOSIT' ? '+' : '-'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-bold ${
                              tx.status === 'COMPLETED' ? 'bg-emerald-950/20 border border-emerald-990/40 text-emerald-400' : 'bg-amber-950/25 border border-amber-500/20 text-amber-500'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
