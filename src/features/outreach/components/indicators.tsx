import type { ReactNode } from 'react';
import type { ContactSource, EmailStatus } from '../types';

/** Status reads as a machine code — bracketed, uppercase, coloured by risk. */
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <span className={`o-tag o-tag-${status}`}>[{status.toUpperCase()}]</span>;
}

/** Provenance is quieter than status — a dim mono readout with a » lead-in. */
export function SourceBadge({ source }: { source: ContactSource }) {
  return <span className="o-src">{source}</span>;
}

/**
 * Confidence as an ASCII meter: `███████░░░ 0.70`. Filled cells are coloured by
 * tier so a column of them scans instantly; the number stays for precision.
 */
export function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.min(1, Math.max(0, value));
  const filled = Math.round(clamped * 10);
  const tone = value >= 0.7 ? 'var(--o-green)' : value >= 0.4 ? 'var(--o-amber)' : 'var(--o-dim)';
  return (
    <span className="o-meter">
      <span>
        <span style={{ color: tone }}>{'█'.repeat(filled)}</span>
        <span className="o-meter-empty">{'█'.repeat(10 - filled)}</span>
      </span>
      <span className="o-meter-num">{value.toFixed(2)}</span>
    </span>
  );
}

/**
 * Prompt-style page header. `path` renders as the terminal location so every
 * screen announces where you are: operator@outreach:~/leads
 */
export function PageHeader({
  path, title, sub, actions,
}: { path: string; title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
      <div>
        <p className="o-prompt">
          operator@outreach:<b>~/{path}</b> <span className="o-caret">▊</span>
        </p>
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
    <div className="o-readout">
      <p className="o-readout-line">
        <span style={{ color: 'var(--o-amber)' }}>›</span> {title}
      </p>
      {hint && <p className="o-readout-hint">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="o-readout">
      <p className="o-readout-err">✗ read failed</p>
      <p className="o-readout-hint" style={{ marginTop: '0.6rem' }}>{message}</p>
      <p className="o-readout-hint">
        permission denied? apply the outreach RLS patch to Supabase.
      </p>
    </div>
  );
}
