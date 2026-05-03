import { useState, useRef, useCallback } from 'react';
import { Upload, Link as LinkIcon, CheckCircle2, XCircle, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { insertTrainingEntry, uploadScreenshot } from '../lib/trainingData';

const ACCENT = '#00d4ff';
const VALID_GREEN = '#10b981';
const INVALID_RED = '#ef4444';

export default function EntryForm() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tvUrl, setTvUrl] = useState('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, [handleFileSelect]);

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setTvUrl('');
    setIsValid(null);
    setNotes('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file && !tvUrl.trim()) {
      toast.error('Provide a screenshot upload or TradingView URL.');
      return;
    }
    if (isValid === null) {
      toast.error('Mark the setup as Valid or Invalid.');
      return;
    }

    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (file) {
        screenshotUrl = await uploadScreenshot(file);
      }

      await insertTrainingEntry({
        screenshot_url: screenshotUrl,
        tradingview_url: tvUrl.trim() || (screenshotUrl ?? ''),
        is_valid_setup: isValid,
        notes: notes.trim() || null,
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
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.03em', margin: 0 }}>
          New Training Entry
        </h1>
        <p style={{ fontSize: '0.825rem', color: 'rgba(240,246,252,0.4)', marginTop: '0.35rem' }}>
          Label chart setups to build the AI training dataset.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', maxWidth: 760 }}>

          {/* ── Screenshot + TradingView URL ── */}
          <Card label="Chart Source" hint="Provide at least one">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

              {/* File upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={labelStyle}>Screenshot Upload</span>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${dragging ? ACCENT : previewUrl ? VALID_GREEN : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 10,
                    padding: previewUrl ? 0 : '1.5rem 1rem',
                    cursor: 'pointer',
                    background: dragging ? 'rgba(0,212,255,0.04)' : previewUrl ? '#000' : 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s',
                    minHeight: previewUrl ? 0 : 120,
                    overflow: 'hidden',
                  }}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="preview" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 9 }} />
                  ) : (
                    <>
                      <ImageIcon size={22} style={{ color: dragging ? ACCENT : 'rgba(240,246,252,0.25)' }} />
                      <span style={{ fontSize: '0.75rem', color: 'rgba(240,246,252,0.4)', textAlign: 'center', lineHeight: 1.4 }}>
                        {dragging ? 'Drop it here' : 'Drag & drop or click to upload'}
                      </span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                {file && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', color: VALID_GREEN, fontFamily: "'JetBrains Mono', monospace" }}>
                      ✓ {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreviewUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.3)', fontSize: '0.75rem', padding: 0, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* TradingView URL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={labelStyle}>TradingView URL</span>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexDirection: 'column', height: '100%' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <LinkIcon size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(240,246,252,0.3)', pointerEvents: 'none' }} />
                    <input
                      type="url"
                      value={tvUrl}
                      onChange={e => setTvUrl(e.target.value)}
                      placeholder="https://www.tradingview.com/chart/..."
                      style={{
                        ...inputStyle,
                        paddingLeft: '2rem',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.72rem',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.3)', margin: 0, lineHeight: 1.4 }}>
                    Paste a direct chart link from TradingView. Either field alone is sufficient.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* ── Valid / Invalid toggle ── */}
          <Card label="Setup Classification" hint="Required">
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <SetupButton
                active={isValid === true}
                color={VALID_GREEN}
                icon={<CheckCircle2 size={16} />}
                label="Valid Setup"
                sublabel="High-quality, actionable signal"
                onClick={() => setIsValid(true)}
              />
              <SetupButton
                active={isValid === false}
                color={INVALID_RED}
                icon={<XCircle size={16} />}
                label="Invalid Setup"
                sublabel="Noise, ambiguous, or low-quality"
                onClick={() => setIsValid(false)}
              />
            </div>
          </Card>

          {/* ── Notes ── */}
          <Card label="Analyst Notes" hint="Optional">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Describe the setup, confluences, and your reasoning..."
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 110,
                lineHeight: 1.6,
              }}
            />
          </Card>

          {/* ── Submit ── */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.65rem 1.75rem',
                background: submitting ? 'rgba(0,212,255,0.15)' : 'linear-gradient(135deg, #00d4ff 0%, #0090b3 100%)',
                color: submitting ? 'rgba(0,212,255,0.5)' : '#0d1117',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {submitting && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={submitting}
              style={{
                padding: '0.65rem 1.25rem',
                background: 'transparent',
                color: 'rgba(240,246,252,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontWeight: 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
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

// ── Sub-components ──

function Card({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgba(240,246,252,0.75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: '0.7rem', color: 'rgba(240,246,252,0.25)' }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function SetupButton({ active, color, icon, label, sublabel, onClick }: {
  active: boolean;
  color: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 160,
        padding: '1rem 1.25rem',
        background: active ? `${color}14` : 'rgba(255,255,255,0.02)',
        border: `1.5px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <div style={{ color: active ? color : 'rgba(240,246,252,0.25)', marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: active ? color : 'rgba(240,246,252,0.55)', marginBottom: '0.2rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.3)', lineHeight: 1.3 }}>{sublabel}</div>
      </div>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '0.6rem 0.9rem',
  color: '#f0f6fc',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'rgba(240,246,252,0.45)',
  fontWeight: 500,
};
