import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useLeads } from '@/features/crm/hooks/useLeads';
import { useCRMProfiles } from '@/features/crm/hooks/useCRMProfiles';
import { DAILY_GOAL, WEEK_CELL_COLOR, getRepColor } from '@/features/crm/constants';
import type { CRMOutletContext } from '@/features/crm/types';

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

export default function CRMWeek() {
  const { } = useOutletContext<CRMOutletContext>();
  const { data: leads = [], isLoading } = useLeads({
    dateFrom: format(weekStart, 'yyyy-MM-dd'),
    dateTo: format(weekEnd, 'yyyy-MM-dd'),
  });
  const { data: profiles = [] } = useCRMProfiles();

  const grid = useMemo(() => {
    return profiles.map(p => ({
      profile: p,
      color: getRepColor(p.rep_name),
      days: weekDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const count = leads.filter(l => l.rep_id === p.id && l.datum === dayStr).length;
        return { day, count };
      }),
      total: leads.filter(l => l.rep_id === p.id).length,
    }));
  }, [profiles, leads]);

  const weekTotals = useMemo(() =>
    weekDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return leads.filter(l => l.datum === dayStr).length;
    }),
    [leads]
  );

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.35)', marginBottom: '0.3rem' }}>
          {format(weekStart, 'd MMM', { locale: nl })} – {format(weekEnd, 'd MMM yyyy', { locale: nl })}
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', margin: 0 }}>
          Weekoverzicht
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,246,252,0.45)', marginTop: '0.25rem' }}>
          Doel: {DAILY_GOAL} calls per dag per rep
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { label: `0 calls`, bg: 'rgba(255,255,255,0.03)', color: 'rgba(240,246,252,0.25)', border: 'rgba(255,255,255,0.08)' },
          { label: `1 – 14`, bg: 'rgba(220,38,38,0.12)', color: '#f87171', border: 'rgba(220,38,38,0.3)' },
          { label: `15 – 24`, bg: 'rgba(180,83,9,0.15)', color: '#FCD34D', border: 'rgba(180,83,9,0.3)' },
          { label: `25+`, bg: 'rgba(21,128,61,0.15)', color: '#4ade80', border: 'rgba(21,128,61,0.3)' },
        ].map(({ label, bg, color, border }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
            <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.45)' }}>{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(240,246,252,0.35)', fontSize: '0.875rem' }}>Laden…</div>
      ) : (
        <div style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '0.7rem 1.25rem', textAlign: 'left',
                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)',
                    background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    width: 110,
                  }}>
                    Rep
                  </th>
                  {weekDays.map(day => (
                    <th
                      key={day.toString()}
                      style={{
                        padding: '0.7rem 0.5rem', textAlign: 'center',
                        fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: isToday(day) ? '#3B82F6' : '#9CA3AF',
                        background: isToday(day) ? '#EFF6FF' : '#F8F7F4',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                        minWidth: 62,
                      }}
                    >
                      <div>{format(day, 'EEE', { locale: nl })}</div>
                      <div style={{ fontWeight: 400, opacity: 0.7, marginTop: '0.1rem' }}>
                        {format(day, 'd MMM', { locale: nl })}
                      </div>
                    </th>
                  ))}
                  <th style={{
                    padding: '0.7rem 0.75rem', textAlign: 'center',
                    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'rgba(240,246,252,0.45)',
                    background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    minWidth: 64,
                  }}>
                    Week
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.map(({ profile, color, days, total }) => (
                  <tr key={profile.id}>
                    <td style={{
                      padding: '0.7rem 1.25rem',
                      borderBottom: '1px solid #F0ECE4',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#f0f6fc' }}>
                          {profile.rep_name}
                        </span>
                      </div>
                    </td>
                    {days.map(({ day, count }) => {
                      const { bg, text } = WEEK_CELL_COLOR(count);
                      const today = isToday(day);
                      return (
                        <td
                          key={day.toString()}
                          style={{
                            padding: '0.6rem 0.5rem',
                            textAlign: 'center',
                            background: count === 0 ? (today ? '#FAFEFF' : bg) : bg,
                            borderBottom: '1px solid #F0ECE4',
                            borderLeft: '1px solid rgba(255,255,255,0.08)',
                            position: 'relative',
                          }}
                        >
                          {today && (
                            <div style={{
                              position: 'absolute', top: 0, left: 0, right: 0,
                              height: 2, background: '#3B82F6', borderRadius: 0,
                            }} />
                          )}
                          <span style={{
                            fontSize: '1rem', fontWeight: count >= DAILY_GOAL ? 700 : count > 0 ? 600 : 400,
                            color: count === 0 ? '#D1D5DB' : text,
                          }}>
                            {count}
                          </span>
                          {count >= DAILY_GOAL && (
                            <div style={{ fontSize: '0.6rem', color: '#15803D', marginTop: '0.1rem' }}>✓</div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{
                      padding: '0.6rem 0.75rem', textAlign: 'center',
                      borderBottom: '1px solid #F0ECE4',
                      borderLeft: '1px solid rgba(255,255,255,0.08)',
                      background: '#FAFAF8',
                    }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color }}>
                        {total}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(240,246,252,0.35)', marginTop: '0.1rem' }}>
                        /{DAILY_GOAL * 5}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Totals row */}
                {grid.length > 1 && (
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.7rem 1.25rem', borderTop: '2px solid #e8e4dc' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(240,246,252,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Totaal
                      </span>
                    </td>
                    {weekTotals.map((total, i) => {
                      const { bg, text } = WEEK_CELL_COLOR(total);
                      return (
                        <td
                          key={i}
                          style={{
                            padding: '0.6rem 0.5rem', textAlign: 'center',
                            background: total === 0 ? '#F8F7F4' : bg,
                            borderTop: '2px solid #e8e4dc',
                            borderLeft: '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: total === 0 ? '#D1D5DB' : text }}>
                            {total}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{
                      padding: '0.6rem 0.75rem', textAlign: 'center',
                      borderTop: '2px solid #e8e4dc', borderLeft: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.06)',
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'rgba(240,246,252,0.45)' }}>
                        {leads.length}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-rep summaries below the grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1.5rem' }}>
        {grid.map(({ profile, color, total }) => {
          const weekGoal = DAILY_GOAL * 5;
          const pct = Math.min(100, (total / weekGoal) * 100);
          return (
            <div key={profile.id} style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#f0f6fc' }}>{profile.rep_name}</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1, marginBottom: '0.5rem' }}>
                {total} <span style={{ fontSize: '0.8rem', color: 'rgba(240,246,252,0.35)', fontWeight: 400 }}>/ {weekGoal}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)', marginTop: '0.35rem' }}>
                {pct >= 100 ? '🎯 Doel bereikt!' : `${Math.round(pct)}% van weekdoel`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

