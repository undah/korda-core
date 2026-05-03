import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2, CheckCircle2, FileText } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useMyProfile } from '@/features/crm/hooks/useCRMProfiles';
import { useInsertLead } from '@/features/crm/hooks/useLeads';
import { useScripts } from '@/features/crm/hooks/useScripts';
import { LEAD_STATUSES, STATUS_STYLE, getRepColor } from '@/features/crm/constants';
import { StatusDot } from '@/features/crm/components/StatusBadge';
import type { CRMOutletContext, LeadStatus } from '@/features/crm/types';
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
  transition: 'border-color 0.15s',
};

const EMPTY = {
  lead_naam: '',
  tel_nummer: '',
  datum: format(new Date(), 'yyyy-MM-dd'),
  tijdstip: format(new Date(), 'HH:mm'),
  status: 'Niet bereikt' as LeadStatus,
  resultaat: '',
  deal_waarde: '',
  follow_up_datum: '',
  website_type: '',
  script_id: '',
};

export default function CRMLog() {
  const { } = useOutletContext<CRMOutletContext>();
  const { user } = useAuth();
  const { data: profile } = useMyProfile();
  const insert = useInsertLead();
  const { data: scripts = [] } = useScripts();

  const [form, setForm] = useState({ ...EMPTY });
  const [success, setSuccess] = useState(false);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    try {
      await insert.mutateAsync({
        rep_id: user.id,
        lead_naam: form.lead_naam.trim(),
        tel_nummer: form.tel_nummer.trim(),
        datum: form.datum,
        tijdstip: form.tijdstip,
        status: form.status,
        resultaat: form.resultaat.trim(),
        deal_waarde: form.deal_waarde ? Number(form.deal_waarde) : null,
        follow_up_datum: form.follow_up_datum || null,
        website_type: form.website_type.trim(),
        script_id: form.script_id || null,
      });
      toast.success(`Call gelogd voor ${form.lead_naam}`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      setForm({ ...EMPTY, datum: form.datum, tijdstip: format(new Date(), 'HH:mm') });
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    }
  };

  const repName = profile?.rep_name ?? '';
  const repColor = getRepColor(repName);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B0A99A', marginBottom: '0.3rem' }}>
          Nieuw gesprek
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1c1a17', letterSpacing: '-0.02em', margin: 0 }}>
          Log een Call
        </h1>
        {repName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: repColor }} />
            <span style={{ fontSize: '0.8rem', color: '#9CA3AF' }}>Gelogd als {repName}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        <div style={{
          background: '#fff', border: '1px solid #e8e4dc', borderRadius: 10,
          padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
        }}>
          {/* Row 1: naam + telefoon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={LABEL}>Lead naam *</label>
              <input
                required
                style={INPUT}
                value={form.lead_naam}
                onChange={e => set('lead_naam', e.target.value)}
                placeholder="Bedrijfsnaam of contactpersoon"
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
            <div>
              <label style={LABEL}>Telefoonnummer *</label>
              <input
                required
                type="tel"
                style={INPUT}
                value={form.tel_nummer}
                onChange={e => set('tel_nummer', e.target.value)}
                placeholder="+31 6 12345678"
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
          </div>

          {/* Row 2: datum + tijdstip */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={LABEL}>Datum *</label>
              <input
                required
                type="date"
                style={INPUT}
                value={form.datum}
                onChange={e => set('datum', e.target.value)}
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
            <div>
              <label style={LABEL}>Tijdstip *</label>
              <input
                required
                type="time"
                style={INPUT}
                value={form.tijdstip}
                onChange={e => set('tijdstip', e.target.value)}
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={LABEL}>Status *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {LEAD_STATUSES.map(s => {
                const active = form.status === s;
                const ss = STATUS_STYLE[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.4rem 0.85rem',
                      borderRadius: 9999,
                      border: `1.5px solid ${active ? ss.color : '#e8e4dc'}`,
                      background: active ? ss.bg : '#fff',
                      color: active ? ss.color : '#706d66',
                      fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <StatusDot status={s} />
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Script */}
          {scripts.length > 0 && (
            <div>
              <label style={LABEL}>Script gebruikt</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => set('script_id', '')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: 9999,
                    border: `1.5px solid ${!form.script_id ? '#3B82F6' : '#e8e4dc'}`,
                    background: !form.script_id ? '#EFF6FF' : '#fff',
                    color: !form.script_id ? '#3B82F6' : '#706d66',
                    fontSize: '0.8rem', fontWeight: !form.script_id ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Geen script
                </button>
                {scripts.map(s => {
                  const active = form.script_id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => set('script_id', s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: 9999,
                        border: `1.5px solid ${active ? repColor : '#e8e4dc'}`,
                        background: active ? `${repColor}12` : '#fff',
                        color: active ? repColor : '#706d66',
                        fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <FileText size={12} />
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resultaat */}
          <div>
            <label style={LABEL}>Resultaat / Notitie</label>
            <textarea
              style={{ ...INPUT, minHeight: 80, resize: 'vertical' }}
              value={form.resultaat}
              onChange={e => set('resultaat', e.target.value)}
              placeholder="Aantekeningen over het gesprek..."
              onFocus={e => (e.target.style.borderColor = repColor)}
              onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
            />
          </div>

          {/* Row: deal + follow-up + website */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={LABEL}>Deal waarde (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                style={INPUT}
                value={form.deal_waarde}
                onChange={e => set('deal_waarde', e.target.value)}
                placeholder="0.00"
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
            <div>
              <label style={LABEL}>Follow-up datum</label>
              <input
                type="date"
                style={INPUT}
                value={form.follow_up_datum}
                onChange={e => set('follow_up_datum', e.target.value)}
                onFocus={e => (e.target.style.borderColor = repColor)}
                onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
              />
            </div>
          </div>

          <div>
            <label style={LABEL}>Website type</label>
            <input
              style={INPUT}
              value={form.website_type}
              onChange={e => set('website_type', e.target.value)}
              placeholder="bijv. webshop, portfolio, landing page, visitekaartje..."
              onFocus={e => (e.target.style.borderColor = repColor)}
              onBlur={e => (e.target.style.borderColor = '#e8e4dc')}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={insert.isPending || !profile}
            style={{
              marginTop: '0.25rem',
              padding: '0.8rem',
              background: success ? '#15803D' : repColor || '#3B82F6',
              color: '#fff',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.9rem',
              cursor: insert.isPending || !profile ? 'not-allowed' : 'pointer',
              opacity: insert.isPending || !profile ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
            }}
          >
            {insert.isPending ? (
              <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan…</>
            ) : success ? (
              <><CheckCircle2 size={16} /> Opgeslagen!</>
            ) : (
              'Call Opslaan'
            )}
          </button>

          {!profile && (
            <p style={{ fontSize: '0.8rem', color: '#B45309', textAlign: 'center' }}>
              Stel eerst je naam in via het dashboard.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
