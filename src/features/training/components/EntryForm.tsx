import { useState } from 'react';
import { Link as LinkIcon, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { insertTrainingEntry } from '../lib/trainingData';
import type { TradingSession } from '../types';

const VALID_GREEN = '#10b981';
const INVALID_RED = '#ef4444';

const SESSIONS: { value: TradingSession; label: string; time: string; color: string }[] = [
  { value: 'london',   label: 'London',   time: '08:00–17:00 UTC', color: '#3b82f6' },
  { value: 'new_york', label: 'New York', time: '13:00–22:00 UTC', color: '#8b5cf6' },
  { value: 'asia',     label: 'Asia',     time: '00:00–09:00 UTC', color: '#f59e0b' },
];

export default function EntryForm() {
  const { user } = useAuth();
  const [tvUrl, setTvUrl]           = useState('');
  const [isValid, setIsValid]       = useState<boolean | null>(null);
  const [session, setSession]       = useState<TradingSession | null>(null);
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return <Navigate to="/login" replace state={{ from: '/training/new' }} />;

  const handleReset = () => {
    setTvUrl(''); setIsValid(null); setSession(null); setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tvUrl.trim()) { toast.error('Provide a TradingView URL.'); return; }
    if (isValid === null) { toast.error('Mark the setup as Valid or Invalid.'); return; }

    setSubmitting(true);
    try {
      await insertTrainingEntry({
        tradingview_url: tvUrl.trim(),
        is_valid_setup:  isValid,
        session:         session,
        submitted_by:    user.email ?? user.id,
        notes:           notes.trim() || null,
      });
      toast.success('Entry saved to training dataset.');
      handleReset();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>
          New Training Entry
        </h1>
        <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
          Label chart setups to build the AI training dataset.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 640 }}>

          {/* TradingView URL */}
          <Card label="TradingView URL" hint="Required">
            <div style={{ position: 'relative' }}>
              <LinkIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
              <input
                type="url"
                value={tvUrl}
                onChange={e => setTvUrl(e.target.value)}
                placeholder="https://www.tradingview.com/x/..."
                style={{ ...inputStyle, paddingLeft: '2.25rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82rem' }}
              />
            </div>
          </Card>

          {/* Session */}
          <Card label="Session" hint="Optional">
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              {SESSIONS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSession(session === s.value ? null : s.value)}
                  style={{
                    flex: 1, minWidth: 130, padding: '0.75rem 1rem',
                    background: session === s.value ? `${s.color}18` : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${session === s.value ? s.color : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.2rem',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: session === s.value ? s.color : 'rgba(240,246,252,0.55)' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(240,246,252,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.time}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Valid / Invalid */}
          <Card label="Setup Classification" hint="Required">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <SetupButton active={isValid === true}  color={VALID_GREEN} icon={<CheckCircle2 size={16} />} label="Valid Setup"   sublabel="High-quality, actionable signal"      onClick={() => setIsValid(true)} />
              <SetupButton active={isValid === false} color={INVALID_RED} icon={<XCircle size={16} />}      label="Invalid Setup" sublabel="Noise, ambiguous, or low-quality"    onClick={() => setIsValid(false)} />
            </div>
          </Card>

          {/* Notes */}
          <Card label="Analyst Notes" hint="Optional">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Describe the setup, confluences, and your reasoning..."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 110, lineHeight: 1.6 }}
            />
          </Card>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <button
              type="submit" disabled={submitting}
              style={{
                padding: '0.65rem 1.75rem',
                background: submitting ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)',
                color: submitting ? 'rgba(0,212,255,0.5)' : '#0A0A0F',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.15s', letterSpacing: '0.01em',
              }}
            >
              {submitting && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              type="button" onClick={handleReset} disabled={submitting}
              style={{ padding: '0.65rem 1.25rem', background: 'transparent', color: 'rgba(240,246,252,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.15s' }}
            >
              Reset
            </button>
          </div>
        </div>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Card({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(240,246,252,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        {hint && <span style={{ fontSize: '0.7rem', color: 'rgba(240,246,252,0.25)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SetupButton({ active, color, icon, label, sublabel, onClick }: {
  active: boolean; color: string; icon: React.ReactNode; label: string; sublabel: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      flex: 1, minWidth: 160, padding: '1rem 1.25rem',
      background: active ? `${color}14` : 'rgba(255,255,255,0.02)',
      border: `1.5px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 10, cursor: 'pointer',
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      transition: 'all 0.15s', textAlign: 'left',
    }}>
      <div style={{ color: active ? color : 'rgba(240,246,252,0.25)', marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: active ? color : 'rgba(240,246,252,0.55)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.3)', lineHeight: 1.3 }}>{sublabel}</div>
      </div>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
  padding: '0.65rem 0.9rem', color: '#f0f6fc', fontSize: '0.85rem',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};
