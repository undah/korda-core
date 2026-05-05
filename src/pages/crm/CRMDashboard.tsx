import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useLeads } from '@/features/crm/hooks/useLeads';
import { useCRMProfiles } from '@/features/crm/hooks/useCRMProfiles';
import { DAILY_GOAL, LEAD_STATUSES, STATUS_STYLE, getRepColor } from '@/features/crm/constants';
import type { CRMOutletContext, Lead, LeadStatus } from '@/features/crm/types';
import { TrendingUp, Phone, Trophy, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

const WORK_START = 9;   // 9:00
const WORK_END   = 18;  // 18:00
const INACTIVITY_WARN_MINS = 45;

const todayStr    = format(new Date(), 'yyyy-MM-dd');
const weekStart   = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const weekEnd     = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

// ── helpers ──────────────────────────────────────────────────────────────────

function getPace(count: number): {
  label: string; color: string; bg: string; border: string; icon: 'up' | 'ok' | 'down' | 'done' | 'idle';
} {
  const now   = new Date();
  const hour  = now.getHours() + now.getMinutes() / 60;

  if (count >= DAILY_GOAL)
    return { label: 'Doel gehaald!', color: '#4ade80', bg: 'rgba(21,128,61,0.15)', border: 'rgba(21,128,61,0.3)', icon: 'done' };
  if (hour < WORK_START)
    return { label: 'Dag nog niet begonnen', color: 'rgba(240,246,252,0.45)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', icon: 'idle' };
  if (hour > WORK_END)
    return { label: 'Dag voorbij', color: 'rgba(240,246,252,0.45)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', icon: 'idle' };

  const elapsed  = (hour - WORK_START) / (WORK_END - WORK_START);
  const expected = Math.ceil(elapsed * DAILY_GOAL);
  const diff     = count - expected;

  if (diff >= 2)  return { label: `${diff} voor schema`, color: '#4ade80', bg: 'rgba(21,128,61,0.15)', border: 'rgba(21,128,61,0.3)', icon: 'up' };
  if (diff >= -2) return { label: 'Op schema',           color: '#FCD34D', bg: 'rgba(180,83,9,0.15)',  border: 'rgba(180,83,9,0.3)', icon: 'ok' };
  return               { label: `${Math.abs(diff)} achter`, color: '#f87171', bg: 'rgba(220,38,38,0.12)', border: 'rgba(220,38,38,0.25)', icon: 'down' };
}

function getLastCall(calls: Lead[]): { time: string | null; minsAgo: number | null } {
  if (!calls.length) return { time: null, minsAgo: null };

  const sorted = [...calls].sort((a, b) => b.tijdstip.localeCompare(a.tijdstip));
  const lastTime = sorted[0].tijdstip; // "HH:MM:SS"
  const [h, m]   = lastTime.split(':').map(Number);
  const now       = new Date();
  const minsAgo   = (now.getHours() - h) * 60 + (now.getMinutes() - m);

  return { time: lastTime.slice(0, 5), minsAgo: Math.max(0, minsAgo) };
}

function isInactive(minsAgo: number | null): boolean {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  return minsAgo !== null && minsAgo >= INACTIVITY_WARN_MINS && hour >= WORK_START && hour <= WORK_END;
}

function fmtMins(mins: number): string {
  if (mins < 60) return `${mins} min geleden`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}u ${m}m geleden` : `${h}u geleden`;
}

// ── sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 9999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.5s ease' }} />
    </div>
  );
}

function PaceIcon({ icon }: { icon: 'up' | 'ok' | 'down' | 'done' | 'idle' }) {
  if (icon === 'done') return <CheckCircle2 size={11} />;
  if (icon === 'up')   return <span style={{ fontSize: 11 }}>↑</span>;
  if (icon === 'down') return <AlertCircle size={11} />;
  return <span style={{ fontSize: 11 }}>→</span>;
}

// ── main ─────────────────────────────────────────────────────────────────────

export default function CRMDashboard() {
  const { } = useOutletContext<CRMOutletContext>();

  // auto-refresh every 60 s so teammates see real-time updates
  const { data: weekLeads = [], isLoading: leadsLoading } = useLeads(
    { dateFrom: weekStart, dateTo: weekEnd },
    60_000,
  );
  const { data: profiles = [], isLoading: profilesLoading } = useCRMProfiles();

  const todayLeads = useMemo(() => weekLeads.filter(l => l.datum === todayStr), [weekLeads]);

  const repStats = useMemo(() => {
    return profiles.map(p => {
      const todayCalls = todayLeads.filter(l => l.rep_id === p.id);
      const weekCalls  = weekLeads.filter(l => l.rep_id === p.id);
      const statusCounts = LEAD_STATUSES.reduce((acc, s) => ({
        ...acc,
        [s]: todayCalls.filter(l => l.status === s).length,
      }), {} as Record<LeadStatus, number>);

      const pace          = getPace(todayCalls.length);
      const lastCall      = getLastCall(todayCalls);
      const inactive      = isInactive(lastCall.minsAgo);

      return {
        profile: p,
        todayCount: todayCalls.length,
        weekCount:  weekCalls.length,
        statusCounts,
        color:     getRepColor(p.rep_name),
        pace,
        lastCall,
        inactive,
      };
    }).sort((a, b) => b.todayCount - a.todayCount);
  }, [profiles, todayLeads, weekLeads]);

  const overallStatusCounts = useMemo(() => LEAD_STATUSES.reduce((acc, s) => ({
    ...acc,
    [s]: todayLeads.filter(l => l.status === s).length,
  }), {} as Record<LeadStatus, number>), [todayLeads]);

  const onTrackCount  = repStats.filter(r => r.pace.icon === 'up' || r.pace.icon === 'ok' || r.pace.icon === 'done').length;
  const behindCount   = repStats.filter(r => r.pace.icon === 'down').length;
  const inactiveReps  = repStats.filter(r => r.inactive);

  if (leadsLoading || profilesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'rgba(240,246,252,0.35)', fontSize: '0.875rem' }}>Laden…</div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.35)', marginBottom: '0.3rem' }}>
          {format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })}
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,246,252,0.45)', marginTop: '0.25rem' }}>
          {todayLeads.length} gesprekken vandaag · doel: {profiles.length * DAILY_GOAL}
        </p>
      </div>

      {/* ── Accountability status bar ── */}
      {repStats.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center',
          marginBottom: '1.75rem',
          padding: '0.85rem 1.1rem',
          background: inactiveReps.length > 0 ? 'rgba(220,38,38,0.12)' : behindCount > 0 ? 'rgba(180,83,9,0.15)' : 'rgba(21,128,61,0.15)',
          border: `1px solid ${inactiveReps.length > 0 ? 'rgba(220,38,38,0.3)' : behindCount > 0 ? 'rgba(180,83,9,0.3)' : 'rgba(21,128,61,0.3)'}`,
          borderRadius: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: inactiveReps.length > 0 ? '#DC2626' : behindCount > 0 ? '#B45309' : '#15803D',
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: inactiveReps.length > 0 ? '#DC2626' : behindCount > 0 ? '#B45309' : '#15803D' }}>
              Teamstatus
            </span>
          </div>

          {inactiveReps.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <AlertCircle size={12} />
              {inactiveReps.map(r => r.profile.rep_name).join(', ')} {inactiveReps.length === 1 ? 'is' : 'zijn'} al {INACTIVITY_WARN_MINS}+ min inactief
            </span>
          )}

          {behindCount > 0 && !inactiveReps.length && (
            <span style={{ fontSize: '0.78rem', color: '#B45309' }}>
              {repStats.filter(r => r.pace.icon === 'down').map(r => r.profile.rep_name).join(', ')} {behindCount === 1 ? 'loopt' : 'lopen'} achter schema
            </span>
          )}

          {behindCount === 0 && !inactiveReps.length && (
            <span style={{ fontSize: '0.78rem', color: '#15803D' }}>
              Iedereen op of voor schema — goed bezig! 💪
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600 }}>{onTrackCount} op schema</span>
            {behindCount > 0 && <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>{behindCount} achter</span>}
          </div>
        </div>
      )}

      {/* ── Daily progress cards ── */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Phone size={15} style={{ color: 'rgba(240,246,252,0.45)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)' }}>
            Dagelijks Doel
          </span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(240,246,252,0.35)', marginLeft: 'auto' }}>
            Vernieuwt elke 60 sec
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {repStats.map(({ profile, todayCount, statusCounts, color, pace, lastCall, inactive }) => (
            <div
              key={profile.id}
              style={{
                background: '#0D0D14',
                border: `1px solid ${inactive ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                padding: '1.25rem',
                borderTop: `3px solid ${inactive ? '#DC2626' : color}`,
                position: 'relative',
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: inactive ? '#DC2626' : color }} />
                    <span style={{ fontWeight: 700, color: '#f0f6fc', fontSize: '0.95rem' }}>{profile.rep_name}</span>
                    {inactive && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600,
                        padding: '0.1rem 0.4rem', borderRadius: 9999,
                        background: 'rgba(220,38,38,0.12)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)',
                      }}>
                        INACTIEF
                      </span>
                    )}
                  </div>

                  {/* Last call time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
                    <Clock size={11} style={{ color: inactive ? '#FCA5A5' : '#B0A99A', flexShrink: 0 }} />
                    {lastCall.time ? (
                      <span style={{ fontSize: '0.72rem', color: inactive ? '#EF4444' : '#9CA3AF' }}>
                        Laatste call {lastCall.time}
                        {lastCall.minsAgo !== null && ` · ${fmtMins(lastCall.minsAgo)}`}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.25)' }}>Nog geen call vandaag</span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: inactive ? '#DC2626' : color, lineHeight: 1 }}>
                    {todayCount}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(240,246,252,0.35)' }}>/{DAILY_GOAL}</span>
                </div>
              </div>

              {/* Progress bar */}
              <ProgressBar value={todayCount} max={DAILY_GOAL} color={inactive ? '#FCA5A5' : color} />

              {/* Pace badge */}
              <div style={{ marginTop: '0.6rem' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  fontSize: '0.7rem', fontWeight: 600,
                  padding: '0.2rem 0.55rem', borderRadius: 9999,
                  background: pace.bg, color: pace.color, border: `1px solid ${pace.border}`,
                }}>
                  <PaceIcon icon={pace.icon} />
                  {pace.label}
                </span>
              </div>

              {/* Status breakdown */}
              <div style={{ marginTop: '0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {LEAD_STATUSES.filter(s => statusCounts[s] > 0).map(s => (
                  <span
                    key={s}
                    style={{
                      fontSize: '0.66rem', fontWeight: 600,
                      padding: '0.12rem 0.4rem', borderRadius: 9999,
                      background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].color,
                      border: `1px solid ${STATUS_STYLE[s].border}`,
                    }}
                  >
                    {statusCounts[s]}× {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Leaderboard + Week totals ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Trophy size={15} style={{ color: 'rgba(240,246,252,0.45)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)' }}>
              Ranglijst vandaag
            </span>
          </div>
          {repStats.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'rgba(240,246,252,0.35)' }}>Geen data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {repStats.map(({ profile, todayCount, color, pace }, idx) => (
                <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: idx === 0 ? 'rgba(180,83,9,0.2)' : idx === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(154,52,18,0.15)',
                    color: idx === 0 ? '#FCD34D' : idx === 1 ? 'rgba(240,246,252,0.5)' : '#fb923c',
                    fontSize: '0.72rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f6fc' }}>{profile.rep_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600,
                          padding: '0.1rem 0.4rem', borderRadius: 9999,
                          background: pace.bg, color: pace.color, border: `1px solid ${pace.border}`,
                        }}>
                          {pace.label}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{todayCount}</span>
                      </div>
                    </div>
                    <ProgressBar value={todayCount} max={DAILY_GOAL} color={color} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={15} style={{ color: 'rgba(240,246,252,0.45)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)' }}>
              Week totaal
            </span>
          </div>
          {repStats.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'rgba(240,246,252,0.35)' }}>Geen data</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {[...repStats].sort((a, b) => b.weekCount - a.weekCount).map(({ profile, weekCount, color }) => {
                const weekGoal = DAILY_GOAL * 5;
                const pct = Math.round((weekCount / weekGoal) * 100);
                return (
                  <div key={profile.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0f6fc' }}>{profile.rep_name}</span>
                        <span style={{ fontSize: '0.82rem', color: 'rgba(240,246,252,0.45)' }}>
                          <span style={{ fontWeight: 700, color }}>{weekCount}</span>
                          <span style={{ color: 'rgba(240,246,252,0.35)' }}>/{weekGoal}</span>
                          <span style={{ color: 'rgba(240,246,252,0.25)', marginLeft: '0.35rem', fontSize: '0.72rem' }}>{pct}%</span>
                        </span>
                      </div>
                      <ProgressBar value={weekCount} max={weekGoal} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Status breakdown ── */}
      <section>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)', marginBottom: '1rem' }}>
          Status verdeling vandaag
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
          {LEAD_STATUSES.map(s => {
            const count = overallStatusCounts[s];
            const st    = STATUS_STYLE[s];
            return (
              <div key={s} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: 8, padding: '0.85rem 1rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: st.color, lineHeight: 1, marginBottom: '0.25rem' }}>{count}</div>
                <div style={{ fontSize: '0.75rem', color: st.color, fontWeight: 500, opacity: 0.85 }}>{s}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

