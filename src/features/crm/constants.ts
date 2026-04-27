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
  'Niet bereikt':          { color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB' },
  'Geen Gehoor':           { color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' },
  'Niet Geïnteresseerd':   { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  'Terugbellen':           { color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  'Geïnteresseerd':        { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  'Gesloten':              { color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
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
  if (count === 0)   return { bg: '#F9FAFB', text: '#9CA3AF' };
  if (count < 15)    return { bg: '#FEF2F2', text: '#DC2626' };
  if (count < 25)    return { bg: '#FFFBEB', text: '#B45309' };
  return               { bg: '#F0FDF4', text: '#15803D' };
};
