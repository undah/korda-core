import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useScripts, useInsertScript, useUpdateScript, useDeleteScript } from '@/features/crm/hooks/useScripts';
import { useLeads } from '@/features/crm/hooks/useLeads';
import { useAuth } from '@/auth/AuthProvider';
import { useMyProfile } from '@/features/crm/hooks/useCRMProfiles';
import { STATUS_STYLE, LEAD_STATUSES } from '@/features/crm/constants';
import type { CallScript, LeadStatus, CRMOutletContext } from '@/features/crm/types';
import { toast } from 'sonner';

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#9CA3AF',
  marginBottom: '0.35rem',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  border: '1px solid #e8e4dc',
  borderRadius: 6,
  fontSize: '0.875rem',
  color: '#1c1a17',
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const CONVERSION_STATUSES: LeadStatus[] = ['Geïnteresseerd', 'Gesloten'];

function ScriptForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: { title: string; content: string };
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8e4dc', borderRadius: 10,
      padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
      marginBottom: '1.5rem',
    }}>
      <div>
        <label style={LABEL}>Script titel *</label>
        <input
          style={INPUT}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="bijv. Koud gesprek v2, Follow-up script..."
          autoFocus
        />
      </div>
      <div>
        <label style={LABEL}>Script inhoud *</label>
        <textarea
          style={{ ...INPUT, minHeight: 180, resize: 'vertical', lineHeight: 1.6 }}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={"Goedemorgen, u spreekt met [naam] van Korda...\n\nOpeningszin:\n...\n\nPijnpunt identificeren:\n..."}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '0.6rem 1.25rem',
            background: '#F3F4F6', color: '#6B7280',
            border: 'none', borderRadius: 6,
            fontSize: '0.875rem', cursor: 'pointer',
          }}
        >
          Annuleren
        </button>
        <button
          onClick={() => onSave(title.trim(), content.trim())}
          disabled={isPending || !title.trim() || !content.trim()}
          style={{
            padding: '0.6rem 1.25rem',
            background: !title.trim() || !content.trim() ? '#E5E7EB' : '#3B82F6',
            color: !title.trim() || !content.trim() ? '#9CA3AF' : '#fff',
            border: 'none', borderRadius: 6,
            fontSize: '0.875rem', fontWeight: 600,
            cursor: !title.trim() || !content.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {initial ? 'Opslaan' : 'Script aanmaken'}
        </button>
      </div>
    </div>
  );
}

function ScriptStats({ scriptId }: { scriptId: string }) {
  const { data: leads = [] } = useLeads();
  const scriptLeads = leads.filter(l => l.script_id === scriptId);

  if (scriptLeads.length === 0) {
    return (
      <p style={{ fontSize: '0.8rem', color: '#B0A99A', marginTop: '1rem' }}>
        Nog geen calls gelogd met dit script.
      </p>
    );
  }

  const total = scriptLeads.length;
  const converted = scriptLeads.filter(l => CONVERSION_STATUSES.includes(l.status)).length;
  const convRate = Math.round((converted / total) * 100);
  const totalDeal = scriptLeads.reduce((sum, l) => sum + (l.deal_waarde ?? 0), 0);

  const bySatus = LEAD_STATUSES.map(s => ({
    status: s,
    count: scriptLeads.filter(l => l.status === s).length,
  })).filter(x => x.count > 0);

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #f0ece4' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B0A99A', marginBottom: '0.75rem' }}>
        Prestaties
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1c1a17' }}>{total}</div>
          <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Calls gelogd</div>
        </div>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: convRate >= 20 ? '#15803D' : convRate >= 10 ? '#B45309' : '#DC2626' }}>
            {convRate}%
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Conversie</div>
        </div>
        {totalDeal > 0 && (
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803D' }}>
              €{totalDeal.toLocaleString('nl-NL')}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Deal waarde</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {bySatus.map(({ status, count }) => {
          const ss = STATUS_STYLE[status as LeadStatus];
          return (
            <span
              key={status}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: 9999,
                fontSize: '0.75rem',
                fontWeight: 500,
                background: ss.bg,
                color: ss.color,
                border: `1px solid ${ss.border}`,
              }}
            >
              {status}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface ScriptCardProps {
  script: CallScript;
  canEdit: boolean;
}

function ScriptCard({ script, canEdit }: ScriptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateScript = useUpdateScript();
  const deleteScript = useDeleteScript();

  const handleUpdate = async (title: string, content: string) => {
    try {
      await updateScript.mutateAsync({ id: script.id, title, content });
      toast.success('Script bijgewerkt');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteScript.mutateAsync(script.id);
      toast.success('Script verwijderd');
    } catch (err: any) {
      toast.error(err?.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e4dc',
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'box-shadow 0.15s',
    }}>
      <div
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
        }}
        onClick={() => !editing && setExpanded(v => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1c1a17', marginBottom: '0.15rem' }}>
            {script.title}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#B0A99A' }}>
            {new Date(script.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setEditing(true); setExpanded(true); }}
              style={{
                padding: '0.35rem 0.65rem',
                background: '#F3F4F6', border: 'none',
                borderRadius: 6, cursor: 'pointer',
                color: '#6B7280', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              <Edit2 size={12} /> Bewerken
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: '0.35rem 0.65rem',
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 6, cursor: 'pointer',
                  color: '#DC2626',
                }}
              >
                <Trash2 size={12} />
              </button>
            ) : (
              <>
                <button
                  onClick={handleDelete}
                  disabled={deleteScript.isPending}
                  style={{
                    padding: '0.35rem 0.65rem',
                    background: '#DC2626', border: 'none',
                    borderRadius: 6, cursor: 'pointer',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  {deleteScript.isPending ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
                  Zeker?
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: '0.35rem 0.5rem',
                    background: '#F3F4F6', border: 'none',
                    borderRadius: 6, cursor: 'pointer', color: '#6B7280',
                  }}
                >
                  <X size={12} />
                </button>
              </>
            )}
          </div>
        )}
        {!editing && (
          <div style={{ color: '#9CA3AF', flexShrink: 0 }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #f0ece4' }}>
          {editing ? (
            <div style={{ marginTop: '1rem' }}>
              <ScriptForm
                initial={{ title: script.title, content: script.content }}
                onSave={handleUpdate}
                onCancel={() => setEditing(false)}
                isPending={updateScript.isPending}
              />
            </div>
          ) : (
            <>
              <pre style={{
                marginTop: '1rem',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                fontSize: '0.845rem',
                color: '#1c1a17',
                lineHeight: 1.7,
                background: '#F8F7F4',
                padding: '1rem',
                borderRadius: 6,
                border: '1px solid #f0ece4',
              }}>
                {script.content}
              </pre>
              <ScriptStats scriptId={script.id} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CRMScripts() {
  const { adminMode } = useOutletContext<CRMOutletContext>();
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: scripts = [], isLoading } = useScripts();
  const insertScript = useInsertScript();
  const [creating, setCreating] = useState(false);

  const canEdit = adminMode || !!profile?.is_admin;

  const handleCreate = async (title: string, content: string) => {
    if (!user) return;
    try {
      await insertScript.mutateAsync({ title, content, created_by: user.id });
      toast.success('Script aangemaakt');
      setCreating(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Aanmaken mislukt');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B0A99A', marginBottom: '0.3rem' }}>
            Belscripts
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1c1a17', letterSpacing: '-0.02em', margin: 0 }}>
            Call Scripts
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '0.3rem', margin: '0.3rem 0 0' }}>
            Maak scripts aan, gebruik ze bij calls, en zie welk script het beste werkt.
          </p>
        </div>
        {canEdit && !creating && (
          <button
            onClick={() => setCreating(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.65rem 1.1rem',
              background: '#3B82F6', color: '#fff',
              border: 'none', borderRadius: 8,
              fontWeight: 600, fontSize: '0.875rem',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Plus size={15} /> Nieuw Script
          </button>
        )}
      </div>

      {creating && (
        <ScriptForm
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          isPending={insertScript.isPending}
        />
      )}

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={20} style={{ color: '#3B82F6', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : scripts.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: '#fff', border: '1px solid #e8e4dc',
          borderRadius: 10, color: '#9CA3AF',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
          <div style={{ fontWeight: 600, color: '#1c1a17', marginBottom: '0.35rem' }}>Nog geen scripts</div>
          <div style={{ fontSize: '0.85rem' }}>
            {canEdit ? 'Klik "Nieuw Script" om een belscript aan te maken.' : 'Vraag een admin om een script aan te maken.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {scripts.map(script => (
            <ScriptCard key={script.id} script={script} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
