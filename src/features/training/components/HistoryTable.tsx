import { useState, useEffect, useRef } from 'react';
import {
  ExternalLink, Filter, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Pencil, Trash2, X, CheckCircle2, XCircle, Link as LinkIcon, FileUp,
  ChevronsUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import CSVImporter from './CSVImporter';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchTrainingEntries, updateTrainingEntry, deleteTrainingEntry } from '../lib/trainingData';
import type { TrainingEntry, TradingSession } from '../types';

const SESSIONS: { value: TradingSession; label: string; color: string }[] = [
  { value: 'london',   label: 'London',   color: '#3b82f6' },
  { value: 'new_york', label: 'New York', color: '#8b5cf6' },
  { value: 'asia',     label: 'Asia',     color: '#f59e0b' },
];

type FilterState = 'all' | 'valid' | 'invalid';
type SortCol = 'created_at' | 'submitted_by' | 'session';
type SortDir = 'asc' | 'desc';

const ACCENT       = '#00C8FF';
const VALID_GREEN  = '#10b981';
const INVALID_RED  = '#ef4444';
const NOTE_TRUNCATE = 80;

// â”€â”€ Edit Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditModal({
  entry, onClose, onSaved,
}: {
  entry: TrainingEntry;
  onClose: () => void;
  onSaved: (updated: TrainingEntry) => void;
}) {
  const [tvUrl, setTvUrl]     = useState(entry.tradingview_url);
  const [isValid, setIsValid] = useState<boolean>(entry.is_valid_setup);
  const [session, setSession] = useState<TradingSession | null>(entry.session);
  const [notes, setNotes]     = useState(entry.notes ?? '');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!tvUrl.trim()) { toast.error('TradingView URL is required.'); return; }
    setSaving(true);
    try {
      const updated = await updateTrainingEntry(entry.id, {
        tradingview_url: tvUrl.trim(),
        is_valid_setup:  isValid,
        session:         session,
        notes:           notes.trim() || null,
      });
      toast.success('Entry updated.');
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#131920', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, width: '100%', maxWidth: 500, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>Edit Entry</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* TradingView URL */}
        <div>
          <span style={modalLabel}>TradingView URL</span>
          <div style={{ position: 'relative' }}>
            <LinkIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
            <input
              type="url"
              value={tvUrl}
              onChange={e => setTvUrl(e.target.value)}
              placeholder="https://www.tradingview.com/x/..."
              style={{ ...modalInput, paddingLeft: '2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}
            />
          </div>
        </div>

        {/* Valid / Invalid */}
        <div>
          <span style={modalLabel}>Classification</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {([true, false] as boolean[]).map(v => (
              <button key={String(v)} type="button" onClick={() => setIsValid(v)} style={{
                flex: 1, padding: '0.65rem 1rem',
                background: isValid === v ? `${v ? VALID_GREEN : INVALID_RED}14` : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isValid === v ? (v ? VALID_GREEN : INVALID_RED) : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.15s',
              }}>
                {v
                  ? <CheckCircle2 size={14} style={{ color: isValid === v ? VALID_GREEN : 'rgba(240,246,252,0.3)' }} />
                  : <XCircle      size={14} style={{ color: isValid === v ? INVALID_RED : 'rgba(240,246,252,0.3)' }} />
                }
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: isValid === v ? (v ? VALID_GREEN : INVALID_RED) : 'rgba(240,246,252,0.4)' }}>
                  {v ? 'Valid' : 'Invalid'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Session */}
        <div>
          <span style={modalLabel}>Session</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {SESSIONS.map(s => (
              <button key={s.value} type="button" onClick={() => setSession(session === s.value ? null : s.value)} style={{
                flex: 1, padding: '0.55rem 0.5rem',
                background: session === s.value ? `${s.color}18` : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${session === s.value ? s.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, cursor: 'pointer',
                fontSize: '0.8rem', fontWeight: 600,
                color: session === s.value ? s.color : 'rgba(240,246,252,0.4)',
                transition: 'all 0.15s',
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <span style={modalLabel}>Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder="Describe the setup and your reasoning..."
            style={{ ...modalInput, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '0.65rem',
              background: saving ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)',
              color: saving ? 'rgba(0,212,255,0.5)' : '#0A0A0F',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.15s',
            }}
          >
            {saving && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: 'rgba(240,246,252,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const modalLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.4)', letterSpacing: '0.05em',
  textTransform: 'uppercase', marginBottom: '0.4rem',
};

const modalInput: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  padding: '0.6rem 0.9rem', color: '#f0f6fc', fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

// â”€â”€ Main table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function HistoryTable() {
  const [entries, setEntries]   = useState<TrainingEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterState>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editEntry, setEditEntry]             = useState<TrainingEntry | null>(null);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showImporter, setShowImporter]       = useState(false);
  const [sortCol, setSortCol]   = useState<SortCol>('created_at');
  const [sortDir, setSortDir]   = useState<SortDir>('desc');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage]         = useState(1);

  const load = async () => {
    setLoading(true); setError(null);
    try { setEntries(await fetchTrainingEntries()); }
    catch (e: any) { setError(e?.message ?? 'Failed to load entries.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTrainingEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Entry deleted.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed.');
    } finally { setDeletingId(null); setConfirmDeleteId(null); }
  };

  const handleSaved    = (updated: TrainingEntry) =>
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
  const handleImported = (imported: TrainingEntry[]) =>
    setEntries(prev => [...imported, ...prev]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = entries
    .filter(e => filter === 'all' ? true : filter === 'valid' ? e.is_valid_setup : !e.is_valid_setup)
    .slice()
    .sort((a, b) => {
      let av = '', bv = '';
      if (sortCol === 'created_at')   { av = a.created_at; bv = b.created_at; }
      if (sortCol === 'submitted_by') { av = a.submitted_by ?? ''; bv = b.submitted_by ?? ''; }
      if (sortCol === 'session')      { av = a.session ?? ''; bv = b.session ?? ''; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  useEffect(() => { setPage(1); }, [filter, sortCol, sortDir]);

  const counts = {
    all:     entries.length,
    valid:   entries.filter(e => e.is_valid_setup).length,
    invalid: entries.filter(e => !e.is_valid_setup).length,
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged      = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      {showImporter && <CSVImporter onClose={() => setShowImporter(false)} onImported={handleImported} />}
      {editEntry && <EditModal entry={editEntry} onClose={() => setEditEntry(null)} onSaved={handleSaved} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>Training History</h1>
          <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
            {entries.length} labeled chart setup{entries.length !== 1 ? 's' : ''} in the dataset
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowImporter(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: `${ACCENT}0d`, border: `1px solid ${ACCENT}30`, borderRadius: 8, color: ACCENT, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <FileUp size={13} /> Import CSV
          </button>
          <button
            onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(240,246,252,0.55)', fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatPill label="Total"   value={counts.all}     color={ACCENT} />
        <StatPill label="Valid"   value={counts.valid}   color={VALID_GREEN} />
        <StatPill label="Invalid" value={counts.invalid} color={INVALID_RED} />
        {counts.all > 0 && <StatPill label="Valid rate"   value={`${Math.round((counts.valid   / counts.all) * 100)}%`} color={VALID_GREEN} />}
        {counts.all > 0 && <StatPill label="Invalid rate" value={`${Math.round((counts.invalid / counts.all) * 100)}%`} color={INVALID_RED} />}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'rgba(240,246,252,0.3)' }} />
        {(['all', 'valid', 'invalid'] as FilterState[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '0.3rem 0.9rem', borderRadius: 9999,
            border: `1px solid ${filter === f ? (f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT) : 'rgba(255,255,255,0.08)'}`,
            background: filter === f ? (f === 'valid' ? `${VALID_GREEN}12` : f === 'invalid' ? `${INVALID_RED}12` : `${ACCENT}12`) : 'transparent',
            color: filter === f ? (f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT) : 'rgba(240,246,252,0.4)',
            fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
          }}>
            {f === 'all' ? `All (${counts.all})` : f === 'valid' ? `Valid (${counts.valid})` : `Invalid (${counts.invalid})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem', color: 'rgba(240,246,252,0.4)', fontSize: '0.875rem' }}>
            <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} /> Loading entries...
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: INVALID_RED, fontSize: '0.875rem' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,246,252,0.3)', fontSize: '0.875rem' }}>
            {filter === 'all' ? 'No entries yet. Add your first training entry.' : `No ${filter} setups found.`}
          </div>
        ) : (
          <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {[
                    { label: '#',              sort: null },
                    { label: 'TradingView URL',sort: null },
                    { label: 'Session',        sort: 'session'      as SortCol },
                    { label: 'Valid?',         sort: null },
                    { label: 'By',             sort: 'submitted_by' as SortCol },
                    { label: 'Notes',          sort: null },
                    { label: 'Date',           sort: 'created_at'   as SortCol },
                    { label: '',               sort: null },
                  ].map((col, i) => (
                    <th key={i} style={{ ...thStyle, cursor: col.sort ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={() => col.sort && toggleSort(col.sort)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        {col.label}
                        {col.sort && (
                          sortCol === col.sort
                            ? sortDir === 'asc'
                              ? <ChevronUp size={11} style={{ color: ACCENT }} />
                              : <ChevronDown size={11} style={{ color: ACCENT }} />
                            : <ChevronsUpDown size={11} style={{ color: 'rgba(240,246,252,0.2)' }} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((entry, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx;
                  const isExpanded   = expanded.has(entry.id);
                  const noteText     = entry.notes ?? '';
                  const truncated    = noteText.length > NOTE_TRUNCATE;
                  const isConfirming = confirmDeleteId === entry.id;
                  const isDeleting   = deletingId === entry.id;

                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* # */}
                      <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.25)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', width: 40 }}>
                        {globalIdx + 1}
                      </td>

                      {/* TradingView URL */}
                      <td style={tdStyle}>
                        <a
                          href={entry.tradingview_url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: ACCENT, fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          <ExternalLink size={11} style={{ flexShrink: 0 }} />
                          {entry.tradingview_url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </td>

                      {/* Session */}
                      <td style={tdStyle}>
                        {entry.session ? (() => {
                          const s = SESSIONS.find(x => x.value === entry.session);
                          return s ? (
                            <span style={{ display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}40` }}>
                              {s.label}
                            </span>
                          ) : null;
                        })() : <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>â€”</span>}
                      </td>

                      {/* Valid? */}
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 9999,
                          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.03em',
                          background: entry.is_valid_setup ? `${VALID_GREEN}15` : `${INVALID_RED}15`,
                          color: entry.is_valid_setup ? VALID_GREEN : INVALID_RED,
                          border: `1px solid ${entry.is_valid_setup ? `${VALID_GREEN}40` : `${INVALID_RED}40`}`,
                        }}>
                          {entry.is_valid_setup ? 'Valid' : 'Invalid'}
                        </span>
                      </td>

                      {/* Submitted by */}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {entry.submitted_by ? (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {entry.submitted_by.split('@')[0]}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>â€”</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td style={{ ...tdStyle, maxWidth: 300 }}>
                        {noteText ? (
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.5 }}>
                              {isExpanded || !truncated ? noteText : `${noteText.slice(0, NOTE_TRUNCATE)}â€¦`}
                            </p>
                            {truncated && (
                              <button onClick={() => toggleExpand(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontSize: '0.72rem', padding: '0.2rem 0', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                {isExpanded ? <><ChevronUp size={11} /> Less</> : <><ChevronDown size={11} /> More</>}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>â€”</span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)' }}>
                        {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm')}
                      </td>

                      {/* Actions */}
                      <td style={{ ...tdStyle, width: 90 }}>
                        {isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleDelete(entry.id)} disabled={isDeleting}
                              style={{ padding: '0.3rem 0.6rem', background: INVALID_RED, color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              {isDeleting && <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />}
                              Sure?
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.35)', padding: 2, display: 'flex' }}>
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <ActionBtn onClick={() => setEditEntry(entry)} title="Edit"><Pencil size={12} /></ActionBtn>
                            <ActionBtn onClick={() => setConfirmDeleteId(entry.id)} title="Delete" danger><Trash2 size={12} /></ActionBtn>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.3)', marginRight: 'auto' }}>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}>
              <ChevronLeft size={13} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(page === totalPages)}>
              <ChevronRight size={13} />
            </button>
            <RowsSelect value={pageSize} onChange={n => { setPageSize(n); setPage(1); }} />
          </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ActionBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0.35rem',
        background: hovered ? (danger ? `${INVALID_RED}18` : 'rgba(255,255,255,0.07)') : 'none',
        border: `1px solid ${hovered ? (danger ? `${INVALID_RED}50` : 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 6, cursor: 'pointer',
        color: hovered ? (danger ? INVALID_RED : '#f0f6fc') : 'rgba(240,246,252,0.35)',
        display: 'flex', alignItems: 'center', transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.85rem', background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 9999 }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.4)' }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', verticalAlign: 'middle' };

function RowsSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(240,246,252,0.55)', fontSize: '0.75rem', cursor: 'pointer' }}>
        {value} rows <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, background: '#131920', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', zIndex: 100, minWidth: 110, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {[50, 100, 250].map(n => (
            <button key={n} onClick={() => { onChange(n); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.9rem', background: n === value ? 'rgba(0,212,255,0.08)' : 'transparent', color: n === value ? '#00C8FF' : 'rgba(240,246,252,0.7)', fontSize: '0.8rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {n} rows
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, padding: 0,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? 'rgba(240,246,252,0.2)' : 'rgba(240,246,252,0.55)',
});
