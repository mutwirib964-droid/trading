import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { 
  Users, DollarSign, Edit, ShieldAlert, PhoneCall, 
  RefreshCw, Search, MoreVertical, Check, X, ShieldCheck, 
  Trash, ArrowLeftRight, Layers, CreditCard, ChevronDown, Mail
} from 'lucide-react';
import { getApiUrl } from '../lib/api';

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
    name?: string;
    role: string;
    wallet_balance: number;
    total_deposited: number;
    demo_wallet_balance?: number;
    is_kyc_verified?: string;
    created_at?: string;
  }>;
  transactions?: Array<{
    id: string;
    email?: string;
    user_email?: string;
    type: string;
    amount: number;
    asset: string;
    address?: string;
    status: string;
    created_at?: string;
  }>;
}

export default function AdminPanel({ currentUser, addToast, onRefreshUserSession }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'users' | 'transactions'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action menus state
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  
  // Modal Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalUserEmail, setModalUserEmail] = useState('');
  const [modalRealBalance, setModalRealBalance] = useState('');
  const [modalDemoBalance, setModalDemoBalance] = useState('');
  const [modalRole, setModalRole] = useState('user');
  const [modalKyc, setModalKyc] = useState('unverified');
  
  // MPesa Simulator states
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simUserEmail, setSimUserEmail] = useState('');
  const [simAmount, setSimAmount] = useState('20');
  const [simLoading, setSimLoading] = useState(false);

  const statsMenuRef = useRef<HTMLDivElement>(null);

  // Close actions menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenuUserId && !(event.target as HTMLElement).closest('.actions-container')) {
        setOpenMenuUserId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuUserId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const url = getApiUrl(`/api/admin/overview?adminEmail=${encodeURIComponent(currentUser.email)}&adminUid=${encodeURIComponent(currentUser.id || '')}`);
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        setStats(d);
      } else {
        addToast("Failed to fetch administrative records", "ERROR");
      }
    } catch (err) {
      console.error(err);
      addToast("Administrative backend offline", "ERROR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleOpenEditModal = (user: any) => {
    setModalUserEmail(user.email);
    setModalRealBalance(String(user.wallet_balance ?? 0));
    setModalDemoBalance(String(user.demo_wallet_balance ?? 10000));
    setModalRole(user.role || 'user');
    setModalKyc(user.is_kyc_verified || 'unverified');
    setIsEditModalOpen(true);
    setOpenMenuUserId(null);
  };

  const handleSaveUserParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUserEmail) return;

    try {
      const resp = await fetch(getApiUrl("/api/admin/update-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: modalUserEmail,
          role: modalRole,
          wallet_balance: parseFloat(modalRealBalance) || 0,
          demo_wallet_balance: parseFloat(modalDemoBalance) || 0,
          is_kyc_verified: modalKyc
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        addToast("User properties adjusted successfully.", "SUCCESS");
        setIsEditModalOpen(false);
        
        if (modalUserEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          onRefreshUserSession();
        }
        fetchStats();
      } else {
        addToast("Could not update selected member.", "ERROR");
      }
    } catch (err) {
      addToast("Network failure. Properties unchanged.", "ERROR");
    }
  };

  const handleOnRoleDropdownChange = async (email: string, newRole: string) => {
    try {
      const targetUser = stats?.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!targetUser) return;

      const resp = await fetch(getApiUrl("/api/admin/update-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: email,
          role: newRole,
          wallet_balance: targetUser.wallet_balance
        })
      });

      if (resp.ok) {
        addToast(`Role reassigned to ${newRole.toUpperCase()} instantly.`, "SUCCESS");
        if (email.toLowerCase() === currentUser.email.toLowerCase()) {
          onRefreshUserSession();
        }
        fetchStats();
      } else {
        addToast("Unable to reassign role authority.", "ERROR");
      }
    } catch (e) {
      addToast("Connection error while assigning role.", "ERROR");
    }
  };

  const handleOnKycToggle = async (email: string, currentKyc: string) => {
    const nextKyc = currentKyc === 'verified' ? 'unverified' : 'verified';
    try {
      const targetUser = stats?.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!targetUser) return;

      const resp = await fetch(getApiUrl("/api/admin/update-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: email,
          role: targetUser.role,
          wallet_balance: targetUser.wallet_balance,
          is_kyc_verified: nextKyc
        })
      });

      if (resp.ok) {
        addToast(`KYC status updated to ${nextKyc.toUpperCase()}.`, "SUCCESS");
        fetchStats();
      } else {
        addToast("Failed to modify KYC status.", "ERROR");
      }
    } catch (err) {
      addToast("Network failure. KYC unchanged.", "ERROR");
    }
    setOpenMenuUserId(null);
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete account ${email}? This destroys their database and transaction record irreversibly.`)) {
      return;
    }

    try {
      const resp = await fetch(getApiUrl("/api/admin/delete-user"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: email
        })
      });

      if (resp.ok) {
        addToast(`Account record for ${email} has been erased.`, "SUCCESS");
        fetchStats();
      } else {
        addToast("Error removing member from cluster.", "ERROR");
      }
    } catch (err) {
      addToast("Endpoint issue. No actions performed.", "ERROR");
    }
    setOpenMenuUserId(null);
  };

  const handleOpenSimulator = (email: string) => {
    setSimUserEmail(email);
    setSimAmount("20");
    setIsSimulatorOpen(true);
    setOpenMenuUserId(null);
  };

  const handleDispatchSandboxCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simUserEmail) return;

    setSimLoading(true);
    addToast("Executing Safaricom M-Pesa sandbox transaction...", "INFO");

    try {
      const resp = await fetch(getApiUrl("/api/payhero/sandbox-trigger"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: currentUser.email,
          adminUid: currentUser.id || '',
          email: simUserEmail,
          amount_usd: parseFloat(simAmount) || 20
        })
      });

      if (resp.ok) {
        addToast(`M-Pesa simulator callback captured! Account credited with $${simAmount}.`, "SUCCESS");
        setIsSimulatorOpen(false);
        if (simUserEmail.toLowerCase() === currentUser.email.toLowerCase()) {
          onRefreshUserSession();
        }
        fetchStats();
      } else {
        addToast("Error matching MPesa inbound reference.", "ERROR");
      }
    } catch (e) {
      addToast("Administrative callback execution error.", "ERROR");
    } finally {
      setSimLoading(false);
    }
  };

  // Generate deterministic referral codes (matching MKT-XXXXXX format in screenshots)
  const getReferralCode = (email: string) => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hex = Math.abs(hash).toString(16).substring(0, 6).toUpperCase().padStart(6, '9');
    return `MKT-${hex}`;
  };

  const getInitials = (email: string, name?: string) => {
    if (name && name.trim().length > 0) {
      return name.trim().charAt(0).toUpperCase();
    }
    return email.charAt(0).toUpperCase();
  };

  const formatJoinedDate = (createdAt?: string) => {
    if (!createdAt) return '5/22/2026';
    try {
      const d = new Date(createdAt);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } catch {
      return '5/22/2026';
    }
  };

  // Filter records
  const filteredUsers = (stats?.users || []).filter(u => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    const nameToTest = (u.name || '').toLowerCase();
    const emailToTest = u.email.toLowerCase();
    const roleToTest = (u.role || '').toLowerCase();
    return nameToTest.includes(term) || emailToTest.includes(term) || roleToTest.includes(term);
  });

  const filteredTransactions = (stats?.transactions || []).filter(tx => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    const mailToTest = (tx.email || tx.user_email || '').toLowerCase();
    const refToTest = (tx.address || '').toLowerCase();
    const typeToTest = (tx.type || '').toLowerCase();
    const assetToTest = (tx.asset || '').toLowerCase();
    return mailToTest.includes(term) || refToTest.includes(term) || typeToTest.includes(term) || assetToTest.includes(term);
  });

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto p-4 font-sans bg-[#070b13] rounded-2xl border border-gray-800 shadow-2xl">
      
      {/* Upper stats blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-[#0b0f19] border border-gray-850 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">TOTAL REGISTERED USERS</span>
            <p id="admin-user-count" className="text-2xl font-black text-white mt-1 font-mono">
              {stats ? stats.totalUsers : 2}
            </p>
          </div>
          <div className="bg-[#1e293b] p-3.5 rounded-xl text-blue-400 border border-blue-500/10">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0b0f19] border border-gray-850 rounded-2xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">TOTAL DEPOSITS IN</span>
            <p id="admin-aggregate-vol" className="text-2xl font-black text-emerald-400 mt-1 font-mono">
              ${stats ? stats.totalMoneyDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$1,000.00"}
            </p>
          </div>
          <div className="bg-emerald-500/10 p-3.5 rounded-xl text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Layout & Search Bar Header Bar */}
      <div className="bg-[#0b0f19] border border-gray-850 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        
        {/* Navigation Tabs Pillbox */}
        <div className="flex bg-[#05070a] p-1 rounded-xl border border-gray-800/80 self-start">
          <button
            onClick={() => { setCurrentTab('users'); setOpenMenuUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'users'
                ? 'bg-emerald-500 text-black shadow-lg font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users
          </button>
          <button
            onClick={() => { setCurrentTab('transactions'); setOpenMenuUserId(null); }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentTab === 'transactions'
                ? 'bg-emerald-500 text-black shadow-lg font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Transactions
          </button>
        </div>

        {/* Global Directory Search Bar */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={currentTab === 'users' ? "Search users by email, name or role..." : "Search transactions..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#05070a] border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500 text-white placeholder-gray-600"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-2 py-1 text-gray-500 hover:text-gray-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Refresh Command Button */}
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 border border-gray-800 hover:border-emerald-500 hover:text-emerald-400 text-gray-400 px-4 py-2 text-[11px] font-bold uppercase rounded-xl transition-all cursor-pointer bg-[#05070a]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Re-aligning..." : "Sync Records"}
        </button>

      </div>

      {/* Primary Users Tab Content */}
      <div className="bg-[#0b0f19] border border-gray-850 rounded-2xl overflow-hidden shadow-lg">
        {currentTab === 'users' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#05070a] border-b border-gray-850 text-[10px] font-bold text-gray-500 tracking-wider">
                  <th className="py-4 px-6 uppercase">USER DETAILS</th>
                  <th className="py-4 px-4 uppercase">ROLE & STATUS</th>
                  <th className="py-4 px-4 uppercase">ACCOUNT BALANCES</th>
                  <th className="py-4 px-4 uppercase">CASH FLOW</th>
                  <th className="py-4 px-6 text-right uppercase">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850 text-xs">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => {
                    const dynamicName = u.name || u.email.split('@')[0];
                    const rawEmail = u.email;
                    const isCurrentUser = currentUser.email.toLowerCase() === rawEmail.toLowerCase();
                    const isKycVerifiedState = u.is_kyc_verified === 'verified';

                    return (
                      <tr key={u.email} className="hover:bg-gray-900/40 border-b border-gray-850/60 transition-all text-gray-300">
                        {/* USER DETAILS */}
                        <td className="py-4 px-6 select-text">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm flex items-center justify-center shadow-md">
                              {getInitials(u.email, u.name)}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-white leading-snug truncate">
                                {dynamicName}
                              </h4>
                              {/* Respective Email - Completely visible, select-all-enabled */}
                              <div className="text-gray-400 text-[11px] font-semibold leading-normal select-all flex items-center gap-1 hover:text-emerald-400 transition-colors">
                                <Mail className="w-3 h-3 text-gray-500" />
                                {rawEmail}
                              </div>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                ID: <span className="select-all">{u.id ? u.id.substring(0, 8) : 'auth_key'}...</span>
                              </p>
                              <span className="text-[10px] text-gray-500 block mt-0.5">
                                Joined: {formatJoinedDate(u.created_at)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ROLE & STATUS */}
                        <td className="py-4 px-4">
                          <div className="flex flex-col gap-1.5">
                            {/* Interactive Select Role Dropdown */}
                            <div className="relative inline-block w-28">
                              <select
                                value={u.role || 'user'}
                                onChange={(e) => handleOnRoleDropdownChange(rawEmail, e.target.value)}
                                className="w-full appearance-none bg-[#05070a] border border-gray-800 hover:border-gray-700 text-white px-2.5 py-1 pr-6 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500/60 cursor-pointer text-ellipsis overflow-hidden font-sans"
                              >
                                <option value="user" className="bg-[#0b0f19] text-white">User</option>
                                <option value="marketer" className="bg-[#0b0f19] text-white">Marketer</option>
                                {u.role === 'admin' && <option value="admin" className="bg-[#0b0f19] text-white">Admin</option>}
                              </select>
                              <ChevronDown className="absolute right-2 top-2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>

                            {/* KYC Pill badge */}
                            <div>
                              {isKycVerifiedState ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider bg-[#10b981]/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                  VERIFIED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                  NOT_VERIFIED
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ACCOUNT BALANCES */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5">
                            <div>
                              <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider block">REAL BALANCE</span>
                              <button 
                                onClick={() => handleOpenEditModal(u)}
                                className="text-xs font-bold text-white border-b border-dashed border-gray-700 hover:text-emerald-400 hover:border-emerald-400 text-left transition"
                                title="Click to edit real/demo account balance"
                              >
                                ${(u.wallet_balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </button>
                            </div>
                            <div>
                              <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider block">DEMO BALANCE</span>
                              <span className="text-xs font-bold text-gray-300">
                                ${(u.demo_wallet_balance ?? 10000).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* CASH FLOW */}
                        <td className="py-4 px-4">
                          <div className="space-y-1.5">
                            <div>
                              <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider block">DEPOSITS</span>
                              <span className="text-xs font-bold text-emerald-400 block">
                                ${(u.total_deposited ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 text-[9px] uppercase font-bold tracking-wider block">WITHDRAWALS</span>
                              <span className="text-xs font-bold text-rose-400 block">$0.00</span>
                            </div>
                          </div>
                        </td>

                        {/* ACTION */}
                        <td className="py-4 px-6 text-right relative font-sans">
                          {isCurrentUser ? (
                            <span className="text-[10px] text-gray-500 italic">Self (Admin)</span>
                          ) : (
                            <div className="inline-block text-left actions-container">
                              <button
                                onClick={() => setOpenMenuUserId(openMenuUserId === u.email ? null : u.email)}
                                className="p-1.5 rounded-lg border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white hover:bg-gray-900/50 focus:outline-none transition inline-flex items-center"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown Flyout Panel */}
                              {openMenuUserId === u.email && (
                                <div className="absolute right-6 mt-1 w-48 bg-[#0b0f19] border border-gray-800 rounded-xl shadow-2xl z-50 py-1.5 divide-y divide-gray-850 text-left overflow-hidden text-xs">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleOpenEditModal(u)}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-900 text-gray-200 flex items-center gap-2 font-semibold"
                                    >
                                      <Edit className="w-3.5 h-3.5 text-blue-400" />
                                      Adjust Balances
                                    </button>
                                    <button
                                      onClick={() => handleOnKycToggle(rawEmail, u.is_kyc_verified || 'unverified')}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-900 text-gray-200 flex items-center gap-2 font-semibold"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                      {isKycVerifiedState ? "Revoke Verification" : "Verify KYC"}
                                    </button>
                                    <button
                                      onClick={() => handleOpenSimulator(rawEmail)}
                                      className="w-full text-left px-4 py-2 hover:bg-gray-900 text-emerald-400 flex items-center gap-2 font-semibold"
                                    >
                                      <PhoneCall className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                      Mock M-Pesa Hook
                                    </button>
                                  </div>
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleDeleteUser(rawEmail)}
                                      className="w-full text-left px-4 py-2 hover:bg-rose-950/20 text-rose-400 flex items-center gap-2 font-bold"
                                    >
                                      <Trash className="w-3.5 h-3.5 text-rose-500" />
                                      Erase Profile
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500 italic">
                      Zero profile records matching search parameter found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TRANSACTION TAB */
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#05070a] border-b border-gray-850 text-[10px] font-bold text-gray-500 tracking-wider">
                  <th className="py-4 px-6 uppercase">TRANSACTION ID</th>
                  <th className="py-4 px-4 uppercase">CLIENT EMAIL</th>
                  <th className="py-4 px-4 uppercase">CLASSIFICATION</th>
                  <th className="py-4 px-4 uppercase">VOLUME</th>
                  <th className="py-4 px-4 uppercase">CHANNELS REFERENCE</th>
                  <th className="py-4 px-4 uppercase">TIMESTAMP</th>
                  <th className="py-4 px-6 text-right uppercase">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => {
                    const isDeposit = tx.type === 'DEPOSIT';
                    const txEmail = tx.email || tx.user_email || 'anonymous@netacoinfx.com';
                    return (
                      <tr key={tx.id} className="hover:bg-gray-900/40 border-b border-gray-850/60 transition-all text-gray-350">
                        {/* ID */}
                        <td className="py-4 px-6 font-mono text-[10px] select-all font-bold text-gray-500">
                          {tx.id || 'N/A'}
                        </td>
                        {/* CLIENT EMAIL */}
                        <td className="py-4 px-4 select-all font-semibold text-gray-200">
                          {txEmail}
                        </td>
                        {/* CLASSIFICATION */}
                        <td className="py-4 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-mono font-bold tracking-wide uppercase ${
                            isDeposit ? 'bg-[#10b981]/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#f43f5e]/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        {/* VOLUME */}
                        <td className="py-4 px-4 font-bold">
                          <span className={isDeposit ? 'text-emerald-400' : 'text-rose-450'}>
                            {isDeposit ? '+' : '-'}${Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        {/* CHANNELS REFERENCE */}
                        <td className="py-4 px-4 text-gray-400 min-w-[150px]">
                          <div className="font-semibold text-gray-200">{tx.asset || 'Credit Transfer'}</div>
                          <div className="text-[10px] text-gray-500 font-mono select-all">{tx.address || 'Local Clearing'}</div>
                        </td>
                        {/* TIMESTAMP */}
                        <td className="py-4 px-4 text-gray-500 text-[10px] font-mono">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent Session'}
                        </td>
                        {/* STATUS */}
                        <td className="py-4 px-6 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8.5px] font-bold font-mono tracking-wider bg-[#10b981]/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            {tx.status || 'COMPLETED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500 italic">
                      No administrative transactions matching.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP MODAL: ADJUST BALANCES */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-100 p-4">
          <div className="bg-[#0b0f19] rounded-3xl border border-gray-800 shadow-2xl max-w-md w-full overflow-hidden p-6 font-sans">
            <div className="flex justify-between items-center pb-4 border-b border-gray-850">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Edit className="w-4 h-4 text-blue-400" />
                ADJUST TRADING LEDGER
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-900 text-gray-550 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserParams} className="space-y-4 text-xs mt-4">
              <div className="space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Account Mail Index</span>
                <input
                  type="text"
                  value={modalUserEmail}
                  disabled
                  className="w-full bg-[#05070a] border border-gray-850 text-gray-400 rounded-xl p-3 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Real Balance ($ USD)</span>
                  <input
                    type="number"
                    step="any"
                    value={modalRealBalance}
                    onChange={(e) => setModalRealBalance(e.target.value)}
                    required
                    className="w-full bg-[#05070a] border border-gray-800 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Demo Balance ($ USD)</span>
                  <input
                    type="number"
                    step="any"
                    value={modalDemoBalance}
                    onChange={(e) => setModalDemoBalance(e.target.value)}
                    required
                    className="w-full bg-[#05070a] border border-gray-800 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Access Role Authority</span>
                <select
                  value={modalRole}
                  onChange={(e) => setModalRole(e.target.value)}
                  className="w-full bg-[#05070a] border border-gray-800 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="user" className="bg-[#0b0f19] text-white">User (Standard account)</option>
                  <option value="marketer" className="bg-[#0b0f19] text-white">Marketer (Elite account)</option>
                  {modalRole === 'admin' && (
                    <option value="admin" className="bg-[#0b0f19] text-white">Administrator (Elevated command access)</option>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold block">KYC Verification Status</span>
                <select
                  value={modalKyc}
                  onChange={(e) => setModalKyc(e.target.value)}
                  className="w-full bg-[#05070a] border border-gray-800 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="unverified" className="bg-[#0b0f19] text-white">Unverified (NOT_VERIFIED)</option>
                  <option value="verified" className="bg-[#0b0f19] text-white">Verified (VERIFIED)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold uppercase rounded-xl cursor-pointer transition text-[11px] tracking-wider"
                >
                  Save Account Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: M-PESA SIMULATOR */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-100 p-4">
          <div className="bg-[#0b0f19] rounded-3xl border border-gray-800 shadow-2xl max-w-sm w-full overflow-hidden p-6 font-sans">
            <div className="flex justify-between items-center pb-4 border-b border-gray-850">
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
                M-PESA DEPOSIT SIMULATOR
              </h3>
              <button 
                onClick={() => setIsSimulatorOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-900 text-gray-500 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-[10.5px] text-emerald-400 leading-normal">
              <span className="font-bold block mb-0.5 uppercase tracking-wide">M-PESA PAYHERO API EMULATOR</span>
              Dispatches a simulated Safaricom Instant Webhook reference notification. This will verify real-time deposit ledger loops seamlessly and allocate real credit!
            </div>

            <form onSubmit={handleDispatchSandboxCallback} className="space-y-4 text-xs mt-2">
              <div className="space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Target Client</span>
                <input
                  type="text"
                  value={simUserEmail}
                  disabled
                  className="w-full bg-[#05070a] border border-gray-850 text-gray-500 rounded-xl p-3 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[10px] uppercase font-bold block">Credit Value ($ USD)</span>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full bg-[#05070a] border border-gray-800 rounded-xl p-3 text-white font-semibold focus:outline-none focus:border-emerald-500"
                  min="5"
                  required
                />
                <div className="text-[10px] text-gray-500 font-mono mt-1 text-right italic font-medium">
                  Approx. KES {((parseFloat(simAmount) || 0) * 130).toLocaleString()}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={simLoading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold uppercase rounded-xl cursor-pointer transition text-[11px] tracking-wider flex justify-center items-center gap-1.5"
                >
                  {simLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Emulating...
                    </>
                  ) : (
                    "Trigger Webhook Callback"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
