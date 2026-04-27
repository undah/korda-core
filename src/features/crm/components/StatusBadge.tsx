import { STATUS_STYLE } from '../constants';
import type { LeadStatus } from '../types';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '0.15rem 0.5rem' : '0.2rem 0.65rem',
      borderRadius: 9999,
      fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
      fontWeight: 500,
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
    }}>
      {status}
    </span>
  );
}

interface StatusDotProps {
  status: LeadStatus;
}

export function StatusDot({ status }: StatusDotProps) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: s.color,
      flexShrink: 0,
    }} />
  );
}
