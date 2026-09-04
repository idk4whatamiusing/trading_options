"use client";

import Image from "next/image";
import { Anton } from "next/font/google";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

/* ─── Section 1: Hero ─── */
function Hero() {
  return (
    <section className="bg-[#281CAC] text-white overflow-hidden">
      {/* Top band: nav */}
      <div className="flex items-stretch border-b border-white/10">
        <div className="flex-1 flex items-center px-6 py-4 gap-10">
          <span className="font-black text-2xl tracking-tight uppercase">Alpaca</span>
          <nav className="hidden md:flex items-center gap-1 text-xs font-mono">
            <span className="bg-white text-[#281CAC] px-4 py-1.5 rounded-sm">Home</span>
            <span className="px-4 py-1.5 text-white/70 hover:text-white cursor-pointer transition">
              How It Works
            </span>
            <span className="px-4 py-1.5 text-white/70 hover:text-white cursor-pointer transition">
              Risk Gates
            </span>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 text-white/70 hover:text-white cursor-pointer transition"
            >
              Dashboard
            </Link>
            <span className="px-4 py-1.5 text-white/70 hover:text-white cursor-pointer transition">
              FAQ
            </span>
          </nav>
        </div>
        <div className="hidden lg:flex items-stretch">
          <div className="flex flex-col justify-center px-6 border-l border-white/10">
            {["Signal", "Structure", "Risk Gates", "Execute", "Manage"].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-8 py-1 text-xs font-mono text-white/80"
              >
                <span>{item}</span>
                <span className="text-white/40">↘</span>
              </div>
            ))}
          </div>
          <div className="flex items-center px-4 border-l border-white/10">
            <Link
              href="/dashboard"
              className="bg-white text-[#232323] px-6 py-2 text-xs font-mono cursor-pointer"
            >
              Paper Trading
            </Link>
          </div>
        </div>
      </div>

      {/* Mid band: headline + dark panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] min-h-[300px]">
        <div className="px-6 py-10 lg:py-12 flex items-end max-w-[1280px]">
          <h1 className="text-[clamp(2.75rem,6.5vw,5.5rem)] leading-[0.9] uppercase tracking-[-0.02em] text-balance max-w-[13ch]">
            An Autonomous
            <br />
            Agent That Trades
          </h1>
        </div>
        <div className="bg-[#232323] flex items-center px-6 py-8">
          <p className="text-[13px] font-sans leading-[1.6] tracking-[-0.01em] text-white/85 max-w-[28ch] text-pretty">
            An autonomous agent for Alpaca paper trading. TradingAgents finds direction, a second
            LLM structures the spread against the live chain, and deterministic gates veto unsafe
            trades.
          </p>
        </div>
      </div>

      {/* Bottom band: image + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="relative h-[380px] lg:h-[500px] overflow-hidden bg-[#1A1A1A]">
          <Image
            src="/bluepeak/header.png"
            alt="Aerial view of aircraft over forest"
            fill
            className="object-cover"
            style={{ objectPosition: "center 85%" }}
            priority
          />
        </div>
        <div className="flex flex-col">
          <div className="bg-[#281CAC] px-6 py-6 border-b border-white/10">
            <h3 className="text-xl uppercase tracking-[-0.015em] mb-3">Live Pipeline Count</h3>
            <div className="space-y-1">
              {["SIGNAL", "STRUCTURE", "RISK GATES", "EXECUTE", "MANAGE", "SNAPSHOT"].map(
                (item, i) => (
                  <div
                    key={item}
                    className="flex items-center justify-between text-xs font-mono text-white/80 py-1"
                  >
                    <span>{`0${i + 1}. ${item}`}</span>
                    <span className="text-white/40">•</span>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="bg-[#232323] grid grid-cols-2 divide-x divide-y divide-white/10">
            {[
              { val: "$100K", label: "Paper Equity Base" },
              { val: "10", label: "Max Open Positions" },
              { val: "5–30", label: "DTE Window (Days)" },
              { val: "8%", label: "Max Loss Per Trade" },
            ].map((s) => (
              <div key={s.label} className="px-5 py-4">
                <div className="font-bold text-2xl tracking-[-0.02em] uppercase">{s.val}</div>
                <div className="text-[10px] font-mono text-white/60 mt-1 leading-[1.4] tracking-wide">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-[#232323] px-5 pb-5">
            <Link
              href="/dashboard"
              className="block w-full text-center bg-[#2A2A2A] text-white text-xs font-mono py-3 cursor-pointer hover:bg-[#333] transition"
            >
              Open Dashboard ↗
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 2: About ─── */
function About() {
  return (
    <section className="bg-white py-20 px-6 md:px-20 max-w-[1280px] mx-auto">
      <div className="grid md:grid-cols-[200px_1fr] gap-8 mb-16">
        <div className="flex items-start gap-2 pt-2">
          <div className="w-2 h-2 bg-[#281CAC] mt-1 shrink-0" />
          <span className="text-xs font-mono text-black">About Alpaca Agent</span>
        </div>
        <div>
          <h2 className="text-[clamp(1.5rem,2.8vw,2.25rem)] leading-[1.08] tracking-[-0.015em] max-w-[22ch] text-pretty">
            Alpaca Agent pairs TradingAgents signal generation with live options structuring,
            deterministic risk gates, and isolated execution to trade paper options autonomously.
          </h2>
          <div className="flex flex-wrap items-center gap-6 mt-8">
            <span className="border border-[#E9E9E9] bg-[#F8F8F8] px-6 py-3 text-xs font-mono cursor-pointer hover:bg-[#EEE] transition">
              How the pipeline works
            </span>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full bg-gray-300 border-2 border-white overflow-hidden"
                  >
                    <Image
                      src={`https://i.pravatar.cc/100?img=${i + 10}`}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <div className="text-xs font-mono">
                <span className="text-gray-500">Live on</span>
                <br />
                <span className="font-bold">Alpaca Paper Trading</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "Signal",
            desc: "TradingAgents runs a multi-agent debate (fundamentals, technicals, news) to emit BUY/SELL/HOLD with confidence.",
            indigo: false,
          },
          {
            title: "Structure",
            desc: "A separate LLM fetches the live Alpaca chain via MCP and proposes a defined-risk spread with exact OCC symbols.",
            indigo: true,
          },
          {
            title: "Verify",
            desc: "Deterministic gates check DTE, liquidity, exposure and P&L circuit breakers before any order can execute.",
            indigo: false,
          },
        ].map((card) => (
          <div
            key={card.title}
            className={`p-8 min-h-[320px] flex flex-col justify-between border ${
              card.indigo ? "bg-[#281CAC] border-[#281CAC] text-white" : "bg-white border-[#E9E9E9]"
            }`}
          >
            <div className={`w-8 h-8 ${card.indigo ? "text-white" : "text-[#281CAC]"}`}>
              {card.title === "Signal" && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-7 h-7"
                >
                  <path d="M3 21h18M5 21V7l4-4 4 4v14M13 21V11l4-4 4 4v10" />
                </svg>
              )}
              {card.title === "Structure" && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-7 h-7"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              )}
              {card.title === "Verify" && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-7 h-7"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-xl tracking-[-0.015em] uppercase mb-2">{card.title}</h3>
              <p
                className={`text-[13px] leading-[1.6] tracking-[-0.01em] ${card.indigo ? "text-white/85 font-sans" : "text-[#52525B] font-sans"} text-pretty`}
              >
                {card.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Section 3: Core Pipeline ─── */
function CoreInvestment() {
  return (
    <section className="bg-[#FAF7F2] py-20 px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        <div className="relative mb-10">
          <h2 className="text-[clamp(3rem,9vw,6.5rem)] leading-[0.88] uppercase tracking-[-0.02em] text-[#0A0A0A] text-balance">
            Core Pipeline
          </h2>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-gradient-to-r from-transparent via-[#FAF7F2]/85 to-transparent px-8 py-4">
              <p className="text-center text-[13px] font-sans leading-[1.6] tracking-[-0.01em] text-[#52525B] max-w-[42ch] text-pretty">
                Every signal is structured against the live Alpaca chain, checked by twelve
                deterministic gates, and executed in isolation — no discretionary overrides.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              title: "Long Calls & Puts",
              desc: "Long calls/puts capture high-conviction direction with max loss capped at premium paid.",
              img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=200&fit=crop",
            },
            {
              title: "Spreads & Condors",
              desc: "Credit/debit spreads and iron condors balance defined risk against live OI and spread constraints.",
              img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=200&fit=crop",
            },
          ].map((card) => (
            <div key={card.title} className="bg-[#1E1E1E] rounded-xl p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <h3 className="text-3xl md:text-[2.5rem] leading-[0.9] uppercase tracking-[-0.02em] text-white text-balance">
                  {card.title}
                </h3>
                <span className="text-[11px] font-mono text-white/60 uppercase tracking-[0.02em] mt-1 shrink-0">
                  Learn More
                </span>
              </div>
              <div className="border-t border-[#2A2A2A] pt-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <p className="text-[13px] font-sans text-white/85 leading-[1.65] tracking-[-0.01em] max-w-[60ch] text-pretty">
                  {card.desc}
                </p>
                <div className="w-full md:w-[180px] h-[96px] rounded-md overflow-hidden shrink-0 relative">
                  <Image src={card.img} alt="" fill className="object-cover" unoptimized />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 4: Risk Gates ─── */
function RiskGates() {
  const cards = [
    {
      name: "Defined Risk",
      role: "Gate 01 — Structure",
      quote: "Matched long/short legs or premium-capped longs only; naked shorts rejected.",
      color: "bg-[#F4D738]",
      rotate: "-rotate-6",
      z: "z-10",
    },
    {
      name: "Exposure Caps",
      role: "Gates 02–05 — Portfolio",
      quote: "8% per trade, 35% aggregate, 10 concurrent, 2 per ticker max.",
      color: "bg-[#FF5226]",
      rotate: "rotate-0",
      z: "z-20",
    },
    {
      name: "Quality & Safety",
      role: "Gates 06–12 — Market",
      quote: "DTE 5–30, OI>100, spread<15% mid, BP checks, daily -3% / 5d -6% breakers.",
      color: "bg-[#00B653]",
      rotate: "rotate-0",
      z: "z-30",
    },
  ];

  return (
    <section className="bg-[#FAFAFA] py-20 px-6 md:px-20 overflow-hidden">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 mb-16">
          <div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] leading-[0.92] uppercase tracking-[-0.02em] text-balance">
              Risk
              <br />
              Gates
            </h2>
            <p className="text-[13px] font-sans text-[#52525B] mt-3 max-w-[40ch] leading-[1.6] tracking-[-0.01em] text-pretty">
              Twelve deterministic checks veto any unsafe trade before execution — no LLM can
              override them.
            </p>
          </div>
          <p className="text-[13px] font-sans text-[#52525B] md:text-right max-w-[32ch] leading-[1.6] tracking-[-0.01em] text-pretty">
            From defined-risk structure to liquidity floors and portfolio circuit breakers, every
            gate is logged.
          </p>
        </div>

        <div className="relative h-[520px] max-w-[960px] mx-auto hidden md:block">
          {cards.map((card, i) => (
            <div
              key={card.name}
              className={`absolute ${card.color} ${card.rotate} ${card.z} w-[300px] h-[460px] p-6 shadow-2xl ${
                i === 0 ? "left-0 top-8" : i === 1 ? "left-[280px] top-4" : "left-[560px] top-0"
              }`}
            >
              <h3 className="text-xl tracking-[-0.015em] uppercase text-[#0A0A0A]">{card.name}</h3>
              <div className="flex gap-1 mt-2 mb-4 text-[#0A0A0A] text-xs">
                {"★★★★★".split("").map((s, j) => (
                  <span key={j}>{s}</span>
                ))}
              </div>
              <p className="text-[13px] font-sans text-[#0A0A0A]/80 leading-[1.6] tracking-[-0.01em] text-pretty">
                &ldquo;{card.quote}&rdquo;
              </p>
              <div className="absolute bottom-6 left-6 right-6 border-t border-[#0A0A0A]/15 pt-4">
                <span className="font-bold text-xs font-mono text-[#0A0A0A]">{card.name}</span>
                <span className="block text-[10px] font-mono text-[#0A0A0A]/60 mt-0.5 uppercase tracking-wide">
                  {card.role}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile: stacked */}
        <div className="grid gap-6 md:hidden">
          {cards.map((card) => (
            <div
              key={card.name}
              className={`${card.color} p-6 min-h-[320px] flex flex-col justify-between`}
            >
              <div>
                <h3 className="text-xl tracking-[-0.015em] uppercase text-[#0A0A0A]">
                  {card.name}
                </h3>
                <div className="flex gap-1 mt-2 mb-3 text-[#0A0A0A] text-xs">
                  {"★★★★★".split("").map((s, j) => (
                    <span key={j}>{s}</span>
                  ))}
                </div>
                <p className="text-[13px] font-sans text-[#0A0A0A]/80 leading-[1.6]">
                  &ldquo;{card.quote}&rdquo;
                </p>
              </div>
              <div className="border-t border-[#0A0A0A]/15 pt-4 mt-6">
                <span className="font-bold text-xs font-mono text-[#0A0A0A]">{card.name}</span>
                <span className="block text-[10px] font-mono text-[#0A0A0A]/60 uppercase">
                  {card.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 5: Portfolio ─── */
function Portfolio() {
  const tiles = [
    {
      logo: "LOGO",
      title: "CALL — Long Call",
      desc: "Bullish, premium-capped; max loss is debit paid, upside open to price target.",
    },
    {
      logo: "makers°",
      title: "PUT — Long Put",
      desc: "Bearish mirror of long call; live IV and OI filter tradability.",
    },
    {
      logo: "NUBIT",
      title: "SPREAD — Bull Put",
      desc: "Credit spreads with defined max loss; require matched buy/sell legs and quantity balance.",
    },
    {
      logo: "Onbrand",
      title: "CONDOR — Iron Condor",
      desc: "Debit/credit wings around range-bound view; DTE 7–21 target, liquidity floor enforced.",
    },
  ];

  return (
    <section className="grid md:grid-cols-[1fr_1.2fr] min-h-[600px]">
      <div className="flex flex-col">
        <div className="relative h-[300px] overflow-hidden bg-[#1A1A1A]">
          <Image
            src="/bluepeak/portfolio.png"
            alt="Aircraft in clouds"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="bg-[#1E1E1E] text-white p-8 md:p-10 flex-1 flex flex-col justify-center">
          <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[0.92] uppercase tracking-[-0.015em] mb-4 text-balance">
            Structure
            <br />
            Risk, Then Execute.
          </h2>
          <p className="text-[13px] font-sans text-white/85 leading-[1.6] tracking-[-0.01em] max-w-[40ch] mb-6 text-pretty">
            Signal proposes, structure prices against the live chain, gates enforce limits,
            execution is isolated and logged.
          </p>
          <span className="border border-white/20 text-white px-6 py-3 text-[11px] font-mono uppercase tracking-[0.02em] inline-block w-fit cursor-pointer hover:bg-white/10 transition">
            Open Positions ↗
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[2px] bg-[#281CAC]">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="bg-[#5B52BE] p-8 min-h-[260px] flex flex-col justify-between"
          >
            <span className="text-xs font-mono text-white/80">{tile.logo}</span>
            <div>
              <h3 className="text-xl tracking-[-0.015em] uppercase text-white mb-2 text-balance">
                {tile.title}
              </h3>
              <p className="text-[13px] font-sans text-white/80 leading-[1.6] tracking-[-0.01em] text-pretty">
                {tile.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Section 6: Why Choose Us ─── */
function WhyChooseUs() {
  const rows = [
    {
      num: "01",
      label: "Signal Generation",
      desc: "TradingAgents debates fundamentals/technicals/news and emits BUY/SELL/HOLD with confidence.",
      tag: "Partner",
    },
    {
      num: "02",
      label: "Live Structuring",
      desc: "Second LLM fetches Alpaca chain via MCP and proposes strikes/expiry with exact OCC symbols.",
      tag: "Expertise",
    },
    {
      num: "03",
      label: "Deterministic Gates",
      desc: "Twelve veto checks — DTE, OI, spread, exposure, BP, and P&L breakers — all logged.",
      tag: "12 Gates",
    },
    {
      num: "04",
      label: "Isolated Execution",
      desc: "Only the executor holds the place-order tool; structuring cannot place orders by construction.",
      tag: "Execute",
    },
    {
      num: "05",
      label: "Active Management",
      desc: "Positions auto-close on +100% take-profit, −50% stop, or DTE<3.",
      tag: "Network",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 md:px-20">
      <div className="max-w-[1280px] mx-auto">
        <h2 className="text-[clamp(1.75rem,4vw,3.5rem)] leading-[1.05] tracking-[-0.015em] max-w-[18ch] mb-12 text-balance">
          Why Leading Founders Choose To Open Positions.
        </h2>

        <div className="border-t border-[#E8E6E1]">
          {rows.map((row) => (
            <div
              key={row.num}
              className="flex flex-col md:flex-row md:items-center gap-3 md:gap-0 py-6 border-b border-[#E8E6E1]"
            >
              <div className="flex items-center gap-3 md:w-[80px] shrink-0">
                <span className="text-sm font-bold font-mono">{row.num}</span>
                <span className="text-[#E8E6E1]">|</span>
              </div>
              <span className="font-bold text-xs font-mono uppercase tracking-[0.02em] md:w-[260px] shrink-0">
                {row.label}
              </span>
              <p className="text-[13px] font-sans text-[#52525B] leading-[1.6] tracking-[-0.01em] flex-1 max-w-[52ch] text-pretty">
                {row.desc}
              </p>
              <span className="text-xs font-bold font-mono uppercase tracking-[0.02em] md:text-right md:w-[180px] shrink-0">
                {row.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 7: FAQ ─── */
function FAQSection() {
  const faqs = [
    {
      q: "Is this trading real money?",
      a: "No. Alpaca paper trading only. Keys are ALPACA_PAPER_TRADE=true; live execution is isolated and auditable via MCP.",
    },
    {
      q: "How does the signal step work?",
      a: "TradingAgents runs a LangGraph multi-agent debate via Cloudflare Workers AI and collapses Buy/Overweight/Hold/Underweight/Sell to BUY/SELL/HOLD.",
    },
    {
      q: "What actually blocks a bad trade?",
      a: "Twelve deterministic risk gates — defined-risk, 8% per-trade/35% aggregate, OI>100, spread<15% mid, DTE 5–30, BP, daily -3%/5d -6% breakers — veto before execution.",
    },
    {
      q: "How do positions close?",
      a: "Position manager auto-closes at +100% take-profit, −50% stop-loss, or DTE<3, and every cycle snapshots equity/cash/BP for the dashboard.",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 md:px-20">
      <div className="max-w-[1280px] mx-auto">
        <h2 className="text-[clamp(2rem,5vw,4rem)] leading-[0.9] tracking-[-0.02em] mb-12 text-balance">
          Got Questions?
          <br />
          We Have Answers.
        </h2>

        <Accordion
          type="single"
          collapsible
          defaultValue="faq-0"
          className="border-t border-[#E8E6E1]"
        >
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-[#E8E6E1]">
              <AccordionTrigger className="py-6 hover:no-underline group/faq [&_[data-slot=accordion-trigger-icon]]:hidden">
                <div className="flex items-center gap-4 flex-1 text-left">
                  <span className="text-xs font-mono text-[#52525B] w-8 shrink-0">{`0${i + 1}`}</span>
                  <span className="text-[17px] leading-[1.2] tracking-[-0.01em] uppercase group-data-[state=open]/faq:text-[#281CAC] text-balance text-left">
                    {faq.q}
                  </span>
                </div>
                <span className="w-8 h-8 flex items-center justify-center shrink-0 ml-4 text-sm font-mono leading-none bg-[#F6F3EE] text-[#0A0A0A] group-data-[state=open]/faq:bg-[#281CAC] group-data-[state=open]/faq:text-white">
                  <span className="group-data-[state=open]/faq:hidden">+</span>
                  <span className="hidden group-data-[state=open]/faq:inline">−</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-12 pb-6">
                <p className="text-[13px] font-sans text-[#52525B] leading-[1.65] tracking-[-0.01em] max-w-[64ch] text-pretty">
                  {faq.a}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

/* ─── Section 8: Footer ─── */
function Footer() {
  return (
    <footer className="bg-[#281CAC] text-white overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[#1F1590]">
        {[
          {
            num: "01",
            left: ["Pipeline", "How It Works", "Risk Gates", "Dashboard"],
            right: ["Signal", "Structure", "Execute", "Manage"],
          },
          { num: "02", left: ["Live Chain", "MCP", "Paper Trading", "Workers AI"], right: [] },
          { num: "03", left: ["GitHub", "Risk Gates Docs"], right: [], lang: true },
        ].map((col) => (
          <div
            key={col.num}
            className="relative px-6 py-6 border-b md:border-b-0 md:border-r border-[#1F1590] last:border-r-0"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest">{`ALPC. ${col.num}`}</span>
              <div className="w-1.5 h-1.5 bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {col.left.map((item) => (
                  <a
                    key={item}
                    href="#"
                    className="block text-xs font-mono text-white/80 hover:text-white transition"
                  >
                    {item}
                  </a>
                ))}
              </div>
              {col.right.length > 0 && (
                <div className="space-y-2">
                  {col.right.map((item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-xs font-mono text-white/80 hover:text-white transition"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              )}
              {col.lang && (
                <div className="flex gap-2 text-xs font-mono">
                  <span className="text-white/60">ES</span>
                  <span className="text-white/40">|</span>
                  <span className="font-bold">EN</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center py-12 md:py-16 relative px-6 overflow-hidden">
        <span className="text-[clamp(3.5rem,11vw,9rem)] leading-[0.9] tracking-[-0.02em] uppercase text-center text-balance">
          ALPACA<span className="text-[0.6em]">.</span>
        </span>
        <span className="hidden md:flex absolute right-[6%] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/60 items-center justify-center text-xs font-mono">
          R
        </span>
      </div>

      <div className="border-t border-[#1F1590] px-6 md:px-20 py-3 flex flex-col md:flex-row items-center justify-between text-[10px] font-mono text-white/60 gap-2">
        <span>©2026 ALPACA AGENT</span>
        <span>PAPER TRADING ONLY</span>
        <span>RISK DISCLOSURE</span>
        <span>BUILT ON ALPACA MCP & CF WORKERS AI</span>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <main
      className={`${anton.variable} min-h-screen [&_h1]:[font-family:var(--font-anton)] [&_h2]:[font-family:var(--font-anton)] [&_h3]:[font-family:var(--font-anton)]`}
    >
      <Hero />
      <About />
      <CoreInvestment />
      <RiskGates />
      <Portfolio />
      <WhyChooseUs />
      <FAQSection />
      <Footer />
    </main>
  );
}
