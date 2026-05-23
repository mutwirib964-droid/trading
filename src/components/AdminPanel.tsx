import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Users, DollarSign, Edit, ShieldAlert, Award, PhoneCall, RefreshCw, Layers } from 'lucide-react';

interface AdminPanelProps {
  currentUser: User;
  addToast: (msg: string, type: 'SUCCESS' | 'ERROR' | 'INFO') => void;
  onRefreshUserSession: () => void;
}

interface AdminStats {
  offline: boolean;
  totalUsers: number;
  totalMoneyDeposited: number;
  users: Array<{
    id?: string;
    email: string;
    role: string;
    wallet_balance: number;
    total_deposited: number;
  }>;
}

export default function AdminPanel({ currentUser, addToast, onRefreshUserSession }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editRole, setEditRole] = useState('user');
  
  // Sandbox test states
  const [sandboxEmail, setSandboxEmail] = useState('');
  const [sandboxAmount, setSandboxAmount] = useState('20');
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/overview?adminEmail=${encodeURIComponent(currentUser.email)}&adminUid=${encodeURIComponent(currentUser.id || '')}`);
      if (r.ok) {
        const d = await r.json();
        setStats(d);
        if (d.users && d.users.length > 0 && !selectedUserEmail) {
          setSelectedUserEmail(d.users[0].email);
          setEditBalance(String(d.users[0].wallet_balance || d.users[0].walletBalance || 0));
          setEditRole(d.users[0].role || 'user');
        }
      } else {
        addToast("Failed to fetch admin dashboard payload stats", "ERROR");
      }
    } catch (err) {
      console.error(err);
      addToast("Server network offline for administrative endpoints", "ERROR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSelectUser = (email: string) => {
    setSelectedUserEmail(email);
    const u = stats?.users.find(x => x.email === email);
    if (u) {
      // support camelCase vs snake_case
      const bal = u.wallet_balance !== undefined ? u.wallet_balance : (u as any).walletBalance || 0;
      setEditBalance(String(bal));
      setEditRole(u.role || 'user');
    }
  };

  const handleSaveUserParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserEmail) return;

    try {
      const resp = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: selectedUserEmail,
          role: editRole,
          wallet_balance: parseFloat(editBalance) || 0
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        addToast(data.message || "User properties saved successfully on the server ledger.", "SUCCESS");
        
        // If modified currently logged in user, synchronize state
        if (selectedUserEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          onRefreshUserSession();
        }
        
        // reload admin lists
        fetchStats();
      } else {
        addToast("Error updating user properties.", "ERROR");
      }
    } catch (err) {
      addToast("Failed to connect to administration controller.", "ERROR");
    }
  };

  const handleSandboxCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxEmail) {
      addToast("Please provide a target account email for M-Pesa simulation.", "ERROR");
      return;
    }

    setSandboxLoading(true);
    addToast("Executing simulated Safaricom M-Pesa IPN IP Stack transaction callback...", "INFO");

    try {
      const resp = await fetch("/api/payhero/sandbox-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: sandboxEmail,
          amount_usd: parseFloat(sandboxAmount) || 20
        })
      });

      if (resp.ok) {
        addToast(`Callback executed! Target account (${sandboxEmail}) credited successfully.`, "SUCCESS");
        // Update currently logged in state if targeting current user
        if (sandboxEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          onRefreshUserSession();
        }
        fetchStats();
      } else {
        addToast("Failed simulating network callback flow.", "ERROR");
      }
    } catch (e) {
      addToast("Administrative callback dispatch failure.", "ERROR");
    } finally {
      setSandboxLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto p-1 font-sans">
      
      {/* Title block */}
      <div className="bg-[#0b101d] border border-gray-900 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            ADMINISTRATIVE CONTROL TERMINAL
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Logged in: <span className="text-gray-300 font-bold">{currentUser.email}</span> (Elevated System Authority)
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 bg-[#121826] border border-gray-800 hover:border-emerald-500 hover:text-white px-4 py-2 text-xs font-mono font-bold uppercase rounded transition-all cursor-pointer text-gray-400"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Stats Counter metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
        <div className="bg-[#0b101d] border border-gray-900 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Total Registered Accounts</span>
            <p className="text-3xl font-extrabold text-white mt-1">
              {stats ? stats.totalUsers : "..."}
            </p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#0b101d] border border-gray-900 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Aggregate Platform Cash Flow</span>
            <p className="text-3xl font-extrabold text-emerald-400 mt-1">
              ${stats ? stats.totalMoneyDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "..."}
            </p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-lg text-emerald-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Account Directory */}
        <div className="lg:col-span-1 bg-[#0b101d] border border-gray-900 rounded-xl p-5 flex flex-col h-[500px]">
          <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest border-b border-gray-950 pb-2 mb-3">
            ACCOUNTS DIRECTORY
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xxs">
            {stats?.users && stats.users.length > 0 ? (
              stats.users.map((u) => {
                const bal = u.wallet_balance !== undefined ? u.wallet_balance : (u as any).walletBalance || 0;
                const isSelected = selectedUserEmail.toLowerCase() === u.email.toLowerCase();
                return (
                  <button
                    key={u.email}
                    onClick={() => handleSelectUser(u.email)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-emerald-950/15 border-emerald-500 text-white font-bold'
                        : 'bg-[#121826]/30 border-gray-950 text-gray-400 hover:text-gray-200 hover:bg-[#121826]/50'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="truncate max-w-[130px] font-bold">{u.email}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-widest uppercase ${
                        u.role === 'admin' ? 'bg-rose-500/15 text-rose-400' : u.role === 'marketer' ? 'bg-purple-500/15 text-purple-400' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500 text-[9px] mt-1">
                      <span>Balance: <b className="text-emerald-400">${bal.toLocaleString()}</b></span>
                      <span>Deposits: <b>${(u.total_deposited || (u as any).totalDeposited || 0).toLocaleString()}</b></span>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="text-center text-gray-600 italic py-10">No users verified on active memory ledger.</p>
            )}
          </div>
        </div>

        {/* Middle Column: Modify user panel */}
        <div className="lg:col-span-1 bg-[#0b101d] border border-gray-900 rounded-xl p-5">
          <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest border-b border-gray-950 pb-2 mb-4 flex items-center gap-1.5">
            <Edit className="w-4 h-4 text-emerald-400" />
            EDIT PARTICIPANT VALUE
          </h3>

          {selectedUserEmail ? (
            <form onSubmit={handleSaveUserParams} className="space-y-4 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-gray-500 text-[9px] uppercase font-bold block">Selected Account Email</span>
                <input
                  type="text"
                  value={selectedUserEmail}
                  className="w-full bg-gray-950 border border-gray-800 text-gray-400 rounded p-2 focus:outline-none"
                  disabled
                />
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[9px] uppercase font-bold block">Account Authority Role</span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded p-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="user">User (Standard Trader - ~25% win rate)</option>
                  <option value="marketer">Marketer (Elite Trader - ~85% win rate + Onboarding credit)</option>
                  <option value="admin">System Admin</option>
                </select>
                <div className="text-[9px] text-gray-500 leading-normal mt-1 italic">
                  Note: Elevating user to <b>marketer</b> will automatically credit their ledger with a random onboarding bonus of <b>$100 to $200</b> (credited upon form save).
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[9px] uppercase font-bold block">Real Wallet Balance ($ USD)</span>
                <input
                  type="number"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded p-2 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-500 text-black border-none font-bold uppercase rounded cursor-pointer transition-all hover:bg-emerald-400 text-[10px] tracking-wide"
              >
                PROMPT UPDATED LEDGER VALUE
              </button>
            </form>
          ) : (
            <div className="text-center py-20 text-gray-600 text-xs font-mono">
              Please select an account from the directory tree to modify attributes.
            </div>
          )}
        </div>

        {/* Right Column: Safaricom callback simulator */}
        <div className="lg:col-span-1 bg-[#0b101d] border border-gray-900 rounded-xl p-5">
          <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest border-b border-gray-950 pb-2 mb-4 flex items-center gap-1.5">
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            M-PESA WEBHOOK SIMULATOR
          </h3>

          <div className="bg-emerald-950/10 border border-emerald-500/10 p-3 rounded-lg text-xxs text-emerald-400 leading-normal mb-4">
            <span className="font-bold block mb-1">STK CALLBACK ENVELOPE</span>
            Test the entire database, callback, and balance integration seamlessly. Triggers a mock Payhero callback to instantly reward the targeted account!
          </div>

          <form onSubmit={handleSandboxCallback} className="space-y-4 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-gray-500 text-[9px] uppercase font-bold block">Target Profile Email</span>
              <select
                value={sandboxEmail}
                onChange={(e) => setSandboxEmail(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded p-2 focus:outline-none focus:border-emerald-500"
                required
              >
                <option value="">-- Choose Account --</option>
                {stats?.users.map(u => (
                  <option key={u.email} value={u.email}>{u.email}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-gray-500 text-[9px] uppercase font-bold block">Simulated Value ($ USD)</span>
              <input
                type="number"
                value={sandboxAmount}
                onChange={(e) => setSandboxAmount(e.target.value)}
                className="w-full bg-gray-950 border border-gray-800 text-white rounded p-2 focus:outline-none focus:border-emerald-500"
                min="17"
                required
              />
              <div className="text-[9px] text-gray-500 italic">
                Equates to KES {((parseFloat(sandboxAmount) || 0) * 130).toLocaleString()}
              </div>
            </div>

            <button
              type="submit"
              disabled={sandboxLoading || !sandboxEmail}
              className="w-full py-2.5 bg-[#121826] border border-gray-800 hover:border-emerald-500 text-white font-bold uppercase rounded cursor-pointer transition-all hover:text-emerald-400 text-[10px] tracking-wide flex justify-center items-center gap-1.5"
            >
              {sandboxLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> DISPATCHING IPN...
                </>
              ) : (
                "TRIGGER SIMULATED WEBHOOK"
              )}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
