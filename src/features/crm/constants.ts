import type { LeadStatus } from './types';

export const DAILY_GOAL = 25;

export const LEAD_STATUSES: LeadStatus[] = [
  'Niet bereikt',
  'Geen Gehoor',
  'Niet Geïnteresseerd',
  'Terugbellen',
  'Geïnteresseerd',
  'Gesloten',
];

export const STATUS_STYLE: Record<LeadStatus, { color: string; bg: string; border: string }> = {
  'Niet bereikt':          { color: '#9CA3AF', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)' },
  'Geen Gehoor':           { color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)' },
  'Niet Geïnteresseerd':   { color: '#f87171', bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.25)' },
  'Terugbellen':           { color: '#FCD34D', bg: 'rgba(180,83,9,0.15)',    border: 'rgba(180,83,9,0.3)' },
  'Geïnteresseerd':        { color: '#4ade80', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.25)' },
  'Gesloten':              { color: '#22c55e', bg: 'rgba(21,128,61,0.15)',   border: 'rgba(21,128,61,0.3)' },
};

export const REP_COLOR: Record<string, string> = {
  'Jamiro':   '#3B82F6',
  'Easton':   '#8B5CF6',
  "G'Dionne": '#0D9488',
};

export const DEFAULT_REP_COLOR = '#94A3B8';

export function getRepColor(name: string): string {
  return REP_COLOR[name] ?? DEFAULT_REP_COLOR;
}

export const WEEK_CELL_COLOR = (count: number): { bg: string; text: string } => {
  if (count === 0)   return { bg: 'rgba(255,255,255,0.03)', text: 'rgba(240,246,252,0.25)' };
  if (count < 15)    return { bg: 'rgba(220,38,38,0.12)',   text: '#f87171' };
  if (count < 25)    return { bg: 'rgba(180,83,9,0.15)',    text: '#FCD34D' };
  return               { bg: 'rgba(21,128,61,0.15)',   text: '#4ade80' };
};
