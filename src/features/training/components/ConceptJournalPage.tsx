import { useState, useEffect, useCallback } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ExternalLink, FileUp, Images, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  fetchConceptEntries, insertConceptEntry, updateConceptEntry, deleteConceptEntry, bulkDeleteConceptEntries,
  fetchConceptExamples, insertConceptExample, deleteConceptExample,
} from '../lib/trainingData';
import type { ConceptEntry, ConceptEntryInsert, ConceptExample, ConceptExampleInsert } from '../types';
import ConceptsImporter from './ConceptsImporter';

const ACCENT     = '#00C8FF';
const DELETE_RED = '#ef4444';
const PAGE_SIZE  = 15;

const EXAMPLE_TYPES = ['Setup', 'Entry', 'Exit', 'Structure', 'Liquidity', 'Order Flow', 'Trap', 'Failed', 'Other'];

type PendingBulkAction = { kind: 'delete' };

// ── Custom checkbox ───────────────────────────────────────────────────────────

function CustomCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const [hovered, setHovered] = useState(false);
  const active = checked || indeterminate;
  return (
    <div
      onClick={onChange}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${active ? ACCENT : hovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
        background: active ? `${ACCENT}18` : hovered ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
      }}
    >
      {checked && (
        <svg width={9} height={7} viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.2 5.8L8 1" stroke={ACCENT} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {!checked && indeterminate && <div style={{ width: 7, height: 1.5, background: ACCENT, borderRadius: 1 }} />}
    </div>
  );
}

// ── Bulk confirm modal ────────────────────────────────────────────────────────

function BulkConfirmModal({ count, onConfirm, onCancel, working }: { count: number; onConfirm: () => void; onCancel: () => void; working: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !working) onCancel(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onCancel, working]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (!working && e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: '#131920', border: `1px solid ${DELETE_RED}40`, borderRadius: 14, width: '100%', maxWidth: 400, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f0f6fc', marginBottom: '0.4rem' }}>Delete {count} concept{count !== 1 ? 's' : ''}?</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(240,246,252,0.45)' }}>This action cannot be undone. The selected entries will be permanently removed.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={working} style={{ padding: '0.55rem 1.1rem', background: 'transparent', color: 'rgba(240,246,252,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.82rem', cursor: working ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={working} style={{ padding: '0.55rem 1.1rem', background: working ? `${DELETE_RED}30` : `${DELETE_RED}18`, color: working ? `${DELETE_RED}80` : DELETE_RED, border: `1px solid ${DELETE_RED}35`, borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: working ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {working && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit concept modal ────────────────────────────────────────────────────────

function EditModal({ entry, onSave, onClose }: { entry: ConceptEntry; onSave: (updates: Partial<ConceptEntryInsert>) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<ConceptEntryInsert>({
    concept: entry.concept, explanation: entry.explanation,
    example_url: entry.example_url ?? '', notes: entry.notes ?? '', submitted_by: entry.submitted_by ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose, saving]);

  const handleSave = async () => {
    if (!form.concept.trim() || !form.explanation.trim()) { toast.error('Concept and explanation are required.'); return; }
    setSaving(true);
    try {
      await onSave({ concept: form.concept.trim(), explanation: form.explanation.trim(), example_url: form.example_url?.trim() || null, notes: form.notes?.trim() || null, submitted_by: form.submitted_by?.trim() || null });
    } finally { setSaving(false); }
  };

  const fs: React.CSSProperties = { width: '100%', padding: '0.55rem 0.75rem', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
  const ls: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'rgba(240,246,252,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (!saving && e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#131920', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f0f6fc' }}>Edit Concept</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', display: 'flex', padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label style={ls}>Concept *</label><input value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} style={fs} placeholder="e.g. Liquidity Sweep" /></div>
          <div><label style={ls}>Explanation *</label><textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={4} style={{ ...fs, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Describe what this concept means…" /></div>
          <div><label style={ls}>Notes</label><textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...fs, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Additional notes or context…" /></div>
          <div><label style={ls}>Submitted by</label><input value={form.submitted_by ?? ''} onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))} style={fs} placeholder="Username" /></div>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '0.6rem 1.1rem', background: 'transparent', color: 'rgba(240,246,252,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.concept.trim() || !form.explanation.trim()} style={{ padding: '0.6rem 1.25rem', background: saving || !form.concept.trim() || !form.explanation.trim() ? 'rgba(0,200,255,0.1)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)', color: saving || !form.concept.trim() || !form.explanation.trim() ? 'rgba(0,200,255,0.4)' : '#0A0A0F', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {saving && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Concept detail modal (examples) ──────────────────────────────────────────

function typeColor(t: string | null): string {
  const map: Record<string, string> = {
    setup: '#6366f1', entry: '#22c55e', exit: '#ef4444', structure: '#3b82f6',
    liquidity: '#00C8FF', 'order flow': '#8b5cf6', trap: '#f59e0b', failed: '#ef4444', other: '#6b7280',
  };
  return map[(t ?? 'other').toLowerCase()] ?? '#6b7280';
}

function ConceptDetailModal({ concept, onClose }: { concept: ConceptEntry; onClose: () => void }) {
  const [examples, setExamples] = useState<ConceptExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm, setAddForm] = useState<ConceptExampleInsert>({ concept_id: concept.id, url: '', notes: '', example_type: '' });
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<ConceptExample | null>(null);

  useEffect(() => {
    fetchConceptExamples(concept.id).then(data => { setExamples(data); setLoading(false); }).catch(() => setLoading(false));
  }, [concept.id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (lightbox) setLightbox(null); else onClose(); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose, lightbox]);

  const handleAdd = async () => {
    if (!addForm.url?.trim() && !addForm.notes?.trim()) { toast.error('Add a URL or notes.'); return; }
    setAdding(true);
    try {
      const ex = await insertConceptExample({
        concept_id: concept.id,
        url: addForm.url?.trim() || null,
        notes: addForm.notes?.trim() || null,
        example_type: addForm.example_type?.trim() || null,
      });
      setExamples(prev => [ex, ...prev]);
      setAddForm({ concept_id: concept.id, url: '', notes: '', example_type: '' });
      toast.success('Example added.');
    } catch (err: any) { toast.error(err?.message ?? 'Failed to add example.'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConceptExample(id);
      setExamples(prev => prev.filter(e => e.id !== id));
      toast.success('Example removed.');
    } catch (err: any) { toast.error(err?.message ?? 'Failed to delete example.'); }
  };

  const fs: React.CSSProperties = { width: '100%', padding: '0.5rem 0.7rem', background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f0f6fc', fontSize: '0.83rem', outline: 'none', boxSizing: 'border-box' };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div style={{ background: '#0F1419', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: '2rem' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.5rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <BookOpen size={16} style={{ color: ACCENT, flexShrink: 0 }} />
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.01em' }}>{concept.concept}</h2>
              </div>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.6 }}>{concept.explanation}</p>
              {concept.notes && <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: 'rgba(240,246,252,0.35)', fontStyle: 'italic' }}>{concept.notes}</p>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.35)', display: 'flex', padding: 4, flexShrink: 0 }}><X size={18} /></button>
          </div>

          {/* Add example form */}
          <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,200,255,0.03)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,246,252,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' }}>Add Example</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <input value={addForm.url ?? ''} onChange={e => setAddForm(f => ({ ...f, url: e.target.value }))} style={fs} placeholder="Screenshot / chart URL (https://…)" />
              <div style={{ position: 'relative' }}>
                <input
                  list="example-types"
                  value={addForm.example_type ?? ''}
                  onChange={e => setAddForm(f => ({ ...f, example_type: e.target.value }))}
                  style={fs} placeholder="Type (e.g. Setup)"
                />
                <datalist id="example-types">
                  {EXAMPLE_TYPES.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.65rem', alignItems: 'flex-start' }}>
              <textarea value={addForm.notes ?? ''} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...fs, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Notes — what makes this a good example? What do you observe?" />
              <button onClick={handleAdd} disabled={adding || (!addForm.url?.trim() && !addForm.notes?.trim())} style={{ padding: '0.55rem 1rem', background: adding || (!addForm.url?.trim() && !addForm.notes?.trim()) ? 'rgba(0,200,255,0.1)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)', color: adding || (!addForm.url?.trim() && !addForm.notes?.trim()) ? 'rgba(0,200,255,0.35)' : '#0A0A0F', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: adding ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}>
                {adding ? <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={13} />}
                Add
              </button>
            </div>
          </div>

          {/* Examples */}
          <div style={{ padding: '1.25rem 1.75rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,246,252,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '1rem' }}>
              Examples {!loading && `· ${examples.length}`}
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 size={20} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} /></div>
            ) : examples.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(240,246,252,0.2)', fontSize: '0.83rem' }}>No examples yet. Add your first one above.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                {examples.map(ex => (
                  <div key={ex.id} style={{ background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Screenshot thumbnail */}
                    {ex.url && isImageUrl(ex.url) && (
                      <div onClick={() => setLightbox(ex)} style={{ cursor: 'zoom-in', position: 'relative', overflow: 'hidden', height: 130, background: '#060608' }}>
                        <img src={ex.url} alt="example" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                      </div>
                    )}
                    <div style={{ padding: '0.8rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        {ex.example_type ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 20, background: `${typeColor(ex.example_type)}18`, color: typeColor(ex.example_type), border: `1px solid ${typeColor(ex.example_type)}30`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {ex.example_type}
                          </span>
                        ) : <span />}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          {ex.url && !isImageUrl(ex.url) && (
                            <a href={ex.url} target="_blank" rel="noopener noreferrer" title="Open chart" style={{ color: ACCENT, display: 'flex', padding: '0.2rem' }}><ExternalLink size={13} /></a>
                          )}
                          {ex.url && isImageUrl(ex.url) && (
                            <a href={ex.url} target="_blank" rel="noopener noreferrer" title="Open in new tab" style={{ color: 'rgba(240,246,252,0.3)', display: 'flex', padding: '0.2rem' }}><ExternalLink size={12} /></a>
                          )}
                          <button onClick={() => handleDelete(ex.id)} title="Remove example" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.2)', display: 'flex', padding: '0.2rem', transition: 'color 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.2)')}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {ex.notes && <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.55 }}>{ex.notes}</p>}
                      {ex.url && !isImageUrl(ex.url) && (
                        <a href={ex.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <ExternalLink size={10} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.url}</span>
                        </a>
                      )}
                      <div style={{ marginTop: 'auto', paddingTop: '0.35rem', fontSize: '0.68rem', color: 'rgba(240,246,252,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {format(new Date(ex.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', cursor: 'zoom-out' }}
          onClick={() => setLightbox(null)}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
            {lightbox.example_type && <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 20, background: `${typeColor(lightbox.example_type)}20`, color: typeColor(lightbox.example_type), border: `1px solid ${typeColor(lightbox.example_type)}40` }}>{lightbox.example_type}</span>}
            <button onClick={() => setLightbox(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'rgba(240,246,252,0.6)', padding: '0.4rem', display: 'flex' }}><X size={18} /></button>
          </div>
          <img src={lightbox.url!} alt="example" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          {lightbox.notes && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(10,10,20,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.6rem 1rem', maxWidth: 500, fontSize: '0.82rem', color: 'rgba(240,246,252,0.75)', backdropFilter: 'blur(4px)', textAlign: 'center' }}>
              {lightbox.notes}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConceptJournalPage() {
  const [entries, setEntries]         = useState<ConceptEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [page, setPage]               = useState(1);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<PendingBulkAction | null>(null);
  const [editing, setEditing]         = useState<ConceptEntry | null>(null);
  const [detailConcept, setDetailConcept] = useState<ConceptEntry | null>(null);
  const [showImporter, setShowImporter]   = useState(false);
  const [form, setForm] = useState<ConceptEntryInsert>({ concept: '', explanation: '', example_url: null, notes: '', submitted_by: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await fetchConceptEntries()); }
    catch (err: any) { toast.error(err?.message ?? 'Failed to load entries.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPages  = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected  = pageEntries.length > 0 && pageEntries.every(e => selected.has(e.id));
  const somePageSelected = pageEntries.some(e => selected.has(e.id)) && !allPageSelected;

  const toggleSelect    = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (allPageSelected) { setSelected(s => { const n = new Set(s); pageEntries.forEach(e => n.delete(e.id)); return n; }); }
    else { setSelected(s => { const n = new Set(s); pageEntries.forEach(e => n.add(e.id)); return n; }); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.concept.trim() || !form.explanation.trim()) { toast.error('Concept and explanation are required.'); return; }
    setSubmitting(true);
    try {
      const entry = await insertConceptEntry({ concept: form.concept.trim(), explanation: form.explanation.trim(), example_url: null, notes: form.notes?.trim() || null, submitted_by: form.submitted_by?.trim() || null });
      setEntries(prev => [entry, ...prev]);
      setForm({ concept: '', explanation: '', example_url: null, notes: '', submitted_by: '' });
      setPage(1);
      toast.success('Concept added.');
    } catch (err: any) { toast.error(err?.message ?? 'Failed to add concept.'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConceptEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
      toast.success('Concept deleted.');
    } catch (err: any) { toast.error(err?.message ?? 'Delete failed.'); }
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    setBulkWorking(true);
    try {
      await bulkDeleteConceptEntries(ids);
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      setSelected(new Set());
      setPendingBulk(null);
      toast.success(`${ids.length} concept${ids.length !== 1 ? 's' : ''} deleted.`);
    } catch (err: any) { toast.error(err?.message ?? 'Bulk delete failed.'); }
    finally { setBulkWorking(false); }
  };

  const handleSaveEdit = async (updates: Partial<ConceptEntryInsert>) => {
    if (!editing) return;
    const updated = await updateConceptEntry(editing.id, updates);
    setEntries(prev => prev.map(e => e.id === editing.id ? updated : e));
    setEditing(null);
    toast.success('Concept updated.');
  };

  const fs: React.CSSProperties = { width: '100%', padding: '0.55rem 0.75rem', background: '#0D0D14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
  const ls: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 600, color: 'rgba(240,246,252,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', display: 'block' };

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={20} style={{ color: ACCENT }} /> Concept Journal
          </h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'rgba(240,246,252,0.35)' }}>Document trading concepts — click any row to add and view examples</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={() => setShowImporter(true)} style={ghostBtn}><FileUp size={13} /> Import CSV</button>
          <button onClick={load} style={ghostBtn}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '0.9rem' }}>
          <div><label style={ls}>Concept *</label><input value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))} style={fs} placeholder="e.g. Liquidity Sweep" /></div>
          <div><label style={ls}>Submitted by</label><input value={form.submitted_by ?? ''} onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))} style={fs} placeholder="Username" /></div>
        </div>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={ls}>Explanation *</label>
          <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))} rows={3} style={{ ...fs, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Describe the concept in detail…" />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={ls}>Notes</label>
          <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...fs, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Additional context…" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={submitting || !form.concept.trim() || !form.explanation.trim()} style={{ padding: '0.6rem 1.4rem', background: submitting || !form.concept.trim() || !form.explanation.trim() ? 'rgba(0,200,255,0.1)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)', color: submitting || !form.concept.trim() || !form.explanation.trim() ? 'rgba(0,200,255,0.4)' : '#0A0A0F', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem', transition: 'all 0.15s' }}>
            {submitting && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
            Add Concept
          </button>
        </div>
      </form>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.15)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.82rem', color: ACCENT, fontWeight: 500 }}>{selected.size} selected</span>
          <button onClick={() => setPendingBulk({ kind: 'delete' })} style={bulkBtn('#ef4444')}><Trash2 size={13} /> Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(240,246,252,0.35)', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={22} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,246,252,0.25)', fontSize: '0.85rem' }}>No concepts yet. Add your first one above.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th style={{ ...thStyle, width: 40, padding: '0.6rem 0.5rem 0.6rem 1rem' }}>
                    <CustomCheckbox checked={allPageSelected} indeterminate={somePageSelected} onChange={toggleSelectAll} />
                  </th>
                  {['Concept', 'Explanation', 'Notes', 'By', 'Date', 'Examples', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageEntries.map(entry => {
                  const isSelected = selected.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isSelected ? 'rgba(0,200,255,0.04)' : 'transparent', transition: 'background 0.12s', cursor: 'default' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(0,200,255,0.04)' : 'transparent'; }}
                    >
                      <td style={{ ...tdStyle, width: 40, padding: '0.6rem 0.5rem 0.6rem 1rem' }} onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={isSelected} onChange={() => toggleSelect(entry.id)} />
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#f0f6fc', fontSize: '0.85rem', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.concept}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'rgba(240,246,252,0.55)', maxWidth: 280 }}>
                        <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.explanation}</div>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'rgba(240,246,252,0.4)', maxWidth: 180 }}>
                        {entry.notes
                          ? <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{entry.notes}</div>
                          : <span style={{ color: 'rgba(240,246,252,0.2)' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'rgba(240,246,252,0.4)', whiteSpace: 'nowrap' }}>
                        {entry.submitted_by || <span style={{ color: 'rgba(240,246,252,0.2)' }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '0.72rem', color: 'rgba(240,246,252,0.25)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                        {format(new Date(entry.created_at), 'MMM d, yyyy')}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => setDetailConcept(entry)} title="View & add examples" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', background: 'rgba(0,200,255,0.07)', border: '1px solid rgba(0,200,255,0.18)', borderRadius: 7, color: ACCENT, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,255,0.14)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,200,255,0.07)')}>
                          <Images size={12} /> Examples
                        </button>
                      </td>
                      <td style={{ ...tdStyle, width: 72 }}>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <IconBtn onClick={() => setEditing(entry)} title="Edit"><Pencil size={13} /></IconBtn>
                          <IconBtn onClick={() => handleDelete(entry.id)} title="Delete" danger><Trash2 size={13} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {entries.length > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.3)' }}>{entries.length} total · page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page === 1)}><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(page === totalPages)}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {pendingBulk && <BulkConfirmModal count={selected.size} onConfirm={handleBulkDelete} onCancel={() => setPendingBulk(null)} working={bulkWorking} />}
      {editing && <EditModal entry={editing} onSave={handleSaveEdit} onClose={() => setEditing(null)} />}
      {detailConcept && <ConceptDetailModal concept={detailConcept} onClose={() => setDetailConcept(null)} />}
      {showImporter && <ConceptsImporter onClose={() => setShowImporter(false)} onImported={imported => { setEntries(prev => [...imported, ...prev]); setPage(1); }} />}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function IconBtn({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)') : 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: hov ? (danger ? '#f87171' : '#f0f6fc') : 'rgba(240,246,252,0.3)', padding: '0.3rem', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}>
      {children}
    </button>
  );
}

const ghostBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: 'transparent', color: 'rgba(240,246,252,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.78rem', cursor: 'pointer' };
const thStyle:  React.CSSProperties = { padding: '0.6rem 0.9rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'rgba(240,246,252,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const tdStyle:  React.CSSProperties = { padding: '0.65rem 0.9rem', verticalAlign: 'middle' };
const bulkBtn = (color: string): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.8rem', background: `${color}12`, color, border: `1px solid ${color}30`, borderRadius: 7, fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer' });
const pageBtn = (disabled: boolean): React.CSSProperties => ({ background: disabled ? 'transparent' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? 'rgba(240,246,252,0.15)' : 'rgba(240,246,252,0.5)', padding: '0.3rem 0.4rem', display: 'flex', alignItems: 'center' });
