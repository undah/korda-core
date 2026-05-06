import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, Terminal, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const API_BASE = 'https://finetuning-service-production.up.railway.app';
const ACCENT   = '#00C8FF';
const POLL_MS  = 3000;

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  step?: string;
  message?: string;
  result?: {
    setups_rows?: number;
    mistakes_rows?: number;
    setups_file_id?: string;
    mistakes_file_id?: string;
    finetune_job_id?: string;
    finetune_job_ids?: string[];
    [key: string]: any;
  };
  error?: string;
  [key: string]: any;
}

interface HistoryRun {
  id?: string;
  started_at?: string;
  completed_at?: string;
  status?: string;
  setups_rows?: number;
  mistakes_rows?: number;
  setups_file_id?: string;
  mistakes_file_id?: string;
  finetune_job_id?: string;
  [key: string]: any;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? ACCENT : 'rgba(240,246,252,0.3)', display: 'flex', alignItems: 'center', padding: '0.15rem', borderRadius: 4, transition: 'color 0.12s', flexShrink: 0 }}
      onMouseEnter={e => { if (!copied) (e.currentTarget.style.color = ACCENT); }}
      onMouseLeave={e => { if (!copied) (e.currentTarget.style.color = 'rgba(240,246,252,0.3)'); }}>
      <Copy size={12} />
    </button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status ?? 'unknown').toLowerCase();
  const map: Record<string, { color: string; bg: string; label: string }> = {
    done:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Done'    },
    error:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Error'   },
    running: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Running' },
    idle:    { color: 'rgba(240,246,252,0.3)', bg: 'rgba(255,255,255,0.05)', label: 'Idle' },
  };
  const st = map[s] ?? { color: 'rgba(240,246,252,0.3)', bg: 'rgba(255,255,255,0.05)', label: s };
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.color}30`, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  );
}

function IdRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 120, flexShrink: 0 }}>{label}</span>
      <code style={{ fontSize: '0.78rem', color: ACCENT, fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
      <CopyBtn text={value} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinetunePage() {
  const [runStatus, setRunStatus]     = useState<RunStatus>({ status: 'idle' });
  const [history, setHistory]         = useState<HistoryRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [triggering, setTriggering]   = useState(false);
  const [stepLog, setStepLog]         = useState<string[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStepRef = useRef('');
  const logBoxRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [stepLog]);

  const fetchStatus = useCallback(async (): Promise<RunStatus> => {
    const res = await fetch(`${API_BASE}/run-status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/history`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  }, []);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(async () => {
      try {
        const s = await fetchStatus();
        setRunStatus(s);
        const step = s.step ?? s.message ?? '';
        if (step && step !== prevStepRef.current) {
          prevStepRef.current = step;
          setStepLog(prev => [...prev, step]);
        }
        if (s.status !== 'running') {
          stopPolling();
          if (s.status === 'done') loadHistory();
        }
      } catch { /* keep polling on transient errors */ }
    }, POLL_MS);
  }, [fetchStatus, loadHistory, stopPolling]);

  useEffect(() => {
    loadHistory();
    fetchStatus().then(s => {
      setRunStatus(s);
      if (s.status === 'running') startPolling();
    }).catch(() => {});
    return stopPolling;
  }, []);

  const handleRun = async () => {
    if (triggering || runStatus.status === 'running') return;
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/generate`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRunStatus({ status: 'running' });
      setStepLog(['Pipeline started…']);
      prevStepRef.current = 'Pipeline started…';
      startPolling();
      toast.success('Fine-tune pipeline started.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start pipeline.');
    } finally { setTriggering(false); }
  };

  const isRunning = runStatus.status === 'running';
  const isDone    = runStatus.status === 'done';
  const isError   = runStatus.status === 'error';
  const result    = runStatus.result ?? {};

  const formatDate = (s?: string) => {
    if (!s) return '—';
    try { return format(parseISO(s), 'MMM d, yyyy HH:mm'); } catch { return s; }
  };

  return (
    <div style={{ maxWidth: 1060, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes pulse-border { 0%, 100% { border-color: rgba(0,200,255,0.25); } 50% { border-color: rgba(0,200,255,0.55); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={20} style={{ color: ACCENT }} /> Fine-tune Pipeline
          </h1>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'rgba(240,246,252,0.35)' }}>
            Build JSONL training files from Supabase and submit a fine-tuning job to OpenAI
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning || triggering}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.4rem',
            background: isRunning || triggering ? 'rgba(0,200,255,0.08)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)',
            color: isRunning || triggering ? 'rgba(0,200,255,0.4)' : '#0A0A0F',
            border: isRunning || triggering ? '1px solid rgba(0,200,255,0.2)' : 'none',
            borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            cursor: isRunning || triggering ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            animation: isRunning ? 'pulse-border 2s infinite' : 'none',
          }}
        >
          {isRunning || triggering
            ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Running…</>
            : <><Zap size={15} /> Run Fine-tune Pipeline</>
          }
        </button>
      </div>

      {/* ── Pipeline status card ── */}
      {(isRunning || isDone || isError) && (
        <div style={{
          background: '#0D0D14', border: `1px solid ${isDone ? 'rgba(34,197,94,0.2)' : isError ? 'rgba(239,68,68,0.2)' : 'rgba(0,200,255,0.2)'}`,
          borderRadius: 12, marginBottom: '1.25rem', overflow: 'hidden',
          animation: isRunning ? 'pulse-border 2.5s ease-in-out infinite' : 'none',
        }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {isRunning && (
              <>
                <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f6fc' }}>Pipeline Running</span>
                <Loader2 size={14} style={{ marginLeft: 'auto', color: ACCENT, animation: 'spin 0.8s linear infinite' }} />
              </>
            )}
            {isDone && (
              <>
                <CheckCircle2 size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f6fc' }}>Pipeline Complete</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'rgba(240,246,252,0.3)' }}>Results below</span>
              </>
            )}
            {isError && (
              <>
                <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f0f6fc' }}>Pipeline Error</span>
              </>
            )}
          </div>

          {/* Step log terminal (during run) */}
          {(isRunning || (isDone && stepLog.length > 0)) && (
            <div ref={logBoxRef} style={{ padding: '1rem 1.5rem', maxHeight: 180, overflowY: 'auto', background: '#080810', fontFamily: "'JetBrains Mono', 'Fira Code', monospace', monospace", fontSize: '0.78rem' }}>
              {stepLog.map((line, i) => {
                const isLast = i === stepLog.length - 1;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.2rem', color: isLast && isRunning ? '#f0f6fc' : 'rgba(240,246,252,0.45)' }}>
                    <Terminal size={11} style={{ flexShrink: 0, marginTop: 2, color: isLast && isRunning ? ACCENT : 'rgba(240,246,252,0.2)' }} />
                    <span>{line}</span>
                  </div>
                );
              })}
              {isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: ACCENT }}>
                  <span style={{ opacity: 0.7 }}>▸</span>
                  <span style={{ animation: 'ping 1s ease-in-out infinite', display: 'inline-block', width: 6, height: 14, background: ACCENT, borderRadius: 1 }} />
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {isError && runStatus.error && (
            <div style={{ padding: '1rem 1.5rem', color: '#fca5a5', fontSize: '0.82rem', fontFamily: "'JetBrains Mono', monospace" }}>
              {runStatus.error}
            </div>
          )}

          {/* Results grid */}
          {isDone && (
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {/* Row counts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  { label: 'Setups', value: result.setups_rows, color: '#22c55e' },
                  { label: 'Mistakes', value: result.mistakes_rows, color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(240,246,252,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.35rem' }}>{item.label} Rows</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: item.value != null ? item.color : 'rgba(240,246,252,0.2)', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {item.value ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              {/* IDs */}
              <div style={{ background: '#0A0A0F', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '0.25rem 1rem' }}>
                <IdRow label="Setups File"    value={result.setups_file_id} />
                <IdRow label="Mistakes File"  value={result.mistakes_file_id} />
                <IdRow label="Fine-tune Job"  value={result.finetune_job_id ?? result.finetune_job_ids?.[0]} />
              </div>

              {/* OpenAI link */}
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href="https://platform.openai.com/finetune"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, color: 'rgba(240,246,252,0.6)', fontSize: '0.78rem', textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f0f6fc'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(240,246,252,0.6)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'; }}
                >
                  <ExternalLink size={13} /> Monitor on OpenAI Platform
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History ── */}
      <div style={{ background: '#0D0D14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'rgba(240,246,252,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Run History</span>
          <button onClick={loadHistory} disabled={loadingHistory} style={{ background: 'none', border: 'none', cursor: loadingHistory ? 'not-allowed' : 'pointer', color: 'rgba(240,246,252,0.3)', display: 'flex', padding: 4 }}>
            <RefreshCw size={13} style={loadingHistory ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          </button>
        </div>

        {loadingHistory ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2.5rem' }}>
            <Loader2 size={20} style={{ color: ACCENT, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'rgba(240,246,252,0.2)', fontSize: '0.83rem' }}>
            No runs yet. Trigger the pipeline above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Date', 'Status', 'Setups', 'Mistakes', 'File IDs', 'Job ID'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 600, color: 'rgba(240,246,252,0.3)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((run, i) => (
                  <tr key={run.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: 'rgba(240,246,252,0.55)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatDate(run.started_at ?? run.completed_at)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <StatusBadge status={run.status} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'rgba(240,246,252,0.7)', fontWeight: 600 }}>
                      {run.setups_rows ?? '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.82rem', color: 'rgba(240,246,252,0.7)', fontWeight: 600 }}>
                      {run.mistakes_rows ?? '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {run.setups_file_id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <code style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.4)', fontFamily: "'JetBrains Mono', monospace", maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.setups_file_id}</code>
                            <CopyBtn text={run.setups_file_id} />
                          </div>
                        )}
                        {run.mistakes_file_id && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <code style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.4)', fontFamily: "'JetBrains Mono', monospace", maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.mistakes_file_id}</code>
                            <CopyBtn text={run.mistakes_file_id} />
                          </div>
                        )}
                        {!run.setups_file_id && !run.mistakes_file_id && <span style={{ color: 'rgba(240,246,252,0.2)', fontSize: '0.78rem' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {run.finetune_job_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <code style={{ fontSize: '0.72rem', color: ACCENT, fontFamily: "'JetBrains Mono', monospace", maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.finetune_job_id}</code>
                          <CopyBtn text={run.finetune_job_id} />
                          <a href="https://platform.openai.com/finetune" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(240,246,252,0.25)', display: 'flex', transition: 'color 0.12s' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#f0f6fc')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.25)')}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      ) : <span style={{ color: 'rgba(240,246,252,0.2)', fontSize: '0.78rem' }}>—</span>}
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
