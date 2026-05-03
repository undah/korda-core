import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ExternalLink, Filter, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Pencil, Trash2, X, CheckCircle2, XCircle, ImageIcon, Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchTrainingEntries, updateTrainingEntry, deleteTrainingEntry, uploadScreenshot } from '../lib/trainingData';
import type { TrainingEntry } from '../types';

type FilterState = 'all' | 'valid' | 'invalid';

const ACCENT       = '#00d4ff';
const VALID_GREEN  = '#10b981';
const INVALID_RED  = '#ef4444';
const NOTE_TRUNCATE = 80;

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: TrainingEntry;
  onClose: () => void;
  onSaved: (updated: TrainingEntry) => void;
}) {
  const [tvUrl, setTvUrl]       = useState(entry.tradingview_url);
  const [isValid, setIsValid]   = useState<boolean>(entry.is_valid_setup);
  const [notes, setNotes]       = useState(entry.notes ?? '');
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(entry.screenshot_url);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Image files only.'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, [handleFileSelect]);

  const handleSave = async () => {
    if (!tvUrl.trim() && !preview) {
      toast.error('Provide a screenshot or TradingView URL.');
      return;
    }
    setSaving(true);
    try {
      let screenshotUrl = entry.screenshot_url;
      if (file) screenshotUrl = await uploadScreenshot(file);

      const updated = await updateTrainingEntry(entry.id, {
        tradingview_url: tvUrl.trim() || screenshotUrl || '',
        screenshot_url:  screenshotUrl,
        is_valid_setup:  isValid,
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
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#131920',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14,
        width: '100%', maxWidth: 560,
        padding: '1.75rem',
        display: 'flex', flexDirection: 'column', gap: '1.25rem',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>
            Edit Entry
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', padding: 4, display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Screenshot upload */}
        <div>
          <span style={modalLabel}>Screenshot</span>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragging ? ACCENT : preview ? VALID_GREEN : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 9,
              overflow: 'hidden',
              cursor: 'pointer',
              background: dragging ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)',
              minHeight: preview ? 0 : 90,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '0.4rem',
              transition: 'all 0.15s',
            }}
          >
            {preview ? (
              <img src={preview} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover' }} />
            ) : (
              <>
                <ImageIcon size={20} style={{ color: 'rgba(240,246,252,0.25)' }} />
                <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.35)' }}>
                  {dragging ? 'Drop here' : 'Click or drag to replace screenshot'}
                </span>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          {preview && (
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: INVALID_RED, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Remove screenshot
            </button>
          )}
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
              placeholder="https://www.tradingview.com/chart/..."
              style={{ ...modalInput, paddingLeft: '2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}
            />
          </div>
        </div>

        {/* Valid / Invalid */}
        <div>
          <span style={modalLabel}>Classification</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {([true, false] as boolean[]).map(v => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setIsValid(v)}
                style={{
                  flex: 1, padding: '0.65rem 1rem',
                  background: isValid === v ? `${v ? VALID_GREEN : INVALID_RED}14` : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${isValid === v ? (v ? VALID_GREEN : INVALID_RED) : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.15s',
                }}
              >
                {v
                  ? <CheckCircle2 size={14} style={{ color: isValid === v ? VALID_GREEN : 'rgba(240,246,252,0.3)' }} />
                  : <XCircle     size={14} style={{ color: isValid === v ? INVALID_RED : 'rgba(240,246,252,0.3)' }} />
                }
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: isValid === v ? (v ? VALID_GREEN : INVALID_RED) : 'rgba(240,246,252,0.4)' }}>
                  {v ? 'Valid' : 'Invalid'}
                </span>
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
              background: saving ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00d4ff 0%, #0090b3 100%)',
              color: saving ? 'rgba(0,212,255,0.5)' : '#0d1117',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.875rem',
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
            style={{
              padding: '0.65rem 1.25rem',
              background: 'transparent', color: 'rgba(240,246,252,0.4)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
              fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s',
            }}
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
  display: 'block',
  fontSize: '0.72rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.4)',
  letterSpacing: '0.05em', textTransform: 'uppercase',
  marginBottom: '0.4rem',
};

const modalInput: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '0.6rem 0.9rem',
  color: '#f0f6fc', fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

// ── Main table ────────────────────────────────────────────────────────────────

export default function HistoryTable() {
  const [entries, setEntries]   = useState<TrainingEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<FilterState>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editEntry, setEditEntry]       = useState<TrainingEntry | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchTrainingEntries());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load entries.');
    } finally {
      setLoading(false);
    }
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
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleSaved = (updated: TrainingEntry) =>
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));

  const filtered = entries.filter(e =>
    filter === 'all' ? true : filter === 'valid' ? e.is_valid_setup : !e.is_valid_setup
  );

  const counts = {
    all:     entries.length,
    valid:   entries.filter(e => e.is_valid_setup).length,
    invalid: entries.filter(e => !e.is_valid_setup).length,
  };

  return (
    <div>
      {/* Edit modal */}
      {editEntry && (
        <EditModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={handleSaved}
        />
      )}

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
            borderRadius: 8, color: 'rgba(240,246,252,0.55)',
            fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatPill label="Total"      value={counts.all}     color={ACCENT} />
        <StatPill label="Valid"      value={counts.valid}   color={VALID_GREEN} />
        <StatPill label="Invalid"    value={counts.invalid} color={INVALID_RED} />
        {counts.all > 0 && (
          <StatPill label="Valid rate" value={`${Math.round((counts.valid / counts.all) * 100)}%`} color={ACCENT} />
        )}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'rgba(240,246,252,0.3)' }} />
        {(['all', 'valid', 'invalid'] as FilterState[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.3rem 0.9rem', borderRadius: 9999,
              border: `1px solid ${filter === f ? (f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT) : 'rgba(255,255,255,0.08)'}`,
              background: filter === f ? (f === 'valid' ? `${VALID_GREEN}12` : f === 'invalid' ? `${INVALID_RED}12` : `${ACCENT}12`) : 'transparent',
              color: filter === f ? (f === 'valid' ? VALID_GREEN : f === 'invalid' ? INVALID_RED : ACCENT) : 'rgba(240,246,252,0.4)',
              fontSize: '0.75rem', fontWeight: 500,
              cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s',
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
        borderRadius: 12, overflow: 'hidden',
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
                  {['#', 'Screenshot', 'TradingView', 'Valid?', 'Notes', 'Date', ''].map((col, i) => (
                    <th key={i} style={thStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
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
                        {idx + 1}
                      </td>

                      {/* Screenshot */}
                      <td style={{ ...tdStyle, width: 72 }}>
                        {entry.screenshot_url ? (
                          <a href={entry.screenshot_url} target="_blank" rel="noreferrer">
                            <img
                              src={entry.screenshot_url} alt="chart"
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
                            href={entry.tradingview_url} target="_blank" rel="noreferrer"
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
                          display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 9999,
                          fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.03em',
                          background: entry.is_valid_setup ? `${VALID_GREEN}15` : `${INVALID_RED}15`,
                          color: entry.is_valid_setup ? VALID_GREEN : INVALID_RED,
                          border: `1px solid ${entry.is_valid_setup ? `${VALID_GREEN}40` : `${INVALID_RED}40`}`,
                        }}>
                          {entry.is_valid_setup ? 'Valid' : 'Invalid'}
                        </span>
                      </td>

                      {/* Notes */}
                      <td style={{ ...tdStyle, maxWidth: 260 }}>
                        {noteText ? (
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.5 }}>
                              {isExpanded || !truncated ? noteText : `${noteText.slice(0, NOTE_TRUNCATE)}…`}
                            </p>
                            {truncated && (
                              <button
                                onClick={() => toggleExpand(entry.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontSize: '0.72rem', padding: '0.2rem 0', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
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

                      {/* Actions */}
                      <td style={{ ...tdStyle, width: 90 }}>
                        {isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={isDeleting}
                              style={{
                                padding: '0.3rem 0.6rem',
                                background: INVALID_RED, color: '#fff',
                                border: 'none', borderRadius: 6,
                                fontSize: '0.72rem', fontWeight: 600,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                              }}
                            >
                              {isDeleting ? <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                              Sure?
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.35)', padding: 2, display: 'flex' }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <ActionBtn onClick={() => setEditEntry(entry)} title="Edit">
                              <Pencil size={12} />
                            </ActionBtn>
                            <ActionBtn onClick={() => setConfirmDeleteId(entry.id)} title="Delete" danger>
                              <Trash2 size={12} />
                            </ActionBtn>
                          </div>
                        )}
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function ActionBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0.35rem',
        background: hovered ? (danger ? `${INVALID_RED}18` : 'rgba(255,255,255,0.07)') : 'none',
        border: `1px solid ${hovered ? (danger ? `${INVALID_RED}50` : 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 6, cursor: 'pointer',
        color: hovered ? (danger ? INVALID_RED : '#f0f6fc') : 'rgba(240,246,252,0.35)',
        display: 'flex', alignItems: 'center',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.35rem 0.85rem',
      background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 9999,
    }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.4)' }}>{label}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem', textAlign: 'left',
  fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.3)',
  letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', verticalAlign: 'middle',
};
