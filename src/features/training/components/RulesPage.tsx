import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Link as LinkIcon, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fetchRules, insertRule, updateRule, deleteRule, bulkDeleteRules } from '../lib/trainingData';
import type { StrategyRule, StrategyRuleInsert, RuleCategory } from '../types';

const ACCENT     = '#00C8FF';
const DELETE_RED = '#ef4444';
const PAGE_SIZE  = 15;

const CATEGORIES: { value: RuleCategory; label: string; color: string }[] = [
  { value: 'entry',      label: 'Entry',           color: '#10b981' },
  { value: 'exit',       label: 'Exit',            color: '#f59e0b' },
  { value: 'risk',       label: 'Risk Management', color: '#ef4444' },
  { value: 'psychology', label: 'Psychology',      color: '#8b5cf6' },
  { value: 'setup',      label: 'Setup',           color: '#00C8FF' },
  { value: 'other',      label: 'Other',           color: 'rgba(240,246,252,0.4)' },
];

function categoryMeta(cat: RuleCategory) {
  return CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[5];
}

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
        <svg width={9} height={7} viewBox={'0 0 9 7'} fill={'none'}>
          <path d={'M1 3.5L3.2 5.8L8 1'} stroke={ACCENT} strokeWidth={1.6} strokeLinecap={'round'} strokeLinejoin={'round'} />
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
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel, working]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (!working && e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: '#131920', border: `1px solid ${DELETE_RED}40`, borderRadius: 14, width: '100%', maxWidth: 400, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f0f6fc', marginBottom: '0.4rem' }}>Delete {count} rule{count !== 1 ? 's' : ''}?</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(240,246,252,0.45)' }}>This action cannot be undone.</div>
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

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ rule, onSave, onClose }: { rule: StrategyRule; onSave: (id: string, patch: Partial<StrategyRuleInsert>) => Promise<void>; onClose: () => void }) {
  const [title, setTitle]       = useState(rule.title);
  const [category, setCategory] = useState<RuleCategory>(rule.category);
  const [description, setDesc]  = useState(rule.description);
  const [exampleUrl, setUrl]    = useState(rule.example_url ?? '');
  const [active, setActive]     = useState(rule.active);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saving, onClose]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required.'); return; }
    if (!description.trim()) { toast.error('Description is required.'); return; }
    setSaving(true);
    try {
      await onSave(rule.id, { title: title.trim(), category, description: description.trim(), example_url: exampleUrl.trim() || null, active });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (!saving && e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, width: '100%', maxWidth: 560, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f0f6fc' }}>Edit Rule</span>
          {!saving && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', display: 'flex', padding: 4 }}><X size={18} /></button>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={labelStyle}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={labelStyle}>Category</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                style={{ padding: '0.3rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                  background: category === c.value ? `${c.color}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${category === c.value ? c.color : 'rgba(255,255,255,0.08)'}`,
                  color: category === c.value ? c.color : 'rgba(240,246,252,0.4)' }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={labelStyle}>Description</label>
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={labelStyle}>Example URL <span style={{ color: 'rgba(240,246,252,0.25)' }}>(optional)</span></label>
          <input value={exampleUrl} onChange={e => setUrl(e.target.value)} placeholder="https://www.tradingview.com/x/..." style={inputStyle} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div onClick={() => setActive(v => !v)}
            style={{ width: 36, height: 20, borderRadius: 10, background: active ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
          </div>
          <span style={{ fontSize: '0.82rem', color: 'rgba(240,246,252,0.6)' }}>Rule is {active ? 'active' : 'inactive'}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '0.55rem 1.1rem', background: 'transparent', color: 'rgba(240,246,252,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.82rem', cursor: saving ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.55rem 1.25rem', background: saving ? `${ACCENT}20` : `${ACCENT}18`, color: saving ? `${ACCENT}60` : ACCENT, border: `1px solid ${ACCENT}35`, borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {saving && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const [rules, setRules]               = useState<StrategyRule[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterCat, setFilterCat]       = useState<RuleCategory | 'all'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [page, setPage]                 = useState(0);
  const [editingRule, setEditingRule]   = useState<StrategyRule | null>(null);
  const [pendingBulk, setPendingBulk]   = useState(false);
  const [bulkWorking, setBulkWorking]   = useState(false);

  // Add form
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState<RuleCategory>('entry');
  const [description, setDesc]  = useState('');
  const [exampleUrl, setUrl]    = useState('');
  const [active, setActive]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setRules(await fetchRules());
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load rules.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rules.filter(r => {
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (filterActive === 'active' && !r.active) return false;
    if (filterActive === 'inactive' && r.active) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allOnPageSelected = pageSlice.length > 0 && pageSlice.every(r => selected.has(r.id));
  const someSelected      = selected.size > 0;

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected(prev => { const n = new Set(prev); pageSlice.forEach(r => n.delete(r.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pageSlice.forEach(r => n.add(r.id)); return n; });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required.'); return; }
    if (!description.trim()) { toast.error('Description is required.'); return; }
    setSubmitting(true);
    try {
      const rule = await insertRule({ title: title.trim(), category, description: description.trim(), example_url: exampleUrl.trim() || null, active });
      setRules(prev => [rule, ...prev]);
      setTitle(''); setDesc(''); setUrl(''); setCategory('entry'); setActive(true);
      toast.success('Rule saved.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save rule.');
    } finally { setSubmitting(false); }
  };

  const handleSaveEdit = async (id: string, patch: Partial<StrategyRuleInsert>) => {
    const updated = await updateRule(id, patch);
    setRules(prev => prev.map(r => r.id === id ? updated : r));
    toast.success('Rule updated.');
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Rule deleted.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete.');
    }
  };

  const handleBulkDelete = async () => {
    setBulkWorking(true);
    try {
      await bulkDeleteRules([...selected]);
      setRules(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setPendingBulk(false);
      toast.success('Rules deleted.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Bulk delete failed.');
    } finally { setBulkWorking(false); }
  };

  const handleToggleActive = async (rule: StrategyRule) => {
    try {
      const updated = await updateRule(rule.id, { active: !rule.active });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update.');
    }
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {editingRule && (
        <EditModal rule={editingRule} onSave={handleSaveEdit} onClose={() => setEditingRule(null)} />
      )}
      {pendingBulk && (
        <BulkConfirmModal count={selected.size} onConfirm={handleBulkDelete} onCancel={() => setPendingBulk(false)} working={bulkWorking} />
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>Strategy Rules</h1>
        <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
          Define and manage the rules that govern your trading strategy.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit}>
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(240,246,252,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '1rem' }}>Add Rule</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={labelStyle}>Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Only trade above 20 EMA" style={inputStyle} />
              </div>
              <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={labelStyle}>Category</label>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {CATEGORIES.map(c => (
                    <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                      style={{ padding: '0.35rem 0.7rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
                        background: category === c.value ? `${c.color}20` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${category === c.value ? c.color : 'rgba(255,255,255,0.08)'}`,
                        color: category === c.value ? c.color : 'rgba(240,246,252,0.4)' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={labelStyle}>Description</label>
              <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Explain the rule in detail — when it applies, why it matters, what to look for..." style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={labelStyle}>Example URL <span style={{ color: 'rgba(240,246,252,0.25)', fontWeight: 400 }}>(optional)</span></label>
                <div style={{ position: 'relative' }}>
                  <LinkIcon size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
                  <input value={exampleUrl} onChange={e => setUrl(e.target.value)} placeholder="https://www.tradingview.com/x/..." style={{ ...inputStyle, paddingLeft: '2rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem' }} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', paddingBottom: '0.1rem' }}>
                <div onClick={() => setActive(v => !v)}
                  style={{ width: 36, height: 20, borderRadius: 10, background: active ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                </div>
                <span style={{ fontSize: '0.78rem', color: 'rgba(240,246,252,0.5)' }}>Active</span>
              </div>

              <button type="submit" disabled={submitting}
                style={{ padding: '0.6rem 1.5rem', background: submitting ? 'rgba(0,212,255,0.1)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)', color: submitting ? 'rgba(0,212,255,0.4)' : '#0A0A0F', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                {submitting && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {submitting ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Filters + bulk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.35)' }}>Filter:</span>
        {(['all', ...CATEGORIES.map(c => c.value)] as const).map(v => (
          <button key={v} type="button" onClick={() => { setFilterCat(v as any); setPage(0); }}
            style={{ padding: '0.25rem 0.7rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
              background: filterCat === v ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filterCat === v ? ACCENT : 'rgba(255,255,255,0.08)'}`,
              color: filterCat === v ? ACCENT : 'rgba(240,246,252,0.4)' }}>
            {v === 'all' ? 'All' : CATEGORIES.find(c => c.value === v)?.label}
          </button>
        ))}
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 0.25rem' }} />
        {(['all', 'active', 'inactive'] as const).map(v => (
          <button key={v} type="button" onClick={() => { setFilterActive(v); setPage(0); }}
            style={{ padding: '0.25rem 0.7rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
              background: filterActive === v ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filterActive === v ? ACCENT : 'rgba(255,255,255,0.08)'}`,
              color: filterActive === v ? ACCENT : 'rgba(240,246,252,0.4)' }}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}

        {someSelected && (
          <button onClick={() => setPendingBulk(true)}
            style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem', background: `${DELETE_RED}12`, border: `1px solid ${DELETE_RED}30`, borderRadius: 6, color: DELETE_RED, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trash2 size={11} /> Delete {selected.size}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'rgba(240,246,252,0.3)', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(240,246,252,0.25)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
          No rules yet. Add your first strategy rule above.
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th style={thStyle}>
                  <CustomCheckbox checked={allOnPageSelected} indeterminate={!allOnPageSelected && pageSlice.some(r => selected.has(r.id))} onChange={toggleAll} />
                </th>
                {['Title', 'Category', 'Description', 'Status', 'Added', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((rule, i) => {
                const meta = categoryMeta(rule.category);
                return (
                  <tr key={rule.id} style={{ borderBottom: i < pageSlice.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: selected.has(rule.id) ? `${ACCENT}06` : 'transparent' }}>
                    <td style={tdStyle}>
                      <CustomCheckbox checked={selected.has(rule.id)} onChange={() => toggleSelect(rule.id)} />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#f0f6fc', maxWidth: 200 }}>
                      {rule.title}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30`, whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.55)', maxWidth: 340 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {rule.description}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div onClick={() => handleToggleActive(rule)}
                        style={{ width: 32, height: 18, borderRadius: 9, background: rule.active ? ACCENT : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: 2, left: rule.active ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.35)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>
                      {format(new Date(rule.created_at), 'MMM d, yyyy')}
                    </td>
                    <td style={{ ...tdStyle }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {rule.example_url && (
                          <a href={rule.example_url} target="_blank" rel="noreferrer"
                            style={{ display: 'flex', padding: 5, color: 'rgba(240,246,252,0.3)', borderRadius: 5, transition: 'color 0.12s' }}
                            title="View example">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button onClick={() => setEditingRule(rule)} style={iconBtn} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} style={{ ...iconBtn, color: `${DELETE_RED}80` }} title="Delete">
                          <Trash2 size={13} />
                        </button>
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
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.85rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.3)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={pageBtn(page === 0)}><ChevronLeft size={14} /></button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={pageBtn(page >= totalPages - 1)}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)', fontWeight: 500 };

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, padding: '0.6rem 0.85rem', color: '#f0f6fc', fontSize: '0.83rem',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.85rem', textAlign: 'left', fontWeight: 600,
  color: 'rgba(240,246,252,0.35)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = { padding: '0.7rem 0.85rem', verticalAlign: 'middle' };

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.3)',
  display: 'flex', padding: 5, borderRadius: 5, transition: 'color 0.12s',
};

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? 'rgba(240,246,252,0.2)' : 'rgba(240,246,252,0.6)',
  display: 'flex', alignItems: 'center',
});
