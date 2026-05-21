import React, { useState, useEffect, useRef } from 'react';
import { Asset } from '../types';
import { Bot, Sparkles, Send, RefreshCw, AlertCircle, TrendingUp, HelpCircle } from 'lucide-react';

interface AIAssistantProps {
  activeAsset: Asset;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AIAssistant({ activeAsset }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize with a premium intro message from the chief market strategist
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `### Welcome to VexcoinFX Elite Market Desk

I am your Chief AI Market Strategist. I have mapped real-time liquidity pools and trend alignments for **${activeAsset.symbol}**.

How can I optimize your capital today? Take advantage of our quick technical analytics below, or ask me directly about:
- Live entry limits & hedging strategies for **${activeAsset.symbol}**
- Quantitative risk-ratio planning
- General macro-economic market updates`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [activeAsset.symbol]);

  // Adjust scroll lock on messages list addition
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawPrompt = textToSend || inputMsg;
    if (!rawPrompt.trim() || isGenerating) return;

    if (!textToSend) setInputMsg('');
    setErrorText(null);

    const userMessage: ChatMessage = {
      role: 'user',
      content: rawPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const response = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeAsset.symbol,
          currentPrice: activeAsset.price,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Advisor server did not respond correctly.');
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setErrorText('Communications delay. Retrying endpoint sequence...');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Our AI Advisor systems are currently undergoing system updates.
          
Recommended Strategy for **${activeAsset.symbol}** (Simulated fallback):
- Scale in support tiers. Avoid over-leveraged long positions above immediate resistances. Keep tight parameters.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const QUICK_PROMPTS = [
    { label: 'Technical Analysis', text: `Provide an advanced technical assessment of ${activeAsset.symbol} targeting current prices ($${activeAsset.price}).` },
    { label: 'Leveraged Risk Plan', text: `Design a high-yield, low-risk capital buffer plan for trading ${activeAsset.symbol} utilizing up to 10x leverage.` },
    { label: 'Market Sentiment', text: `Analyze the general macroeconomic sentiment surrounding ${activeAsset.symbol} and identify any imminent breakouts.` }
  ];

  return (
    <div className="bg-[#0b0f19] border border-gray-800 rounded-lg flex flex-col h-[380px] shadow-2xl relative overflow-hidden text-[10.5px]">
      {/* Advisor Header */}
      <div className="bg-gradient-to-r from-emerald-950/40 to-[#0e1628] border-b border-gray-800 p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-left">
          <div className="relative">
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-[#0b0f19] animate-pulse" />
          </div>
          <div>
            <h3 className="text-white text-[10px] font-bold font-sans tracking-wide uppercase flex items-center gap-1">
              ELITE AI STRATEGIST
              <Sparkles className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
            </h3>
            <p className="text-[7.5px] text-gray-500 font-mono">POWERED BY GEMINI PRO</p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([]);
            setErrorText(null);
          }}
          className="text-gray-500 hover:text-white transition-all p-1 hover:bg-gray-800/55 rounded text-[8px] font-mono flex items-center gap-0.5 border border-gray-800 cursor-pointer"
          title="Reset sequence"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 select-text">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col max-w-[90%] ${m.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div
              className={`rounded p-2 text-[10px] leading-normal ${
                m.role === 'user'
                  ? 'bg-emerald-500 text-[#0b0f19] font-bold rounded-tr-none'
                  : 'bg-[#121826] border border-gray-800 text-gray-300 rounded-tl-none font-sans space-y-1'
              }`}
            >
              {/* Parse Markdown-like blocks simply */}
              <div className="prose prose-invert max-w-none text-left">
                {m.content.split('\n').map((line, lIdx) => {
                  if (line.startsWith('### ')) {
                    return <h4 key={lIdx} className="text-white font-bold text-[9.5px] mt-1 uppercase tracking-wide">{line.replace('### ', '')}</h4>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={lIdx} className="ml-2 list-disc">{line.replace('- ', '')}</li>;
                  }
                  if (line.trim().startsWith('*') && line.trim().endsWith('*')) {
                    return <p key={lIdx} className="italic text-[9px] text-gray-400">{line.replace(/\*/g, '')}</p>;
                  }
                  return (
                    <p key={lIdx}>
                      {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                  );
                })}
              </div>
            </div>
            <span className="text-[8px] font-mono text-gray-550 mt-0.5">{m.timestamp}</span>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 bg-[#121826]/30 p-2 rounded border border-gray-800/40 mr-auto max-w-[90%]">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Analyzing trend lines...</span>
          </div>
        )}

        {errorText && (
          <div className="bg-rose-950/20 border border-rose-900/35 text-rose-400 p-2 rounded text-[9px] font-mono flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick Access Prompt Chips */}
      {messages.length === 1 && (
        <div className="px-3 py-1.5 border-t border-gray-800 bg-[#0e1423]/20 flex flex-col gap-1">
          <span className="text-[8px] font-mono text-gray-500 uppercase flex items-center gap-0.5">
            <HelpCircle className="w-2.5 h-2.5" /> Quick advisory query:
          </span>
          <div className="flex flex-col gap-1">
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp.text)}
                className="text-left text-[9px] font-bold text-emerald-400 hover:text-white bg-emerald-950/10 hover:bg-emerald-500/10 border border-emerald-950/40 hover:border-emerald-500/15 px-2 py-0.5 rounded transition-all duration-150 flex items-center justify-between cursor-pointer"
              >
                <span>{qp.label}</span>
                <TrendingUp className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input panel */}
      <div className="p-2 border-t border-gray-800 bg-[#0c111e]">
        <div className="flex items-center gap-1.5 bg-[#121826] border border-gray-800 rounded p-1 focus-within:border-emerald-500/30 transition-all">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={`Ask about ${activeAsset.symbol}...`}
            className="flex-1 bg-transparent text-white text-[10px] outline-none px-1.5 py-0.5 placeholder-gray-600"
            disabled={isGenerating}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isGenerating || !inputMsg.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 text-[#0b0f19] p-1 rounded transition-all duration-150 disabled:opacity-40 disabled:hover:bg-emerald-500 cursor-pointer"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
