// src/pages/SuiteHome.tsx
//
// The front door of the suite. Built so you can get into an app without
// scrolling: the heading, a "continue where you were" button, and one tile
// per app sit on the first screen. The long product cards follow below for
// anyone who wants to read what each app does.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type AppId = "trading" | "tracker" | "crm" | "outreach" | "budget";

type App = {
  id: AppId;
  to: string;
  name: string;
  tag: string;
  tagline: string;
  /** One line for the quick-launch tile. */
  kort: string;
  desc: string;
  features: string[];
  icon: (size: number) => React.ReactNode;
  deco: React.ReactNode;
};

/** Which app was opened last, so the page can offer the way back. */
const LAATSTE = "korda-laatste-app";

const APPS: App[] = [
  {
    id: "budget",
    to: "/budget",
    name: "KordaBudget",
    tag: "Household Budget",
    tagline: "Samen grip op je geld",
    kort: "Pots, bank sync and settling up, together",
    desc: "A household budget for two. Your bank account syncs itself, every payment lands in a pot, and you both see what's safe to spend today, with each person deciding what stays private.",
    features: [
      "ING linked: payments come in by themselves",
      "Pots per category with a monthly limit",
      "Safe to spend per day, at a glance",
      "Shared or private, per account",
      "Settling up and savings goals",
    ],
    icon: (s) => (
      <svg viewBox="0 0 48 48" fill="none" style={{ width: s, height: s }}>
        <rect x="8" y="12" width="32" height="6" rx="3" fill="rgba(139,138,245,0.22)" />
        <rect x="8" y="12" width="26" height="6" rx="3" fill="rgba(139,138,245,0.9)" />
        <rect x="8" y="22" width="32" height="6" rx="3" fill="rgba(139,138,245,0.22)" />
        <rect x="8" y="22" width="17" height="6" rx="3" fill="rgba(139,138,245,0.7)" />
        <rect x="8" y="32" width="32" height="6" rx="3" fill="rgba(139,138,245,0.22)" />
        <rect x="8" y="32" width="10" height="6" rx="3" fill="rgba(139,138,245,0.5)" />
      </svg>
    ),
    deco: (
      <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
        <rect x="10" y="20" width="200" height="22" rx="11" fill="rgba(139,138,245,0.25)" />
        <rect x="10" y="20" width="160" height="22" rx="11" fill="rgba(139,138,245,0.8)" />
        <rect x="10" y="60" width="200" height="22" rx="11" fill="rgba(139,138,245,0.25)" />
        <rect x="10" y="60" width="110" height="22" rx="11" fill="rgba(139,138,245,0.6)" />
        <rect x="10" y="100" width="200" height="22" rx="11" fill="rgba(139,138,245,0.25)" />
        <rect x="10" y="100" width="60" height="22" rx="11" fill="rgba(139,138,245,0.45)" />
      </svg>
    ),
  },
  {
    id: "trading",
    to: "/trading",
    name: "KordaTrading",
    tag: "Trading Journal",
    tagline: "Trade With Clarity",
    kort: "Journal, analytics and psychology",
    desc: "A precision trading journal for discretionary traders. Log trades, review psychology, analyse patterns, and build the discipline that separates consistent traders from the rest.",
    features: [
      "Full trade CRUD — PnL, RR, strategy tagging",
      "Dashboard analytics — win rate, profit factor, streaks",
      "Psychology journaling with emotion tracking",
      "Chart screenshot uploads & session logs",
      "Live vs backtest account separation",
    ],
    icon: (s) => (
      <svg viewBox="0 0 48 48" fill="none" style={{ width: s, height: s }}>
        <line x1="10" y1="8" x2="10" y2="15" stroke="rgba(0,184,148,0.5)" strokeWidth="1.5" />
        <rect x="6" y="15" width="8" height="13" fill="rgba(0,184,148,0.7)" rx="1" />
        <line x1="10" y1="28" x2="10" y2="35" stroke="rgba(0,184,148,0.5)" strokeWidth="1.5" />
        <line x1="24" y1="11" x2="24" y2="19" stroke="rgba(0,184,148,0.35)" strokeWidth="1.5" />
        <rect x="20" y="19" width="8" height="16" fill="rgba(50,50,60,0.9)" rx="1" stroke="rgba(0,184,148,0.4)" strokeWidth="1" />
        <line x1="24" y1="35" x2="24" y2="41" stroke="rgba(0,184,148,0.35)" strokeWidth="1.5" />
        <line x1="38" y1="6" x2="38" y2="13" stroke="rgba(0,184,148,0.6)" strokeWidth="1.5" />
        <rect x="34" y="13" width="8" height="18" fill="rgba(0,184,148,0.7)" rx="1" />
        <line x1="38" y1="31" x2="38" y2="39" stroke="rgba(0,184,148,0.6)" strokeWidth="1.5" />
      </svg>
    ),
    deco: (
      <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
        <polyline points="0,110 40,80 80,90 120,45 160,60 200,20 220,30" stroke="rgba(0,184,148,1)" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: "tracker",
    to: "/tracker",
    name: "KordaTracker",
    tag: "Health Tracker",
    tagline: "// measure_body.track_progress()",
    kort: "Weight, measurements and progress photos",
    desc: "Clinical-grade body composition tracking. Log weight, measurements, and progress photos daily. See the data behind the changes — no guesswork, no motivation speeches.",
    features: [
      "Daily weigh-ins with 7-day rolling averages",
      "Body measurements — waist, chest, hips, arms",
      "Progress photo timeline with lightbox viewer",
      "Caloric intake vs deficit tracking",
      "Goal projections & in-depth trend analysis",
    ],
    icon: (s) => (
      <svg viewBox="0 0 48 48" fill="none" style={{ width: s, height: s }}>
        <line x1="8" y1="40" x2="8" y2="8" stroke="rgba(90,180,212,0.3)" strokeWidth="1" />
        <line x1="8" y1="40" x2="44" y2="40" stroke="rgba(90,180,212,0.3)" strokeWidth="1" />
        <polyline points="8,16 17,20 26,24 35,18 43,12" stroke="rgba(90,180,212,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="8" cy="16" r="2.5" fill="rgba(90,180,212,0.5)" />
        <circle cx="17" cy="20" r="2.5" fill="rgba(90,180,212,0.5)" />
        <circle cx="26" cy="24" r="2.5" fill="rgba(90,180,212,0.5)" />
        <circle cx="35" cy="18" r="2.5" fill="rgba(90,180,212,0.5)" />
        <circle cx="43" cy="12" r="3" fill="rgba(90,180,212,1)" />
      </svg>
    ),
    deco: (
      <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
        <polyline points="0,20 40,34 80,44 120,58 160,50 200,65 220,78" stroke="rgba(90,180,212,1)" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  {
    id: "crm",
    to: "/crm",
    name: "KordaCRM",
    tag: "Sales CRM",
    tagline: "Close More. Track Better.",
    kort: "Calls, daily goals and the leaderboard",
    desc: "A sales call tracker built for a team of closers. Log every call, hit your 25-call daily goal, and see the leaderboard update in real time.",
    features: [
      "Daily 25-call goal with live progress bars",
      "Leaderboard — ranked by calls today",
      "Week grid: red / yellow / green per rep per day",
      "Filterable leads table with CSV export",
      "Admin mode to view and edit all data",
    ],
    icon: (s) => (
      <svg viewBox="0 0 48 48" fill="none" style={{ width: s, height: s }}>
        <rect x="6" y="10" width="36" height="28" rx="2" stroke="rgba(59,130,246,0.4)" strokeWidth="1.2" />
        <line x1="6" y1="18" x2="42" y2="18" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <line x1="18" y1="10" x2="18" y2="38" stroke="rgba(59,130,246,0.12)" strokeWidth="1" />
        <rect x="8" y="12" width="7" height="4" rx="0.5" fill="rgba(59,130,246,0.6)" />
        <rect x="20" y="12" width="10" height="4" rx="0.5" fill="rgba(59,130,246,0.3)" />
        <circle cx="11" cy="23" r="2.5" fill="rgba(59,130,246,0.5)" />
        <line x1="20" y1="22" x2="34" y2="22" stroke="rgba(59,130,246,0.35)" strokeWidth="1" />
        <circle cx="11" cy="32" r="2.5" fill="rgba(59,130,246,0.3)" />
        <line x1="20" y1="31" x2="38" y2="31" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
      </svg>
    ),
    deco: (
      <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
        <rect x="10" y="20" width="30" height="100" rx="1" fill="rgba(59,130,246,0.15)" />
        <rect x="50" y="50" width="30" height="70" rx="1" fill="rgba(59,130,246,0.25)" />
        <rect x="90" y="35" width="30" height="85" rx="1" fill="rgba(59,130,246,0.35)" />
        <rect x="130" y="60" width="30" height="60" rx="1" fill="rgba(59,130,246,0.2)" />
        <rect x="170" y="10" width="30" height="110" rx="1" fill="rgba(59,130,246,0.45)" />
      </svg>
    ),
  },
  {
    id: "outreach",
    to: "/outreach",
    name: "KordaOutreach",
    tag: "Lead Engine",
    tagline: "// find_them.verify_them()",
    kort: "Local B2B leads, found and verified",
    desc: "A B2B lead engine for local markets. A pipeline finds the businesses, reads the public web for the owner and their email, and scores what it finds — you review and decide who's worth contacting.",
    features: [
      "Niche configs — one row per market, no code",
      "Owner + email pulled from the public web",
      "Confidence scored: personal beats generic info@",
      "Provenance URL stored on every single contact",
      "Opt-outs and bounces suppress themselves",
    ],
    icon: (s) => (
      <svg viewBox="0 0 48 48" fill="none" style={{ width: s, height: s }}>
        <circle cx="14" cy="16" r="5" stroke="rgba(232,150,68,0.55)" strokeWidth="1.3" />
        <path d="M6 34 c0 -5 4 -8 8 -8 s8 3 8 8" stroke="rgba(232,150,68,0.4)" strokeWidth="1.2" />
        <line x1="26" y1="14" x2="42" y2="14" stroke="rgba(232,150,68,0.5)" strokeWidth="1.2" />
        <line x1="26" y1="20" x2="38" y2="20" stroke="rgba(232,150,68,0.3)" strokeWidth="1.2" />
        <circle cx="35" cy="34" r="6" stroke="rgba(232,150,68,0.5)" strokeWidth="1.2" />
        <path d="M32.5 34 l2 2 l4 -4" stroke="rgba(232,150,68,0.85)" strokeWidth="1.4" />
      </svg>
    ),
    deco: (
      <svg className="suite-card-deco" viewBox="0 0 220 140" fill="none">
        <circle cx="40" cy="70" r="8" fill="rgba(232,150,68,0.35)" />
        <circle cx="100" cy="40" r="6" fill="rgba(232,150,68,0.25)" />
        <circle cx="110" cy="100" r="6" fill="rgba(232,150,68,0.25)" />
        <circle cx="170" cy="65" r="10" fill="rgba(232,150,68,0.45)" />
        <line x1="48" y1="66" x2="94" y2="43" stroke="rgba(232,150,68,0.3)" strokeWidth="1.5" />
        <line x1="48" y1="74" x2="104" y2="97" stroke="rgba(232,150,68,0.3)" strokeWidth="1.5" />
        <line x1="106" y1="44" x2="162" y2="61" stroke="rgba(232,150,68,0.25)" strokeWidth="1.5" />
        <line x1="116" y1="97" x2="162" y2="72" stroke="rgba(232,150,68,0.25)" strokeWidth="1.5" />
      </svg>
    ),
  },
];

function leesLaatste(): App | null {
  try {
    const id = localStorage.getItem(LAATSTE);
    return APPS.find((a) => a.id === id) ?? null;
  } catch {
    return null;
  }
}

function onthoud(id: AppId) {
  try {
    localStorage.setItem(LAATSTE, id);
  } catch {
    // Private mode: no "continue" button next time, nothing else changes.
  }
}

const CSS = `
  body.suite-page { overflow: hidden; }
  .suite-portal { position: fixed; inset: 0; z-index: 9999; overflow-y: auto; background: #080809; }
  .suite-root { min-height: 100vh; background: #080809; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; position: relative; }
  .suite-root *, .suite-root *::before, .suite-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .suite-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); opacity: .45; }
  .suite-orb { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; }
  .suite-orb-1 { width: 600px; height: 600px; top: -200px; left: -150px; background: radial-gradient(circle, rgba(0,184,148,0.05) 0%, transparent 70%); animation: orb-drift 18s ease-in-out infinite alternate; }
  .suite-orb-2 { width: 500px; height: 500px; bottom: -150px; right: -100px; background: radial-gradient(circle, rgba(109,107,240,0.07) 0%, transparent 70%); animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
  @keyframes orb-drift { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,30px) scale(1.1); } }
  .suite-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 10000; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(8,8,9,0.88); backdrop-filter: blur(20px); }
  .suite-nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; color: #e8e6e1; letter-spacing: 0.01em; }
  .suite-nav-logo sup { font-size: 0.5rem; color: rgba(232,230,225,0.3); vertical-align: super; margin-left: 1px; }
  .suite-nav-links { display: flex; gap: 2.5rem; align-items: center; }
  .suite-nav-links a { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,230,225,0.35); text-decoration: none; transition: color 0.2s; }
  .suite-nav-links a:hover { color: #e8e6e1; }

  /* Hero: short, so the app tiles are on the first screen. */
  .suite-hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 9rem 2rem 2.5rem; position: relative; z-index: 1; }
  .suite-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(232,230,225,0.25); margin-bottom: 1.6rem; display: flex; align-items: center; gap: 1rem; justify-content: center; }
  .suite-eyebrow::before, .suite-eyebrow::after { content: ''; display: block; width: 24px; height: 1px; background: rgba(232,230,225,0.15); }
  .suite-h1 { font-family: 'Playfair Display', serif; font-size: clamp(2.6rem, 6vw, 5.2rem); font-weight: 400; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 1.25rem; }
  .suite-h1 em { font-style: italic; color: rgba(232,230,225,0.35); }
  .suite-sub { font-size: 1rem; font-weight: 300; line-height: 1.8; color: rgba(232,230,225,0.45); max-width: 520px; margin: 0 auto; }

  /* Continue where you were */
  .suite-verder { margin-top: 2rem; display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.8rem 1.4rem; border: 1px solid rgba(232,230,225,0.18); background: rgba(232,230,225,0.04); color: #e8e6e1; text-decoration: none; font-size: 0.9rem; transition: background 0.2s, border-color 0.2s; }
  .suite-verder:hover, .suite-verder:focus-visible { background: rgba(232,230,225,0.09); border-color: rgba(232,230,225,0.35); outline: none; }
  .suite-verder small { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(232,230,225,0.4); }

  /* Quick launch: one tile per app. */
  .suite-launch { position: relative; z-index: 1; max-width: 1300px; margin: 0 auto; padding: 1.5rem 4rem 3rem; }
  .suite-launch-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; }
  .suite-tile { --c: 232,230,225; position: relative; display: flex; flex-direction: column; gap: 0.9rem; padding: 1.5rem 1.4rem 1.3rem; background: #0e0e10; color: inherit; text-decoration: none; overflow: hidden; transition: background 0.25s, transform 0.3s cubic-bezier(0.16,1,0.3,1); }
  .suite-tile::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: rgba(var(--c),0.55); opacity: 0.6; transition: opacity 0.25s; }
  .suite-tile:hover, .suite-tile:focus-visible { background: rgba(var(--c),0.07); transform: translateY(-3px); outline: none; }
  .suite-tile:hover::before, .suite-tile:focus-visible::before { opacity: 1; }
  .suite-tile-naam { font-family: 'Playfair Display', serif; font-size: 1.35rem; font-weight: 400; line-height: 1.1; }
  .suite-tile-kort { font-size: 0.8rem; line-height: 1.5; color: rgba(232,230,225,0.45); }
  .suite-tile-open { margin-top: auto; font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(var(--c),0.9); display: flex; align-items: center; gap: 0.5rem; }
  .suite-tile-open span { transition: transform 0.2s; }
  .suite-tile:hover .suite-tile-open span { transform: translateX(4px); }
  .suite-tile-budget { --c: 139,138,245; }
  .suite-tile-trading { --c: 0,184,148; }
  .suite-tile-tracker { --c: 90,180,212; }
  .suite-tile-crm { --c: 59,130,246; }
  .suite-tile-outreach { --c: 232,150,68; }

  .suite-cards-section { position: relative; z-index: 1; padding: 0 4rem 8rem; max-width: 1300px; margin: 0 auto; }
  .suite-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
  /* Five cards in two columns: the first, newest one runs full width. */
  .suite-cards-grid > :first-child { grid-column: 1 / -1; min-height: 0; }
  .suite-card { position: relative; padding: 3.5rem; min-height: 520px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; transition: transform 0.4s cubic-bezier(0.16,1,0.3,1); cursor: pointer; text-decoration: none; color: inherit; }
  .suite-card:hover { transform: translateY(-4px); }
  .suite-card:focus-visible { outline: 1px solid rgba(232,230,225,0.4); outline-offset: -1px; }
  .suite-card-top-line { position: absolute; top: 0; left: 0; right: 0; height: 1px; }

  .suite-card-trading { background: #0e0e10; }
  .suite-card-trading .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(0,184,148,0.7), transparent); }
  .suite-card-trading:hover { background: #0d1a17; }
  .suite-card-trading .suite-card-tag { color: rgba(0,184,148,0.8); border-color: rgba(0,184,148,0.2); background: rgba(0,184,148,0.04); }
  .suite-card-trading .suite-card-tagline { color: rgba(0,184,148,0.5); }
  .suite-card-trading .suite-feat-dot { background: rgba(0,184,148,0.6); }
  .suite-card-trading .suite-card-cta { color: rgba(0,184,148,0.9); border-color: rgba(0,184,148,0.25); background: rgba(0,184,148,0.06); }
  .suite-card-trading:hover .suite-card-cta { background: rgba(0,184,148,0.12); border-color: rgba(0,184,148,0.5); }

  .suite-card-tracker { background: #090c0e; }
  .suite-card-tracker .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(90,180,212,0.6), transparent); }
  .suite-card-tracker:hover { background: #0c1014; }
  .suite-card-tracker .suite-card-tag { color: rgba(90,180,212,0.7); border-color: rgba(90,180,212,0.2); background: rgba(90,180,212,0.04); }
  .suite-card-tracker .suite-card-tagline { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: rgba(90,180,212,0.4); }
  .suite-card-tracker .suite-feat-dot { background: rgba(90,180,212,0.5); }
  .suite-card-tracker .suite-card-cta { color: rgba(90,180,212,0.85); border-color: rgba(90,180,212,0.2); background: rgba(90,180,212,0.05); }
  .suite-card-tracker:hover .suite-card-cta { background: rgba(90,180,212,0.12); border-color: rgba(90,180,212,0.45); }
  .suite-card-tracker .suite-card-name { color: #c8dce6; font-style: italic; }

  .suite-card-crm { background: #090b12; }
  .suite-card-crm .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(59,130,246,0.7), transparent); }
  .suite-card-crm:hover { background: #0b0f1a; }
  .suite-card-crm .suite-card-tag { color: rgba(59,130,246,0.8); border-color: rgba(59,130,246,0.2); background: rgba(59,130,246,0.05); }
  .suite-card-crm .suite-card-tagline { color: rgba(59,130,246,0.45); }
  .suite-card-crm .suite-feat-dot { background: rgba(59,130,246,0.6); }
  .suite-card-crm .suite-card-cta { color: rgba(59,130,246,0.9); border-color: rgba(59,130,246,0.25); background: rgba(59,130,246,0.05); }
  .suite-card-crm:hover .suite-card-cta { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.5); }
  .suite-card-crm .suite-card-name { color: #d0d8f0; }

  .suite-card-outreach { background: #0b0906; }
  .suite-card-outreach .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(232,150,68,0.7), transparent); }
  .suite-card-outreach:hover { background: #14100a; }
  .suite-card-outreach .suite-card-tag { color: rgba(232,150,68,0.8); border-color: rgba(232,150,68,0.2); background: rgba(232,150,68,0.04); }
  .suite-card-outreach .suite-card-tagline { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; color: rgba(232,150,68,0.45); }
  .suite-card-outreach .suite-feat-dot { background: rgba(232,150,68,0.6); }
  .suite-card-outreach .suite-card-cta { color: rgba(232,150,68,0.9); border-color: rgba(232,150,68,0.25); background: rgba(232,150,68,0.06); }
  .suite-card-outreach:hover .suite-card-cta { background: rgba(232,150,68,0.12); border-color: rgba(232,150,68,0.5); }
  .suite-card-outreach .suite-card-name { color: #ece7e0; }

  .suite-card-budget { background: #0b0b14; }
  .suite-card-budget .suite-card-top-line { background: linear-gradient(to right, transparent, rgba(139,138,245,0.75), transparent); }
  .suite-card-budget:hover { background: #10101e; }
  .suite-card-budget .suite-card-tag { color: rgba(139,138,245,0.9); border-color: rgba(139,138,245,0.25); background: rgba(139,138,245,0.05); }
  .suite-card-budget .suite-card-tagline { color: rgba(139,138,245,0.55); font-style: italic; }
  .suite-card-budget .suite-feat-dot { background: rgba(139,138,245,0.7); }
  .suite-card-budget .suite-card-cta { color: rgba(160,159,250,0.95); border-color: rgba(139,138,245,0.3); background: rgba(139,138,245,0.07); }
  .suite-card-budget:hover .suite-card-cta { background: rgba(139,138,245,0.14); border-color: rgba(139,138,245,0.55); }
  .suite-card-budget .suite-card-name { color: #e2e1ff; }

  .suite-card-desc { color: rgba(232,230,225,0.4); font-size: 0.92rem; line-height: 1.7; max-width: 560px; margin-bottom: 1.5rem; }
  .suite-card-tag { display: inline-flex; align-items: center; gap: 0.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.3rem 0.8rem; margin-bottom: 2rem; border: 1px solid; }
  .suite-card-icon { width: 48px; height: 48px; margin-bottom: 2rem; }
  .suite-card-name { font-family: 'Playfair Display', serif; font-size: 2.6rem; font-weight: 400; line-height: 1; margin-bottom: 0.5rem; color: #e8e6e1; }
  .suite-card-tagline { font-size: 0.78rem; letter-spacing: 0.06em; margin-bottom: 1.5rem; }
  .suite-card-features { list-style: none; margin-bottom: 3rem; display: flex; flex-direction: column; gap: 0.55rem; }
  .suite-card-features li { font-size: 0.8rem; color: rgba(232,230,225,0.35); display: flex; align-items: center; gap: 0.65rem; }
  .suite-feat-dot { width: 3px; height: 3px; border-radius: 50%; flex-shrink: 0; }
  .suite-card-cta { display: inline-flex; align-items: center; gap: 0.75rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.85rem 2rem; border: 1px solid; transition: all 0.2s; width: fit-content; }
  .suite-cta-arrow { transition: transform 0.2s; }
  .suite-card:hover .suite-cta-arrow { transform: translateX(5px); }
  .suite-card-deco { position: absolute; bottom: -10px; right: -10px; width: 220px; opacity: 0.07; pointer-events: none; transition: opacity 0.4s; }
  .suite-card:hover .suite-card-deco { opacity: 0.14; }
  .suite-divider { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 2rem; padding: 2rem 4rem 2.5rem; margin: 0 auto; max-width: 1300px; }
  .suite-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.04); }
  .suite-divider-text { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(232,230,225,0.2); white-space: nowrap; }
  .suite-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,0.04); padding: 2.5rem 4rem; display: flex; align-items: center; justify-content: space-between; max-width: 1300px; margin: 0 auto; }
  .suite-footer-logo { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(232,230,225,0.3); }
  .suite-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.15); }
  .suite-footer-links { display: flex; gap: 2rem; }
  .suite-footer-links a { font-size: 0.72rem; color: rgba(232,230,225,0.2); text-decoration: none; transition: color 0.2s; }
  .suite-footer-links a:hover { color: rgba(232,230,225,0.5); }
  @keyframes suite-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .suite-anim-1 { animation: suite-fadeUp 0.6s ease both; }
  .suite-anim-2 { animation: suite-fadeUp 0.6s 0.08s ease both; }
  .suite-anim-3 { animation: suite-fadeUp 0.6s 0.16s ease both; }
  .suite-anim-4 { animation: suite-fadeUp 0.6s 0.24s ease both; }
  @media (prefers-reduced-motion: reduce) {
    .suite-anim-1, .suite-anim-2, .suite-anim-3, .suite-anim-4, .suite-orb { animation: none; }
    .suite-tile, .suite-card { transition: none; }
  }
  @media (max-width: 1100px) {
    .suite-launch-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 900px) {
    .suite-nav { padding: 1rem 1.5rem; }
    .suite-nav-links { gap: 1.25rem; }
    .suite-hero { padding: 7rem 1.5rem 1.5rem; }
    .suite-launch { padding: 1rem 1.5rem 2rem; }
    /* On a phone the tiles become a tidy list: icon, name, line, arrow. */
    .suite-launch-grid { grid-template-columns: 1fr; }
    .suite-tile { flex-direction: row; align-items: center; gap: 1rem; padding: 1rem 1.1rem; }
    .suite-tile::before { top: 0; bottom: 0; left: 0; right: auto; width: 2px; height: auto; }
    .suite-tile-tekst { flex: 1; min-width: 0; }
    .suite-tile-naam { font-size: 1.15rem; }
    .suite-tile-kort { font-size: 0.78rem; }
    .suite-tile-open { margin-top: 0; }
    .suite-tile-open em { display: none; }
    .suite-cards-section { padding: 0 1.5rem 5rem; }
    .suite-cards-grid { grid-template-columns: 1fr; }
    .suite-card { padding: 2.5rem 1.75rem; min-height: auto; }
    .suite-footer { flex-direction: column; gap: 1.5rem; text-align: center; padding: 2rem 1.5rem; }
    .suite-footer-links { justify-content: center; }
    .suite-divider { padding: 1.5rem; }
  }
`;

export default function SuiteHome() {
  const [laatste] = useState(leesLaatste);

  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.id = "suite-global";
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.classList.add("suite-page");

    return () => {
      document.head.removeChild(link);
      const el = document.getElementById("suite-global");
      if (el) document.head.removeChild(el);
      document.body.classList.remove("suite-page");
    };
  }, []);

  return (
    <div className="suite-portal">
      <div className="suite-root">
        <div className="suite-noise" />
        <div className="suite-orb suite-orb-1" />
        <div className="suite-orb suite-orb-2" />

        <nav className="suite-nav">
          <span className="suite-nav-logo">
            Korda<sup>™</sup>
          </span>
          <div className="suite-nav-links">
            <a href="#apps">Apps</a>
            <Link to="/about">About</Link>
            <Link to="/pricing">Pricing</Link>
          </div>
        </nav>

        <section className="suite-hero">
          <p className="suite-eyebrow suite-anim-1">The Korda™ Suite</p>
          <h1 className="suite-h1 suite-anim-2">
            One account.
            <br />
            Five <em>apps.</em>
          </h1>
          <p className="suite-sub suite-anim-3">
            Built for people who measure what matters: trades, body, sales, leads and the household budget. One login
            opens all of them.
          </p>
          {laatste && (
            <Link to={laatste.to} className="suite-verder suite-anim-3" onClick={() => onthoud(laatste.id)}>
              <small>Continue in</small> {laatste.name} <span aria-hidden>→</span>
            </Link>
          )}
        </section>

        <section className="suite-launch suite-anim-4" id="apps" aria-label="Open an app">
          <div className="suite-launch-grid">
            {APPS.map((a) => (
              <Link key={a.id} to={a.to} className={`suite-tile suite-tile-${a.id}`} onClick={() => onthoud(a.id)}>
                {a.icon(36)}
                <span className="suite-tile-tekst">
                  <span className="suite-tile-naam">{a.name}</span>
                  <span className="suite-tile-kort" style={{ display: "block", marginTop: "0.35rem" }}>
                    {a.kort}
                  </span>
                </span>
                <span className="suite-tile-open">
                  <em style={{ fontStyle: "normal" }}>Open</em> <span aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="suite-divider">
          <div className="suite-divider-line" />
          <span className="suite-divider-text">What each app does</span>
          <div className="suite-divider-line" />
        </div>

        <section className="suite-cards-section">
          <div className="suite-cards-grid">
            {APPS.map((a) => (
              <Link key={a.id} to={a.to} className={`suite-card suite-card-${a.id}`} onClick={() => onthoud(a.id)}>
                <div className="suite-card-top-line" />
                <div>
                  <div className="suite-card-icon">{a.icon(48)}</div>
                  <span className="suite-card-tag">{a.tag}</span>
                  <h2 className="suite-card-name">{a.name}</h2>
                  <p className="suite-card-tagline">{a.tagline}</p>
                  <p className="suite-card-desc">{a.desc}</p>
                  <ul className="suite-card-features">
                    {a.features.map((f) => (
                      <li key={f}>
                        <span className="suite-feat-dot" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="suite-card-cta">
                  Open {a.name} <span className="suite-cta-arrow">→</span>
                </div>
                {a.deco}
              </Link>
            ))}
          </div>
        </section>

        <footer className="suite-footer">
          <div className="suite-footer-logo">
            Korda<sup style={{ fontSize: "0.5rem", color: "rgba(232,230,225,0.2)", marginLeft: 1 }}>™</sup>
          </div>
          <div className="suite-footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
          <p className="suite-footer-copy">© {new Date().getFullYear()} Korda™. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
