import { useState, useEffect } from 'react';
import { ExternalLink, FileUp, Link as LinkIcon, Loader2, Pencil, RefreshCw, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchMistakes, insertMistake, updateMistake, deleteMistake } from '../lib/trainingData';
import type { Mistake } from '../types';
import MistakesImporter from './MistakesImporter';

const ACCENT = '#00d4ff';
const NOTE_TRUNCATE = 100;

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ entry, onClose, onSaved }: {
  entry: Mistake;
  onClose: () => void;
  onSaved: (updated: Mistake) => void;
}) {
  const [url, setUrl]         = useState(entry.screenshot_url);
  const [mistake, setMistake] = useState(entry.mistake);
  const [reason, setReason]   = useState(entry.reason ?? '');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSave = async () => {
    if (!url.trim() || !mistake.trim()) { toast.error('URL and mistake are required.'); return; }
    setSaving(true);
    try {
      const updated = await updateMistake(entry.id, {
        screenshot_url: url.trim(),
        mistake: mistake.trim(),
        reason: reason.trim() || null,
      });
      toast.success('Mistake updated.');
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Update failed.');
    } finally { setSaving(false); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#131920', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, width: '100%', maxWidth: 540, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>Edit Mistake</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        <div>
          <label style={labelStyle}>Screenshot URL</label>
          <div style={{ position: 'relative' }}>
            <LinkIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} style={{ ...inputStyle, paddingLeft: '2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }} placeholder="https://www.tradingview.com/x/..." />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Mistake</label>
          <input value={mistake} onChange={e => setMistake(e.target.value)} style={inputStyle} placeholder="e.g. Said invalid, was actually valid" />
        </div>

        <div>
          <label style={labelStyle}>Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Detailed explanation of why the bot was wrong..." />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.65rem', background: saving ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00d4ff 0%, #0090b3 100%)', color: saving ? 'rgba(0,212,255,0.5)' : '#0d1117', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: 'rgba(240,246,252,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MistakesPage() {
  const [entries, setEntries]             = useState<Mistake[]>([]);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);
  const [editEntry, setEditEntry]         = useState<Mistake | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [expanded, setExpanded]           = useState<Set<string>>(new Set());
  const [showImporter, setShowImporter]   = useState(false);

  const [url, setUrl]         = useState('');
  const [mistake, setMistake] = useState('');
  const [reason, setReason]   = useState('');

  const load = async () => {
    setLoading(true);
    try { setEntries(await fetchMistakes()); }
    catch (err: any) { toast.error(err?.message ?? 'Failed to load.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!url.trim() || !mistake.trim()) { toast.error('URL and mistake are required.'); return; }
    setSubmitting(true);
    try {
      const created = await insertMistake({ screenshot_url: url.trim(), mistake: mistake.trim(), reason: reason.trim() || null });
      setEntries(prev => [created, ...prev]);
      setUrl(''); setMistake(''); setReason('');
      toast.success('Mistake logged.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save.');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMistake(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Deleted.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Delete failed.');
    } finally { setDeletingId(null); setConfirmDeleteId(null); }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {editEntry && <EditModal entry={editEntry} onClose={() => setEditEntry(null)} onSaved={updated => setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))} />}
      {showImporter && <MistakesImporter onClose={() => setShowImporter(false)} onImported={imported => setEntries(prev => [...imported, ...prev])} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>Bot Mistakes</h1>
          <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
            {entries.length} logged mistake{entries.length !== 1 ? 's' : ''} — used to improve future evaluations.
          </p>
        </div>
        <button onClick={() => setShowImporter(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: `${ACCENT}0d`, border: `1px solid ${ACCENT}30`, borderRadius: 8, color: ACCENT, fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          <FileUp size={13} /> Import CSV
        </button>
      </div>

      {/* Add form */}
      <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(240,246,252,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Log New Mistake</span>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={labelStyle}>Screenshot URL</label>
            <div style={{ position: 'relative' }}>
              <LinkIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.tradingview.com/x/..." style={{ ...inputStyle, paddingLeft: '2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }} />
            </div>
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={labelStyle}>Mistake</label>
            <input value={mistake} onChange={e => setMistake(e.target.value)} placeholder="e.g. Said invalid, was actually valid" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Explain why the bot was wrong and what the correct reasoning should have been..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        <div>
          <button onClick={handleSubmit} disabled={submitting} style={{ padding: '0.6rem 1.5rem', background: submitting ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00d4ff 0%, #0090b3 100%)', color: submitting ? 'rgba(0,212,255,0.5)' : '#0d1117', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            {submitting && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {submitting ? 'Saving...' : 'Log Mistake'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(240,246,252,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>History</span>
        <button onClick={load} disabled={loading} style={{ background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer', color: loading ? `${ACCENT}99` : 'rgba(240,246,252,0.35)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: 0 }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem', color: 'rgba(240,246,252,0.4)', fontSize: '0.875rem' }}>
            <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} /> Loading...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,246,252,0.25)', fontSize: '0.85rem' }}>No mistakes logged yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['#', 'Screenshot', 'Mistake', 'Reason', 'Date', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isExpanded   = expanded.has(entry.id);
                  const reasonText   = entry.reason ?? '';
                  const truncated    = reasonText.length > NOTE_TRUNCATE;
                  const isConfirming = confirmDeleteId === entry.id;
                  const isDeleting   = deletingId === entry.id;

                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.25)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', width: 36 }}>{idx + 1}</td>

                      <td style={tdStyle}>
                        <a href={entry.screenshot_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: ACCENT, fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", textDecoration: 'none', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <ExternalLink size={11} style={{ flexShrink: 0 }} />
                          {entry.screenshot_url.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      </td>

                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        <span style={{ fontSize: '0.8rem', color: '#f0f6fc', fontWeight: 500 }}>{entry.mistake}</span>
                      </td>

                      <td style={{ ...tdStyle, maxWidth: 320 }}>
                        {reasonText ? (
                          <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.5 }}>
                              {isExpanded || !truncated ? reasonText : `${reasonText.slice(0, NOTE_TRUNCATE)}…`}
                            </p>
                            {truncated && (
                              <button onClick={() => toggleExpand(entry.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontSize: '0.72rem', padding: '0.2rem 0', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                {isExpanded ? <><ChevronUp size={11} /> Less</> : <><ChevronDown size={11} /> More</>}
                              </button>
                            )}
                          </div>
                        ) : <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>—</span>}
                      </td>

                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)' }}>
                        {format(new Date(entry.created_at), 'dd MMM yyyy')}
                      </td>

                      <td style={{ ...tdStyle, width: 90 }}>
                        {isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button onClick={() => handleDelete(entry.id)} disabled={isDeleting} style={{ padding: '0.3rem 0.6rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {isDeleting && <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />} Sure?
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.35)', padding: 2, display: 'flex' }}><X size={13} /></button>
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
        )}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ padding: '0.35rem', background: hovered ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)') : 'none', border: `1px solid ${hovered ? (danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.15)') : 'rgba(255,255,255,0.07)'}`, borderRadius: 6, cursor: 'pointer', color: hovered ? (danger ? '#ef4444' : '#f0f6fc') : 'rgba(240,246,252,0.35)', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
    >
      {children}
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.4)', letterSpacing: '0.05em',
  textTransform: 'uppercase', marginBottom: '0.35rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  padding: '0.6rem 0.9rem', color: '#f0f6fc', fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = { padding: '0.75rem 1rem', verticalAlign: 'top' };
