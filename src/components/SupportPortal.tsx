import React, { useState } from 'react';
import { User, SupportTicket } from '../types';
import { ShieldCheck, FileText, AlertCircle, HelpCircle, Send, MessageSquare, CheckCircle2, UserCheck, RefreshCw, X } from 'lucide-react';

interface SupportPortalProps {
  user: User;
  onUpdateKyc: (status: 'verified' | 'pending', docType: string) => void;
  tickets: SupportTicket[];
  onAddTicket: (subject: string, firstMsg: string) => void;
  onAddMessageToTicket: (ticketId: string, message: string) => void;
}

export default function SupportPortal({ user, onUpdateKyc, tickets, onAddTicket, onAddMessageToTicket }: SupportPortalProps) {
  const [docType, setDocType] = useState('PASSPORT');
  const [kycSuccess, setKycSuccess] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  // Form states
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [replyText, setReplyText] = useState('');

  const [activeKycStatus, setActiveKycStatus] = useState<'unverified' | 'pending' | 'verified'>(user.isKycVerified);

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveKycStatus('pending');
    onUpdateKyc('pending', docType);
    setKycSuccess(true);
    setTimeout(() => {
      setActiveKycStatus('verified');
      onUpdateKyc('verified', docType);
      alert("Compliance Review Complete: Your KYC credentials have been approved! Live institutional deposit and margin tier ceilings have been unlocked completely.");
    }, 5000);
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    onAddTicket(subject, description);
    setSubject('');
    setDescription('');
    alert("Support Ticket Registered! An institutional analyst is evaluating your inquiry.");
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    onAddMessageToTicket(activeTicket.id, replyText);
    setReplyText('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-left text-[11px] text-gray-300 font-sans">
      
      {/* COLUMN 1: Identity & Security Verification (KYC) */}
      <div className="bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl flex flex-col justify-between space-y-3">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 border-b border-gray-800 pb-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-white text-[11px] font-bold uppercase tracking-wide">SECURE IDENTITY PORTAL</span>
          </div>

          <div className="p-2.5 bg-gray-950/60 rounded border border-gray-800/80 space-y-2 font-mono text-[10px] leading-relaxed">
            <div className="flex justify-between items-center">
              <span>Verification Status:</span>
              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase ${
                activeKycStatus === 'verified'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : activeKycStatus === 'pending'
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}>
                {activeKycStatus}
              </span>
            </div>
            
            <div className="border-t border-gray-800/80 pt-1.5 text-[8.5px] text-gray-500 space-y-0.5">
              <p>• Tier Level: Standard Trial Ceiling</p>
              <p>• Max Deposit Ceiling: $10,000 USD / Day</p>
              <p>• Leverage Margin Limit: Unchecked</p>
            </div>
          </div>

          {activeKycStatus === 'unverified' && (
            <form onSubmit={handleKycSubmit} className="space-y-2.5 font-bold">
              <div className="space-y-1">
                <span className="text-gray-500 text-[8.5px] uppercase">DOCUMENTS IDENTITY TYPE</span>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded py-1.5 px-2 text-[10.5px] focus:outline-none focus:border-emerald-500/30"
                >
                  <option value="PASSPORT">Passport Ledger</option>
                  <option value="ID_CARD">National ID Card</option>
                  <option value="DRIVERS_LICENSE">Driver's License ID</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-gray-500 text-[8.5px] uppercase">UPLOAD IDENTIFICATION FILE</span>
                <div className="border border-dashed border-gray-800 hover:border-emerald-500/35 rounded p-3 text-center text-[10px] font-mono text-gray-500 bg-gray-950/20 hover:bg-gray-950/40 transition-all cursor-pointer">
                  Drag & Drop file copy or click here
                  <p className="text-[7.5px] text-gray-600 mt-0.5">PDF, JPG, PNG accepted. Max 5MB size.</p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#0b0f19] font-bold text-[10px] uppercase tracking-wide rounded transition-all cursor-pointer"
              >
                SUBMIT IDENTITY ENVELOPE
              </button>
            </form>
          )}

          {activeKycStatus === 'pending' && (
            <div className="bg-amber-950/10 border border-amber-950 rounded p-3 flex items-start gap-2 text-amber-500 text-[9.5px]">
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>Reviewing records. Compliance matching requires around 5 seconds. Vault assets remain secured.</span>
            </div>
          )}

          {activeKycStatus === 'verified' && (
            <div className="bg-emerald-950/10 border border-emerald-950 rounded p-3 space-y-2 text-emerald-400 text-[9.5px] font-mono">
              <div className="flex gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                <span>Identity parameters verified! Large institutional deposit levels and maximum index margins are fully activated.</span>
              </div>
              <div className="border-t border-emerald-950/30 pt-1.5 text-[8px] text-emerald-500">
                Approved KYC Reference: VEX-MTR-924-814-118
              </div>
            </div>
          )}
        </div>

        <p className="text-[8.5px] text-gray-500 font-mono leading-relaxed pt-1.5">
          *Identity validation audits comply with standard Anti-Money Laundering (AML) treaties.
        </p>
      </div>

      {/* COLUMN 2 & 3: Interactive Support Tickets Hub */}
      <div className="lg:col-span-2 bg-[#0b0f19] border border-gray-800 rounded-lg p-3.5 shadow-xl flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center gap-1.5 border-b border-gray-800 pb-1.5 mb-3">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span className="text-white text-[11px] font-bold uppercase tracking-wide">SYSTEM SUPPORT CENTER</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Create ticket form */}
            <form onSubmit={handleCreateTicket} className="space-y-2.5">
              <span className="text-gray-500 font-mono text-[8.5px] uppercase tracking-wide block">INITIATE CASE INQUIRY</span>

              <div className="space-y-1">
                <span className="text-gray-400 font-mono text-[9px] uppercase">CASE SUBJECT</span>
                <input
                  type="text"
                  placeholder="EX: Deposit check delayed, Copy Trading setup API"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded py-1.5 px-2.5 text-[10.5px] focus:outline-none placeholder-gray-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <span className="text-gray-400 font-mono text-[9px] uppercase">DESCRIPTION PARTICULARS</span>
                <textarea
                  rows={2.5}
                  placeholder="Provide transaction hashes or inquiry profiles here..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-white rounded py-1.5 px-2.5 text-[10.5px] focus:outline-none placeholder-gray-800 text-left"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-white font-bold text-[10px] uppercase rounded transition-all cursor-pointer"
              >
                DISPATCH SUPPORT TICKET
              </button>
            </form>

            {/* List of active support tickets */}
            <div className="space-y-2.5">
              <span className="text-gray-500 font-mono text-[8.5px] uppercase tracking-wide block">ACTIVE RESOLUTIONS ({tickets.length})</span>

              <div className="space-y-1.5">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className="w-full bg-gray-950/60 p-2.5 rounded border border-gray-800/80 hover:border-emerald-500/30 text-left font-mono text-[10px] space-y-0.5 flex justify-between items-center transition-all cursor-pointer"
                  >
                    <div>
                      <h4 className="text-white font-bold tracking-tight truncate max-w-[140px] uppercase">{t.subject}</h4>
                      <p className="text-gray-500 text-[8px]">{t.date} • {t.messages.length} lines logged</p>
                    </div>

                    <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 uppercase border border-emerald-500/20 animate-pulse">
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Knowledge Base academy segment */}
        <div className="bg-[#121826]/40 p-3 rounded-lg border border-gray-800/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] leading-relaxed mt-2">
          <div className="space-y-1">
            <span className="text-white font-bold font-sans uppercase flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              What is Vexcoin Copy Trading?
            </span>
            <p className="text-gray-500 text-[9.5px]">
              Copy-trading allocations replicate institutional traders. When they capture margin positions, your capital replicates a proportionate position, yielding equal performance indices instantly.
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-white font-bold font-sans uppercase flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              How secure are Earn programs?
            </span>
            <p className="text-gray-500 text-[9.5px]">
              Our compound yield program supplies liquidity to elite Blackstone clearing nodes. These locks are immunified via collateral insurance bonds, preserving 100% principal indemnity.
            </p>
          </div>
        </div>

        {/* Modal Ticket Thread view */}
        {activeTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="bg-[#0b0f19] border border-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col justify-between max-h-[80vh]">
              <button
                onClick={() => setActiveTicket(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-all p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pb-3 border-b border-gray-800">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase select-none">TICKET RESOLUTION THREAD</span>
                <h3 className="text-white text-sm font-sans font-bold">{activeTicket.subject}</h3>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto my-4 space-y-3.5 pr-2">
                {activeTicket.messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[85%] ${m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                    <div className={`p-3 rounded-lg text-[10px] font-mono leading-relaxed ${
                      m.sender === 'user' ? 'bg-emerald-500 text-black font-semibold' : 'bg-gray-950 border border-gray-800 text-gray-400'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <form onSubmit={handleSendReply} className="flex gap-2 border-t border-gray-800 pt-3">
                <input
                  type="text"
                  placeholder="Enter message reply details..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-gray-950 border border-gray-800 text-white rounded-lg py-2 px-3 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold uppercase rounded-lg transition-all text-xs"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
