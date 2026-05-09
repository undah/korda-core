import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DarkSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface DarkSelectProps {
  options: DarkSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fontSize?: string;
  padding?: string;
  background?: string;
  position?: 'down' | 'up';
  style?: React.CSSProperties;
}

export function DarkSelect({
  options,
  value,
  onChange,
  placeholder = '— None —',
  fontSize = '0.85rem',
  padding = '0.6rem 0.9rem',
  background = 'rgba(255,255,255,0.04)',
  position = 'down',
  style,
}: DarkSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          background,
          border: `1px solid ${open ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8, padding, cursor: 'pointer', fontSize,
          color: selected?.value ? '#f0f6fc' : 'rgba(240,246,252,0.35)',
          transition: 'border-color 0.15s', textAlign: 'left', fontFamily: 'inherit',
          outline: 'none', boxSizing: 'border-box',
        }}
      >
        {selected?.color && selected.value && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: selected.color, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1 }}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={13} style={{ color: 'rgba(240,246,252,0.3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          ...(position === 'up' ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
          left: 0, right: 0,
          background: '#131920', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, overflow: 'hidden', zIndex: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                width: '100%', textAlign: 'left', padding: '0.55rem 0.9rem',
                background: o.value === value ? 'rgba(0,200,255,0.08)' : 'transparent',
                color: o.value === value ? '#00C8FF' : o.color ?? (o.value ? '#f0f6fc' : 'rgba(240,246,252,0.35)'),
                fontSize, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {o.color && o.value && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
