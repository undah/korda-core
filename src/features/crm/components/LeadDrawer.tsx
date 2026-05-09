import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2, Loader2 } from 'lucide-react';
import { DarkSelect } from '@/components/ui/DarkSelect';
import { useUpdateLead, useDeleteLead } from '../hooks/useLeads';
import { useScripts } from '../hooks/useScripts';
import { StatusBadge } from './StatusBadge';
import { LEAD_STATUSES, STATUS_STYLE, getRepColor } from '../constants';
import type { Lead, LeadStatus, CRMProfile } from '../types';
import { toast } from 'sonner';

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  profiles: CRMProfile[];
  canEdit: boolean;
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  fontSize: '0.875rem',
  color: '#f0f6fc',
  background: '#131920',
  outline: 'none',
  fontFamily: 'inherit',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#9CA3AF',
  marginBottom: '0.3rem',
};

export function LeadDrawer({ lead, open, onClose, profiles, canEdit }: LeadDrawerProps) {
  const update = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { data: scripts = [] } = useScripts();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    lead_naam: '',
    tel_nummer: '',
    datum: '',
    tijdstip: '',
    status: 'Niet bereikt' as LeadStatus,
    resultaat: '',
    deal_waarde: '',
    follow_up_datum: '',
    website_type: '',
    script_id: '',
  });

  useEffect(() => {
    if (lead) {
      setForm({
        lead_naam: lead.lead_naam,
        tel_nummer: lead.tel_nummer,
        datum: lead.datum,
        tijdstip: lead.tijdstip,
        status: lead.status,
        resultaat: lead.resultaat,
        deal_waarde: lead.deal_waarde != null ? String(lead.deal_waarde) : '',
        follow_up_datum: lead.follow_up_datum ?? '',
        website_type: lead.website_type,
        script_id: lead.script_id ?? '',
      });
    }
    setEditing(false);
    setConfirmDelete(false);
  }, [lead]);

  if (!lead) return null;

  const repProfile = profiles.find(p => p.id === lead.rep_id);
  const repName = repProfile?.rep_name ?? 'Onbekend';
  const repColor = getRepColor(repName);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: lead.id,
        lead_naam: form.lead_naam,
        tel_nummer: form.tel_nummer,
        datum: form.datum,
        tijdstip: form.tijdstip,
        status: form.status,
        resultaat: form.resultaat,
        deal_waarde: form.deal_waarde ? Number(form.deal_waarde) : null,
        follow_up_datum: form.follow_up_datum || null,
        website_type: form.website_type,
        script_id: form.script_id || null,
      });
      toast.success('Lead bijgewerkt');
      setEditing(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLead.mutateAsync(lead.id);
      toast.success('Lead verwijderd');
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Verwijderen mislukt');
    }
  };

  const inputStyle = (disabled: boolean): React.CSSProperties => ({
    ...FIELD_STYLE,
    background: disabled ? 'rgba(255,255,255,0.04)' : '#131920',
    color: disabled ? 'rgba(240,246,252,0.3)' : '#f0f6fc',
    cursor: disabled ? 'default' : 'text',
  });

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#FAFAF8',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          padding: 0,
          overflow: 'auto',
        }}
      >
        <SheetHeader style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#131920' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: repColor }} />
            <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 500 }}>{repName}</span>
            <StatusBadge status={lead.status} size="sm" />
          </div>
          <SheetTitle style={{ color: '#f0f6fc', fontSize: '1.1rem' }}>{lead.lead_naam}</SheetTitle>
          <div style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>{lead.tel_nummer}</div>
        </SheetHeader>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={LABEL_STYLE}>Lead naam</label>
              <input
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.lead_naam}
                onChange={e => set('lead_naam', e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Telefoonnummer</label>
              <input
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.tel_nummer}
                onChange={e => set('tel_nummer', e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Datum</label>
              <input
                type="date"
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.datum}
                onChange={e => set('datum', e.target.value)}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Tijdstip</label>
              <input
                type="time"
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.tijdstip}
                onChange={e => set('tijdstip', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={LABEL_STYLE}>Status</label>
            {editing ? (
              <DarkSelect
                options={LEAD_STATUSES.map(s => ({ value: s, label: s, color: STATUS_STYLE[s]?.color }))}
                value={form.status}
                onChange={v => set('status', v as LeadStatus)}
                fontSize="0.875rem"
                padding="0.5rem 0.75rem"
                background="#131920"
              />
            ) : (
              <div style={{ marginTop: '0.2rem' }}>
                <StatusBadge status={form.status} />
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={LABEL_STYLE}>Resultaat / Notitie</label>
            <textarea
              style={{ ...inputStyle(!editing), minHeight: 80, resize: 'vertical' }}
              disabled={!editing}
              value={form.resultaat}
              onChange={e => set('resultaat', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={LABEL_STYLE}>Deal waarde (€)</label>
              <input
                type="number"
                step="0.01"
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.deal_waarde}
                onChange={e => set('deal_waarde', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Follow-up datum</label>
              <input
                type="date"
                style={inputStyle(!editing)}
                disabled={!editing}
                value={form.follow_up_datum}
                onChange={e => set('follow_up_datum', e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={LABEL_STYLE}>Website type</label>
            <input
              style={inputStyle(!editing)}
              disabled={!editing}
              value={form.website_type}
              onChange={e => set('website_type', e.target.value)}
              placeholder="bijv. webshop, portfolio, landing page..."
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={LABEL_STYLE}>Script gebruikt</label>
            {editing ? (
              <DarkSelect
                options={[
                  { value: '', label: '— Geen script —' },
                  ...scripts.map(s => ({ value: s.id, label: s.title })),
                ]}
                value={form.script_id ?? ''}
                onChange={v => set('script_id', v)}
                fontSize="0.875rem"
                padding="0.5rem 0.75rem"
                background="#131920"
              />
            ) : (
              <div style={{
                ...FIELD_STYLE,
                background: 'rgba(255,255,255,0.04)',
                color: form.script_id ? '#f0f6fc' : 'rgba(240,246,252,0.35)',
                cursor: 'default',
              }}>
                {form.script_id
                  ? (scripts.find(s => s.id === form.script_id)?.title ?? '—')
                  : 'Geen script'}
              </div>
            )}
          </div>

          {canEdit && (
            <div style={{ borderTop: '1px solid #f0ece4', paddingTop: '1.25rem' }}>
              {!editing ? (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      flex: 1, padding: '0.65rem',
                      background: '#00C8FF', color: '#0A0A0F',
                      border: 'none', borderRadius: 6,
                      fontWeight: 600, fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Bewerken
                  </button>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      style={{
                        padding: '0.65rem 0.9rem',
                        background: 'none', border: '1px solid #FECACA',
                        borderRadius: 6, color: '#DC2626',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={handleDelete}
                        disabled={deleteLead.isPending}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: '#DC2626', color: '#fff',
                          border: 'none', borderRadius: 6,
                          fontSize: '0.8rem', fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}
                      >
                        {deleteLead.isPending && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Zeker?
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: '#F3F4F6', color: '#6B7280',
                          border: 'none', borderRadius: 6,
                          fontSize: '0.8rem', cursor: 'pointer',
                        }}
                      >
                        Nee
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={handleSave}
                    disabled={update.isPending}
                    style={{
                      flex: 1, padding: '0.65rem',
                      background: '#15803D', color: '#fff',
                      border: 'none', borderRadius: 6,
                      fontWeight: 600, fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    }}
                  >
                    {update.isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    Opslaan
                  </button>
                  <button
                    onClick={() => { setEditing(false); }}
                    style={{
                      padding: '0.65rem 1rem',
                      background: '#F3F4F6', color: '#6B7280',
                      border: 'none', borderRadius: 6,
                      fontSize: '0.85rem', cursor: 'pointer',
                    }}
                  >
                    Annuleren
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: '#B0A99A' }}>
            Aangemaakt: {new Date(lead.created_at).toLocaleString('nl-NL')}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

