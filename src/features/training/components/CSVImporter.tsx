import { useState, useRef, useCallback } from 'react';
import { X, Upload, Download, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { bulkInsertTrainingEntries } from '../lib/trainingData';
import type { TrainingEntry, TrainingEntryInsert, TradingSession } from '../types';

const SESSION_ALIASES: Record<string, TradingSession> = {
  london: 'london', ldn: 'london', eu: 'london', europe: 'london',
  new_york: 'new_york', newyork: 'new_york', ny: 'new_york', us: 'new_york', nyc: 'new_york',
  asia: 'asia', asian: 'asia', tokyo: 'asia', jp: 'asia',
};

function parseSession(val: string): TradingSession | null {
  return SESSION_ALIASES[val.toLowerCase().trim().replace(/[\s-]/g, '_')] ?? null;
}

const ACCENT      = '#00C8FF';
const VALID_GREEN = '#10b981';
const INVALID_RED = '#ef4444';
const WARN_YELLOW = '#f59e0b';

// â”€â”€ CSV parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseBool(val: string): boolean | null {
  const v = val.toLowerCase().trim();
  if (['true', '1', 'yes', 'valid', 'y'].includes(v))   return true;
  if (['false', '0', 'no', 'invalid', 'n'].includes(v)) return false;
  return null;
}

interface ParsedRow {
  index: number;
  raw: Record<string, string>;
  entry: TrainingEntryInsert | null;
  errors: string[];
}

function parseCSV(text: string): ParsedRow[] {
  // Strip BOM and normalise line endings
  const clean  = text.replace(/^ï»¿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines  = clean.split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));

  return lines.slice(1).map((line, i) => {
    const values = parseCSVLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, j) => { raw[h] = values[j] ?? ''; });

    const errors: string[] = [];

    // Resolve column aliases
    const tvUrl      = raw['tradingview_url'] ?? raw['tv_url'] ?? raw['url'] ?? '';
    const validRaw   = raw['is_valid_setup'] ?? raw['valid'] ?? raw['valid_setup'] ?? '';
    const sessionRaw = raw['session'] ?? raw['sessions'] ?? '';
    const notes      = raw['notes'] ?? raw['note'] ?? '';

    const isValid = parseBool(validRaw);
    const session = sessionRaw ? parseSession(sessionRaw) : null;

    if (!tvUrl)           errors.push('tradingview_url is required');
    if (isValid === null) errors.push(`is_valid_setup "${validRaw}" unrecognised (use true/false)`);
    if (sessionRaw && session === null) errors.push(`session "${sessionRaw}" unrecognised (use london/new_york/asia)`);

    const entry: TrainingEntryInsert | null = errors.length === 0 ? {
      tradingview_url: tvUrl,
      is_valid_setup:  isValid as boolean,
      session:         session,
      notes:           notes || null,
    } : null;

    return { index: i + 1, raw, entry, errors };
  });
}

// â”€â”€ Template download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function downloadTemplate() {
  const csv = [
    'tradingview_url,is_valid_setup,session,notes',
    'https://www.tradingview.com/x/abc123/,true,london,"Bullish divergence on 4H"',
    'https://www.tradingview.com/x/xyz456/,false,new_york,"No clear trend direction"',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'training_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Props {
  onClose:    () => void;
  onImported: (entries: TrainingEntry[]) => void;
}

export default function CSVImporter({ onClose, onImported }: Props) {
  const [rows, setRows]         = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && !file.name.endsWith('.txt')) {
      toast.error('Please select a .csv file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const parsed = parseCSV(e.target?.result as string);
      setRows(parsed);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const validRows   = rows.filter(r => r.entry !== null);
  const invalidRows = rows.filter(r => r.entry === null);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const entries = validRows.map(r => r.entry as TrainingEntryInsert);
      const inserted = await bulkInsertTrainingEntries(entries);
      toast.success(`${inserted.length} entr${inserted.length === 1 ? 'y' : 'ies'} imported.`);
      onImported(inserted);
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#131920',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14, width: '100%', maxWidth: 720,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f0f6fc', letterSpacing: '-0.02em' }}>
              Import CSV
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.35)', marginTop: '0.15rem' }}>
              Bulk-add labeled setups from a spreadsheet export
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={downloadTemplate}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                background: 'transparent', color: ACCENT,
                border: `1px solid ${ACCENT}40`, borderRadius: 7,
                fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Download size={12} /> Template
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.4)', display: 'flex', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `1.5px dashed ${dragging ? ACCENT : rows.length > 0 ? VALID_GREEN : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              padding: '1.5rem',
              cursor: 'pointer',
              background: dragging ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', textAlign: 'center', transition: 'all 0.15s',
              minHeight: 110,
            }}
          >
            <Upload size={22} style={{ color: dragging ? ACCENT : rows.length > 0 ? VALID_GREEN : 'rgba(240,246,252,0.2)' }} />
            {fileName ? (
              <span style={{ fontSize: '0.82rem', color: VALID_GREEN, fontFamily: "'JetBrains Mono', monospace" }}>
                âœ“ {fileName}
              </span>
            ) : (
              <span style={{ fontSize: '0.82rem', color: 'rgba(240,246,252,0.35)' }}>
                {dragging ? 'Drop CSV here' : 'Drag & drop a .csv file, or click to browse'}
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)' }}>
              Columns: tradingview_url Â· is_valid_setup Â· session Â· notes
            </span>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {/* Summary bar */}
          {rows.length > 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Chip color={ACCENT}      label="Total"    value={rows.length} />
              <Chip color={VALID_GREEN} label="Ready"    value={validRows.length} />
              {invalidRows.length > 0 && (
                <Chip color={INVALID_RED} label="Errors" value={invalidRows.length} />
              )}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: '#131920' }}>
                      {['#', 'Status', 'TradingView URL', 'Valid?', 'Notes', 'Issues'].map((h: string, i: number) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const ok = row.entry !== null;
                      const tvUrl = row.raw['tradingview_url'] ?? row.raw['tv_url'] ?? row.raw['url'] ?? '';
                      const validRaw = row.raw['is_valid_setup'] ?? row.raw['valid'] ?? row.raw['valid_setup'] ?? '';
                      const notes = row.raw['notes'] ?? row.raw['note'] ?? '';

                      return (
                        <tr
                          key={row.index}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: ok ? 'transparent' : `${INVALID_RED}08` }}
                        >
                          <td style={{ ...tdStyle, color: 'rgba(240,246,252,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', width: 36 }}>
                            {row.index}
                          </td>
                          <td style={{ ...tdStyle, width: 60 }}>
                            {ok
                              ? <CheckCircle2 size={14} style={{ color: VALID_GREEN }} />
                              : <XCircle      size={14} style={{ color: INVALID_RED }} />
                            }
                          </td>
                          <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(240,246,252,0.55)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tvUrl || <span style={{ color: 'rgba(240,246,252,0.2)' }}>—</span>}
                          </td>
                          <td style={tdStyle}>
                            {row.entry ? (
                              <span style={{
                                fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 9999,
                                background: row.entry.is_valid_setup ? `${VALID_GREEN}15` : `${INVALID_RED}15`,
                                color: row.entry.is_valid_setup ? VALID_GREEN : INVALID_RED,
                              }}>
                                {row.entry.is_valid_setup ? 'Valid' : 'Invalid'}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: WARN_YELLOW }}>{validRaw || '—'}</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '0.78rem', color: 'rgba(240,246,252,0.45)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {notes || <span style={{ color: 'rgba(240,246,252,0.2)' }}>—</span>}
                          </td>
                          <td style={tdStyle}>
                            {row.errors.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {row.errors.map((e, i) => (
                                  <span key={i} style={{ fontSize: '0.68rem', color: WARN_YELLOW, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <AlertTriangle size={10} style={{ flexShrink: 0 }} /> {e}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            style={{
              padding: '0.65rem 1.5rem',
              background: (validRows.length === 0 || importing) ? 'rgba(0,212,255,0.1)' : 'linear-gradient(135deg, #00C8FF 0%, #0090b3 100%)',
              color: (validRows.length === 0 || importing) ? 'rgba(0,212,255,0.4)' : '#0A0A0F',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.875rem',
              cursor: (validRows.length === 0 || importing) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.15s',
            }}
          >
            {importing && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            {importing ? 'Importing...' : `Import ${validRows.length} row${validRows.length !== 1 ? 's' : ''}`}
          </button>
          {invalidRows.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: WARN_YELLOW, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertTriangle size={13} />
              {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} will be skipped
            </span>
          )}
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', padding: '0.65rem 1.25rem', background: 'transparent', color: 'rgba(240,246,252,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', background: `${color}0d`, border: `1px solid ${color}25`, borderRadius: 9999 }}>
      <span style={{ fontSize: '0.7rem', color: 'rgba(240,246,252,0.4)' }}>{label}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '0.6rem 0.9rem', textAlign: 'left',
  fontSize: '0.68rem', fontWeight: 600,
  color: 'rgba(240,246,252,0.3)',
  letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.6rem 0.9rem', verticalAlign: 'middle',
};
