import { useState, useEffect } from 'react';
import { ExternalLink, Filter, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchTrainingEntries } from '../lib/trainingData';
import type { TrainingEntry } from '../types';
import { format } from 'date-fns';

type FilterState = 'all' | 'valid' | 'invalid';

const ACCENT = '#00d4ff';
const VALID_GREEN = '#10b981';
const INVALID_RED = '#ef4444';
const NOTE_TRUNCATE = 80;

export default function HistoryTable() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTrainingEntries();
      setEntries(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = entries.filter(e =>
    filter === 'all' ? true :
    filter === 'valid' ? e.is_valid_setup :
    !e.is_valid_setup
  );

  const counts = {
    all: entries.length,
    valid: entries.filter(e => e.is_valid_setup).length,
    invalid: entries.filter(e => !e.is_valid_setup).length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>
            Training History
          </h1>
          <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
            {entries.length} labeled chart setup{entries.length !== 1 ? 's' : ''} in the dataset
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: 'rgba(240,246,252,0.55)',
            fontSize: '0.8rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatPill label="Total" value={counts.all} color={ACCENT} />
        <StatPill label="Valid" value={counts.valid} color={VALID_GREEN} />
        <StatPill label="Invalid" value={counts.invalid} color={INVALID_RED} />
        {counts.all > 0 && (
          <StatPill
            label="Valid rate"
            value={`${Math.round((counts.valid / counts.all) * 100)}%`}
            color={ACCENT}
          />
        )}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'rgba(240,246,252,0.3)' }} />
        {(['all', 'valid', 'invalid'] as FilterState[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.3rem 0.9rem',
              borderRadius: 9999,
              border: `1px solid ${filter === f
                ? f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT
                : 'rgba(255,255,255,0.08)'
              }`,
              background: filter === f
                ? f === 'valid' ? `${VALID_GREEN}12` : f === 'invalid' ? `${INVALID_RED}12` : `${ACCENT}12`
                : 'transparent',
              color: filter === f
                ? f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT
                : 'rgba(240,246,252,0.4)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {f === 'all' ? `All (${counts.all})` : f === 'valid' ? `Valid (${counts.valid})` : `Invalid (${counts.invalid})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem', color: 'rgba(240,246,252,0.4)', fontSize: '0.875rem' }}>
            <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} />
            Loading entries...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: INVALID_RED, fontSize: '0.875rem' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,246,252,0.3)', fontSize: '0.875rem' }}>
            {filter === 'all' ? 'No entries yet. Add your first training entry.' : `No ${filter} setups found.`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['#', 'Screenshot', 'TradingView', 'Valid?', 'Notes', 'Date'].map(col => (
                    <th key={col} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  const isExpanded = expanded.has(entry.id);
                  const noteText = entry.notes ?? '';
                  const truncated = noteText.length > NOTE_TRUNCATE;

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* # */}
                      <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.25)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', width: 40 }}>
                        {idx + 1}
                      </td>

                      {/* Screenshot */}
                      <td style={{ ...tdStyle, width: 72 }}>
                        {entry.screenshot_url ? (
                          <a href={entry.screenshot_url} target="_blank" rel="noreferrer">
                            <img
                              src={entry.screenshot_url}
                              alt="chart"
                              style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', display: 'block', transition: 'opacity 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>—</span>
                        )}
                      </td>

                      {/* TradingView URL */}
                      <td style={tdStyle}>
                        {entry.tradingview_url ? (
                          <a
                            href={entry.tradingview_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              color: ACCENT, fontSize: '0.75rem',
                              fontFamily: "'JetBrains Mono', monospace",
                              textDecoration: 'none',
                              maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}
                          >
                            <ExternalLink size={11} style={{ flexShrink: 0 }} />
                            {entry.tradingview_url.replace(/^https?:\/\/(www\.)?/, '')}
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>—</span>
                        )}
                      </td>

                      {/* Valid? */}
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.65rem',
                          borderRadius: 9999,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          background: entry.is_valid_setup ? `${VALID_GREEN}15` : `${INVALID_RED}15`,
                          color: entry.is_valid_setup ? VALID_GREEN : INVALID_RED,
                          border: `1px solid ${entry.is_valid_setup ? `${VALID_GREEN}40` : `${INVALID_RED}40`}`,
                        }}>
                          {entry.is_valid_setup ? 'Valid' : 'Invalid'}
                        </span>
                      </td>

                      {/* Notes */}
                      <td style={{ ...tdStyle, maxWidth: 280 }}>
                        {noteText ? (
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.5 }}>
                              {isExpanded || !truncated ? noteText : `${noteText.slice(0, NOTE_TRUNCATE)}…`}
                            </p>
                            {truncated && (
                              <button
                                onClick={() => toggleExpand(entry.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: ACCENT, fontSize: '0.72rem', padding: '0.2rem 0',
                                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                }}
                              >
                                {isExpanded ? <><ChevronUp size={11} /> Less</> : <><ChevronDown size={11} /> More</>}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)' }}>
                        {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      padding: '0.35rem 0.85rem',
      background: `${color}0d`,
      border: `1px solid ${color}25`,
      borderRadius: 9999,
    }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.4)' }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem',
  textAlign: 'left',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(240,246,252,0.3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  verticalAlign: 'middle',
};
