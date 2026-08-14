import type { ReactNode } from 'react';
import { Inbox, AlertTriangle } from 'lucide-react';
import type { ContactSource, EmailStatus } from '../types';
import { errorMessage } from '../errors';

/** Deliverability state — a soft pill, coloured by risk. */
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const dot: Record<EmailStatus, string> = {
    verified: '#34d399',
    guessed: '#f7a14a',
    bounced: '#f87171',
    unverified: 'rgba(240,233,226,0.4)',
  };
  return (
    <span className={`o-pill o-pill-${status}`}>
      <span className="o-pill-dot" style={{ background: dot[status] }} />
      {status}
    </span>
  );
}

/**
 * Provenance is context, not risk — kept neutral, with one exception. Hunter is
 * the only source that returns a named person with a job title, so those rows
 * are the ones worth picking out of a column of info@ addresses.
 */
export function SourceBadge({ source }: { source: ContactSource }) {
  const accent = source === 'hunter' ? 'o-pill-verified' : 'o-pill-neutral';
  return <span className={`o-pill ${accent}`}>{source}</span>;
}

/** Confidence as a gradient meter — scannable down a column, precise on read. */
export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill =
    value >= 0.7 ? 'linear-gradient(90deg, #34d399, #6ee7b7)'
    : value >= 0.4 ? 'linear-gradient(90deg, #f7a14a, #fbbf6e)'
    : 'linear-gradient(90deg, rgba(240,233,226,0.28), rgba(240,233,226,0.42))';

  return (
    <div className="o-meter">
      <div className="o-meter-track">
        <div className="o-meter-fill" style={{ width: `${pct}%`, background: fill }} />
      </div>
      <span className="o-meter-num">{value.toFixed(2)}</span>
    </div>
  );
}

export function PageHeader({
  eyebrow, title, sub, actions,
}: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
      <div>
        {eyebrow && <span className="o-eyebrow">{eyebrow}</span>}
        <h1 className="outreach-page-title">{title}</h1>
        {sub && <p className="outreach-page-sub">{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="o-panel" style={style}>{children}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="o-panel o-state">
      <div className="o-state-icon"><Inbox size={19} /></div>
      <p className="o-state-title">{title}</p>
      {hint && <p className="o-state-hint">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  // Not String(error): a Supabase error is a plain object, so that rendered a
  // literal "[object Object]" where the reason should have been.
  const message = errorMessage(error, 'Unknown error.');
  return (
    <div className="o-panel o-state">
      <div className="o-state-icon" style={{ background: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.25)', color: '#fca5a5' }}>
        <AlertTriangle size={19} />
      </div>
      <p className="o-state-title">Couldn't load this</p>
      <p className="o-state-hint">{message}</p>
      <p className="o-state-hint" style={{ opacity: 0.75 }}>
        If that's a permission error, apply the outreach RLS patch to Supabase.
      </p>
    </div>
  );
}
