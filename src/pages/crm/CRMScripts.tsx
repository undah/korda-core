import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, X, BookOpen } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useScripts, useInsertScript, useUpdateScript, useDeleteScript } from '@/features/crm/hooks/useScripts';
import { useCRMProfiles } from '@/features/crm/hooks/useCRMProfiles';
import type { CRMOutletContext, Script } from '@/features/crm/types';
import { getRepColor } from '@/features/crm/constants';
import { toast } from 'sonner';

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(240,246,252,0.45)',
  marginBottom: '0.35rem',
};

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.85rem',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  fontSize: '0.875rem',
  color: '#f0f6fc',
  background: '#0D0D14',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

function ScriptForm({
  initial,
  repColor,
  onSave,
  onCancel,
  isPending,
}: {
  initial: { title: string; content: string };
  repColor: string;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={LABEL}>Naam script *</label>
        <input
          required
          style={INPUT}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="bijv. Koude acquisitie v2"
          onFocus={e => (e.target.style.borderColor = repColor)}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
          autoFocus
        />
      </div>
      <div>
        <label style={LABEL}>Script tekst *</label>
        <textarea
          required
          style={{ ...INPUT, minHeight: 200, resize: 'vertical' }}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Schrijf hier de volledige scripttekst..."
          onFocus={e => (e.target.style.borderColor = repColor)}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => onSave(title.trim(), content.trim())}
          disabled={isPending || !title.trim() || !content.trim()}
          style={{
            flex: 1,
            padding: '0.7rem',
            background: (!title.trim() || !content.trim()) ? 'rgba(255,255,255,0.08)' : repColor,
            color: (!title.trim() || !content.trim()) ? 'rgba(240,246,252,0.3)' : '#0A0A0F',
            border: 'none', borderRadius: 7,
            fontWeight: 700, fontSize: '0.875rem',
            cursor: (!title.trim() || !content.trim()) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
            transition: 'all 0.15s',
          }}
        >
          {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Opslaan
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.7rem 1.1rem',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(240,246,252,0.4)',
            border: 'none', borderRadius: 7,
            fontSize: '0.875rem', cursor: 'pointer',
          }}
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

function ScriptCard({
  script,
  repName,
  canEdit,
  onEdit,
  onDelete,
  isDeleting,
}: {
  script: Script;
  repName: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preview = script.content.length > 120
    ? script.content.slice(0, 120) + '…'
    : script.content;

  return (
    <div style={{
      background: '#0D0D14',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: '1.25rem 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <BookOpen size={14} style={{ color: '#3B82F6', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f0f6fc' }}>{script.title}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'rgba(240,246,252,0.45)', marginBottom: '0.5rem' }}>
            Door {repName} · {new Date(script.created_at).toLocaleDateString('nl-NL')}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(240,246,252,0.45)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {expanded ? script.content : preview}
          </div>
          {script.content.length > 120 && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                marginTop: '0.4rem',
                fontSize: '0.78rem', color: '#3B82F6',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 0,
              }}
            >
              {expanded ? 'Minder weergeven' : 'Meer weergeven'}
            </button>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button
              onClick={onEdit}
              style={{
                padding: '0.4rem',
                background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, cursor: 'pointer', color: 'rgba(240,246,252,0.45)',
                display: 'flex', alignItems: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C8FF'; e.currentTarget.style.color = '#00C8FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(240,246,252,0.45)'; }}
            >
              <Pencil size={13} />
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  padding: '0.4rem',
                  background: 'none', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6, cursor: 'pointer', color: 'rgba(240,246,252,0.45)',
                  display: 'flex', alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#DC2626'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(240,246,252,0.45)'; }}
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  style={{
                    padding: '0.35rem 0.65rem',
                    background: '#DC2626', color: '#fff',
                    border: 'none', borderRadius: 6,
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                  }}
                >
                  {isDeleting && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                  Zeker?
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    padding: '0.35rem 0.4rem',
                    background: 'rgba(255,255,255,0.06)', color: 'rgba(240,246,252,0.4)',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRMScripts() {
  const { profile, adminMode } = useOutletContext<CRMOutletContext>();
  const { user } = useAuth();
  const { data: scripts = [], isLoading } = useScripts();
  const { data: profiles = [] } = useCRMProfiles();
  const insertScript = useInsertScript();
  const updateScript = useUpdateScript();
  const deleteScript = useDeleteScript();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const repColor = getRepColor(profile?.rep_name ?? '');

  const canEdit = (script: Script) =>
    adminMode || script.created_by === user?.id;

  const handleCreate = async (title: string, content: string) => {
    if (!user) return;
    try {
      await insertScript.mutateAsync({ title, content, created_by: user.id });
      toast.success(`Script "${title}" aangemaakt`);
      setShowCreate(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Aanmaken mislukt');
    }
  };

  const handleUpdate = async (id: string, title: string, content: string) => {
    try {
      await updateScript.mutateAsync({ id, title, content });
      toast.success('Script bijgewerkt');
      setEditingId(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScript.mutateAsync(id);
      toast.success('Script verwijderd');
    } catch (err: any) {
      toast.error(err?.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.35)', marginBottom: '0.3rem' }}>
            Scriptbibliotheek
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', margin: 0 }}>
            Scripts
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'rgba(240,246,252,0.45)', marginTop: '0.3rem', marginBottom: 0 }}>
            Beheer je belscripts en koppel ze aan calls om bij te houden wat werkt.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.45rem',
              padding: '0.65rem 1.1rem',
              background: repColor || '#00C8FF', color: '#0A0A0F',
              border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: '0.875rem',
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} />
            Nieuw script
          </button>
        )}
      </div>

      <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {showCreate && (
          <div style={{
            background: '#0D0D14',
            border: `1.5px solid ${repColor || '#3B82F6'}`,
            borderRadius: 10,
            padding: '1.5rem',
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: repColor || '#3B82F6', marginBottom: '1rem', letterSpacing: '0.04em' }}>
              NIEUW SCRIPT
            </div>
            <ScriptForm
              initial={{ title: '', content: '' }}
              repColor={repColor || '#3B82F6'}
              onSave={handleCreate}
              onCancel={() => setShowCreate(false)}
              isPending={insertScript.isPending}
            />
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(240,246,252,0.45)', fontSize: '0.875rem', padding: '1rem 0' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Scripts laden…
          </div>
        )}

        {!isLoading && scripts.length === 0 && !showCreate && (
          <div style={{
            background: '#0D0D14', border: '1px dashed #e8e4dc', borderRadius: 10,
            padding: '3rem 2rem', textAlign: 'center',
          }}>
            <BookOpen size={32} style={{ color: 'rgba(240,246,252,0.25)', marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(240,246,252,0.45)', marginBottom: '0.35rem' }}>
              Nog geen scripts
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(240,246,252,0.35)' }}>
              Maak je eerste script aan om het bij calls te kunnen koppelen.
            </div>
          </div>
        )}

        {scripts.map(script => {
          if (editingId === script.id) {
            return (
              <div
                key={script.id}
                style={{
                  background: '#0D0D14',
                  border: `1.5px solid ${repColor || '#3B82F6'}`,
                  borderRadius: 10,
                  padding: '1.5rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: repColor || '#3B82F6', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                  SCRIPT BEWERKEN
                </div>
                <ScriptForm
                  initial={{ title: script.title, content: script.content }}
                  repColor={repColor || '#3B82F6'}
                  onSave={(title, content) => handleUpdate(script.id, title, content)}
                  onCancel={() => setEditingId(null)}
                  isPending={updateScript.isPending}
                />
              </div>
            );
          }

          const authorProfile = profiles.find(p => p.id === script.created_by);
          const authorName = authorProfile?.rep_name ?? 'Onbekend';

          return (
            <ScriptCard
              key={script.id}
              script={script}
              repName={authorName}
              canEdit={canEdit(script)}
              onEdit={() => setEditingId(script.id)}
              onDelete={() => handleDelete(script.id)}
              isDeleting={deleteScript.isPending}
            />
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

