﻿import { useState, useEffect, useCallback } from 'react';
import { Play, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { ScreenshotConfig, ScreenshotLog, SessionFilter, LogStatus } from '../screenshotTypes';
import {
  fetchScreenshotConfig,
  saveScreenshotConfig,
  fetchScreenshotLogs,
  checkServiceHealth,
  fetchScheduleStatus,
  triggerRunNow,
} from '../lib/screenshotData';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const INTERVALS = [5, 10, 15, 30, 60];
const SESSIONS: { value: SessionFilter; label: string; time: string }[] = [
  { value: 'always',   label: 'Always',   time: 'No filter' },
  { value: 'london',   label: 'London',   time: '08:00—12:00 UTC' },
  { value: 'new_york', label: 'New York', time: '13:00—17:00 UTC' },
];
const PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'US30',   'NAS100',
];

export default function ScreenshotScheduler() {
  const [config, setConfig]             = useState<ScreenshotConfig | null>(null);
  const [draft, setDraft]               = useState<Partial<ScreenshotConfig>>({});
  const [logs, setLogs]                 = useState<ScreenshotLog[]>([]);
  const [serviceOnline, setOnline]      = useState<boolean | null>(null);
  const [nextRun, setNextRun]           = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [running, setRunning]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [hoveredLog, setHoveredLog]     = useState<string | null>(null);
  const [refreshing, setRefreshing]     = useState(false);

  const merged: Partial<ScreenshotConfig> = { ...config, ...draft };
  const enabled     = !!merged.enabled;
  const mode        = merged.schedule_mode ?? 'interval';
  const intervalMin = merged.interval_minutes ?? 15;
  const fixedTime   = merged.fixed_time ?? '09:00';
  const days        = merged.days ?? [];
  const sessions    = merged.sessions ?? ['always'];
  const pairs       = merged.pairs ?? ['EURUSD'];

  const load = useCallback(async () => {
    try {
      const [cfg, logData] = await Promise.all([fetchScreenshotConfig(), fetchScreenshotLogs()]);
      setConfig(cfg);
      setLogs(logData);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load config.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const check = async () => {
      setOnline(await checkServiceHealth());
      fetchScheduleStatus().then(s => setNextRun(s.next_run)).catch(() => {});
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  const persist = async (patch: Partial<ScreenshotConfig>) => {
    setSaving(true);
    try {
      const id = config?.id;
      const saved = await saveScreenshotConfig({ ...(id ? { id } : {}), ...merged, ...patch });
      setConfig(saved);
      setDraft({});
      return saved;
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (val: boolean) => {
    try {
      await persist({ enabled: val });
      toast.success(val ? 'Scheduler enabled.' : 'Scheduler disabled.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update.');
    }
  };

  const handleSave = async () => {
    try {
      await persist({});
      toast.success('Settings saved.');
      fetchScheduleStatus().then(s => setNextRun(s.next_run)).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save.');
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await triggerRunNow();
      toast.success('Screenshot triggered.');
      setTimeout(() => fetchScreenshotLogs().then(setLogs), 3000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to trigger.');
    } finally {
      setRunning(false);
    }
  };

  const toggleDay = (day: string) =>
    setDraft(d => ({ ...d, days: days.includes(day) ? days.filter(x => x !== day) : [...days, day] }));

  const toggleSession = (s: SessionFilter) =>
    setDraft(d => ({ ...d, sessions: sessions.includes(s) ? sessions.filter(x => x !== s) : [...sessions, s] }));

  const togglePair = (p: string) =>
    setDraft(d => ({ ...d, pairs: pairs.includes(p) ? pairs.filter(x => x !== p) : [...pairs, p] }));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div style={{ width: 24, height: 24, border: '2px solid #00C8FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>Screenshot Scheduler</h1>
          <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>Automate TradingView chart captures for the AI dataset.</p>
        </div>
        <ServiceStatus online={serviceOnline} nextRun={nextRun} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 680 }}>

        {/* Enable toggle */}
        <Card label="Scheduler" hint={enabled ? 'Active' : 'Paused'} hintColor={enabled ? '#10b981' : 'rgba(240,246,252,0.25)'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'rgba(240,246,252,0.55)', lineHeight: 1.4 }}>
              {enabled
                ? 'Scheduler is running. Screenshots are being collected automatically.'
                : 'Scheduler is paused. No screenshots will be taken.'}
            </span>
            <Toggle enabled={enabled} onChange={handleToggle} disabled={saving} />
          </div>
        </Card>

        {/* Schedule mode */}
        <Card label="Schedule Mode" hint="When to capture">
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {(['interval', 'fixed'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setDraft(d => ({ ...d, schedule_mode: m }))}
                style={{
                  flex: 1, padding: '0.75rem 1rem', borderRadius: 10, cursor: 'pointer',
                  background: mode === m ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${mode === m ? '#00C8FF' : 'rgba(255,255,255,0.08)'}`,
                  color: mode === m ? '#00C8FF' : 'rgba(240,246,252,0.45)',
                  fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
                }}
              >
                {m === 'interval' ? 'Interval' : 'Fixed Time'}
              </button>
            ))}
          </div>

          {mode === 'interval' && (
            <div>
              <FieldLabel>Interval</FieldLabel>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {INTERVALS.map(min => (
                  <button key={min} type="button"
                    onClick={() => setDraft(d => ({ ...d, interval_minutes: min }))}
                    style={{
                      padding: '0.45rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      background: intervalMin === min ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${intervalMin === min ? '#00C8FF' : 'rgba(255,255,255,0.08)'}`,
                      color: intervalMin === min ? '#00C8FF' : 'rgba(240,246,252,0.45)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'fixed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <FieldLabel>Time (UTC)</FieldLabel>
                <input
                  type="time"
                  value={fixedTime}
                  onChange={e => setDraft(d => ({ ...d, fixed_time: e.target.value }))}
                  style={{ ...inputStyle, width: 140 }}
                />
              </div>
              <div>
                <FieldLabel>Days</FieldLabel>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {DAYS.map(day => {
                    const active = days.includes(day);
                    return (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        style={{
                          width: 42, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                          background: active ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? '#00C8FF' : 'rgba(255,255,255,0.08)'}`,
                          color: active ? '#00C8FF' : 'rgba(240,246,252,0.4)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Session filter */}
        <Card label="Session Filter" hint="Active windows">
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {SESSIONS.map(s => {
              const active = sessions.includes(s.value);
              return (
                <button key={s.value} type="button" onClick={() => toggleSession(s.value)}
                  style={{
                    flex: 1, minWidth: 120, padding: '0.75rem 1rem', borderRadius: 10, cursor: 'pointer',
                    background: active ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: active ? '#00C8FF' : 'rgba(240,246,252,0.5)' }}>{s.label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(240,246,252,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>{s.time}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Pairs */}
        <Card label="Pairs" hint={`${pairs.length} selected`}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {PAIRS.map(p => {
              const active = pairs.includes(p);
              return (
                <button key={p} type="button" onClick={() => togglePair(p)}
                  style={{
                    padding: '0.4rem 0.85rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                    background: active ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${active ? '#00C8FF' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#00C8FF' : 'rgba(240,246,252,0.4)',
                    transition: 'all 0.15s',
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '0.65rem 1.75rem',
              background: saving ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)',
              color: saving ? 'rgba(0,212,255,0.5)' : '#0A0A0F',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.15s',
            }}
          >
            {saving
              ? <><RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</>
              : <><Save size={14} /> Save Settings</>}
          </button>
          <button onClick={handleRunNow} disabled={running}
            style={{
              padding: '0.65rem 1.25rem',
              background: 'rgba(255,255,255,0.04)',
              color: running ? 'rgba(240,246,252,0.3)' : 'rgba(240,246,252,0.75)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              fontWeight: 600, fontSize: '0.875rem',
              cursor: running ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.15s',
            }}
          >
            {running
              ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Play size={14} />}
            Run Now
          </button>
        </div>
      </div>

      {/* Run log */}
      <div style={{ marginTop: '2.5rem', maxWidth: 860 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f6fc', margin: 0, letterSpacing: '-0.02em' }}>Run Log</h2>
          <button
            onClick={async () => {
              setRefreshing(true);
              try { await fetchScreenshotLogs().then(setLogs); } finally { setRefreshing(false); }
            }}
            disabled={refreshing}
            style={{ background: 'none', border: 'none', cursor: refreshing ? 'default' : 'pointer', color: refreshing ? 'rgba(0,212,255,0.7)' : 'rgba(240,246,252,0.35)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', padding: 0, transition: 'color 0.15s' }}
          >
            <RefreshCw size={12} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(240,246,252,0.25)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
            No runs yet. Use Run Now or enable the scheduler.
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Status', 'Time', 'Reason', 'Screenshot'].map(h => (
                    <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontWeight: 600, color: 'rgba(240,246,252,0.35)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '0.65rem 1rem' }}><StatusBadge status={log.status} /></td>
                    <td style={{ padding: '0.65rem 1rem', color: 'rgba(240,246,252,0.55)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.77rem', whiteSpace: 'nowrap' }}>
                      {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: 'rgba(240,246,252,0.45)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.reason ?? '—'}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', position: 'relative' }}>
                      {log.image_base64 ? (
                        <div
                          onMouseEnter={() => setHoveredLog(log.id)}
                          onMouseLeave={() => setHoveredLog(null)}
                          style={{ position: 'relative', display: 'inline-block' }}
                        >
                          <img
                            src={`data:image/png;base64,${log.image_base64}`}
                            alt="thumb"
                            style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'block' }}
                          />
                          {hoveredLog === log.id && (
                            <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 6, boxShadow: '0 16px 64px rgba(0,0,0,0.8)', pointerEvents: 'none' }}>
                              <img src={`data:image/png;base64,${log.image_base64}`} alt="preview" style={{ width: 720, height: 450, objectFit: 'contain', borderRadius: 8, display: 'block' }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'rgba(240,246,252,0.2)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceStatus({ online, nextRun }: { online: boolean | null; nextRun: string | null }) {
  const color = online === null ? 'rgba(240,246,252,0.25)' : online ? '#10b981' : '#f87171';
  const label = online === null ? 'Checking...' : online ? 'Online' : 'Offline';
  const nextLabel = nextRun
    ? `Next: ${new Date(nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC`
    : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.85rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, fontSize: '0.78rem', color: 'rgba(240,246,252,0.6)', whiteSpace: 'nowrap' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: online ? `0 0 6px ${color}` : 'none' }} />
        Railway {label}
      </div>
      {nextLabel && (
        <span style={{ fontSize: '0.68rem', color: 'rgba(240,246,252,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>{nextLabel}</span>
      )}
    </div>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: enabled ? '#00C8FF' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: enabled ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

function StatusBadge({ status }: { status: LogStatus }) {
  const map: Record<LogStatus, { label: string; color: string; bg: string }> = {
    success: { label: 'Success', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    error:   { label: 'Error',   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    skipped: { label: 'Skipped', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  };
  const { label, color, bg } = map[status] ?? map.skipped;
  return (
    <span style={{ padding: '0.2rem 0.55rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, color, background: bg }}>
      {label}
    </span>
  );
}

function Card({ label, hint, hintColor, children }: { label: string; hint?: string; hintColor?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(240,246,252,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        {hint && <span style={{ fontSize: '0.7rem', color: hintColor ?? 'rgba(240,246,252,0.25)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.35)', fontWeight: 500, marginBottom: '0.5rem' }}>{children}</div>;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '0.65rem 0.9rem',
  color: '#f0f6fc',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
