import { useState, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, X, ChevronDown, ChevronUp, Loader2, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const MODEL_ID = 'ft:gpt-4o-2024-08-06:korda::DczJwNyv';
const ACCENT = '#00C8FF';

const DEFAULT_SYSTEM = `You are Korda, a trading setup classifier trained on the TPSS (Trade Setup Scoring System) framework. You receive a chart screenshot and evaluate the price action strictly between the WHITE LINE (start of window) and the YELLOW LINE (entry cutoff). Everything before the white line does not exist.

Apply this three-step checklist in order. Stop at the first failure.

STEP 1 — STATE CLARITY
Does this chart tell a clear, obvious story between the lines?
- Hard to determine trend = BAD
- Multiple direction changes, no dominant direction = BAD
- Ambiguous bias at the yellow line = BAD (even if steps 2 and 3 pass)

STEP 2 — CONVINCING DIRECTIONAL MOVE
Must occur between the white line and ~1hr before the yellow line.
- Ranging or chopping first is fine — a convincing move anywhere in the window passes
- Must show conviction: strong impulse candles, decisive structure break, clear follow-through
- A consistent grind where one direction dominates is equally valid
- Liquidity grab = NOT valid (barely takes a level then immediately reverses)
- Conviction break = valid (closes well beyond the level, momentum continues)
- Direction does not matter — long and short are equally valid

STEP 3 — VALID PAUSE BEFORE YELLOW LINE
- Any visible slowdown, consolidation, or pullback after the move counts
- NON-NEGOTIABLE — clean trend straight into yellow line with no pause = BAD
- Pullback must NOT break the structural low (longs) or structural high (shorts) that originated the move
- Structural low/high = origin point of the move, NOT intermediate lows formed during it
- Pullback respecting the structural level = confirmation, increases confidence`;

interface Exchange {
  id: string;
  userText: string;
  imageSrc: string | null;
  response: string;
  timestamp: Date;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  background: '#080C10',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 7,
  padding: '0.75rem',
  fontSize: '0.8rem',
  color: '#f0f6fc',
  fontFamily: 'inherit',
  resize: 'vertical' as const,
  outline: 'none',
  lineHeight: 1.65,
};

export default function ChatPage() {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [systemOpen, setSystemOpen] = useState(false);
  const [userText, setUserText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) attachImage(file);
    }
  }, []);

  const handleSend = async () => {
    if (!userText.trim() && !imageFile) return;
    if (!apiKey) {
      toast.error('VITE_OPENAI_API_KEY is not set in .env');
      return;
    }

    // Capture before clearing state
    const capturedText = userText;
    const capturedFile = imageFile;
    const capturedPreviewUrl = imagePreview; // keep for display — don't revoke

    setUserText('');
    setImageFile(null);
    setImagePreview(null);
    setLoading(true);

    try {
      // Build user message content
      const userContent: any[] = [];
      if (capturedText.trim()) {
        userContent.push({ type: 'text', text: capturedText.trim() });
      }
      if (capturedFile) {
        const b64 = await fileToBase64(capturedFile);
        userContent.push({ type: 'image_url', image_url: { url: b64, detail: 'high' } });
      }

      const messages: any[] = [];
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt.trim() });
      }
      // If content is a single plain text string, send as string; otherwise send as array
      const userMsgContent = userContent.length === 1 && userContent[0].type === 'text'
        ? userContent[0].text
        : userContent;
      messages.push({ role: 'user', content: userMsgContent });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages,
          max_tokens: 2048,
          temperature: 1.0,
          top_p: 1.0,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      const responseText = data.choices?.[0]?.message?.content ?? '(no response)';

      setExchanges(prev => [
        {
          id: crypto.randomUUID(),
          userText: capturedText,
          imageSrc: capturedPreviewUrl,
          response: responseText,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      toast.error(err?.message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const canSend = !loading && (!!userText.trim() || !!imageFile);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,246,252,0.3)', marginBottom: '0.3rem' }}>
          Model Testing
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.02em', margin: 0 }}>
          Chat
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'rgba(240,246,252,0.3)', marginTop: '0.3rem', fontFamily: 'monospace' }}>
          {MODEL_ID}
        </p>
      </div>

      {/* System prompt */}
      <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: '1.25rem', overflow: 'hidden' }}>
        <button
          onClick={() => setSystemOpen(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.55)', fontSize: '0.8rem' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
              background: systemPrompt.trim() ? ACCENT : 'rgba(255,255,255,0.2)',
            }} />
            System message{systemPrompt.trim() ? '' : ' (empty)'}
          </span>
          {systemOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {systemOpen && (
          <div style={{ padding: '0 1rem 1rem' }}>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={10}
              style={INPUT}
              placeholder="Enter a system message…"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => setSystemPrompt('')}
                style={{ fontSize: '0.72rem', color: 'rgba(240,246,252,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.25)')}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, marginBottom: '2rem', overflow: 'hidden' }}
        onPaste={handlePaste}
      >
        {imagePreview && (
          <div style={{ padding: '0.75rem 1rem 0' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={imagePreview}
                alt="attached chart"
                style={{ height: 80, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }}
              />
              <button
                onClick={clearImage}
                style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%', background: '#111', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,246,252,0.7)' }}
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )}

        <textarea
          value={userText}
          onChange={e => setUserText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          rows={3}
          placeholder="Type your message… or paste a chart image directly (Shift+Enter for newline)"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'transparent', border: 'none',
            padding: '0.9rem 1rem 0.5rem', fontSize: '0.875rem',
            color: '#f0f6fc', fontFamily: 'inherit',
            resize: 'none', outline: 'none', lineHeight: 1.6,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) attachImage(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              style={{ padding: '0.4rem 0.55rem', borderRadius: 6, background: 'none', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: imageFile ? ACCENT : 'rgba(240,246,252,0.35)', display: 'flex', alignItems: 'center', transition: 'all 0.15s', borderColor: imageFile ? `${ACCENT}55` : 'rgba(255,255,255,0.08)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = imageFile ? `${ACCENT}55` : 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = imageFile ? ACCENT : 'rgba(240,246,252,0.35)'; }}
            >
              <ImageIcon size={15} />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1.1rem',
              background: canSend ? ACCENT : 'rgba(0,200,255,0.08)',
              color: canSend ? '#000' : 'rgba(0,200,255,0.3)',
              border: 'none', borderRadius: 7,
              fontWeight: 600, fontSize: '0.8rem',
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {loading
              ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
              : <Send size={14} />}
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Exchanges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {exchanges.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(240,246,252,0.18)', fontSize: '0.85rem' }}>
            Send a message or paste a chart image to test the model.
          </div>
        )}

        {loading && (
          <div style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'rgba(240,246,252,0.3)', fontSize: '0.82rem' }}>
            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: ACCENT, flexShrink: 0 }} />
            Waiting for model response…
          </div>
        )}

        {exchanges.map(ex => (
          <div key={ex.id} style={{ background: '#0D1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
            {/* User row */}
            <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(240,246,252,0.45)' }}>
                U
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ex.imageSrc && (
                  <img
                    src={ex.imageSrc}
                    alt="chart"
                    style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 7, marginBottom: ex.userText ? '0.6rem' : 0, border: '1px solid rgba(255,255,255,0.08)', objectFit: 'contain', background: '#000' }}
                  />
                )}
                {ex.userText && (
                  <p style={{ fontSize: '0.875rem', color: 'rgba(240,246,252,0.7)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {ex.userText}
                  </p>
                )}
                <div style={{ fontSize: '0.66rem', color: 'rgba(240,246,252,0.18)', marginTop: '0.35rem' }}>
                  {ex.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Model row */}
            <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,200,255,0.1)', border: `1px solid rgba(0,200,255,0.2)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: ACCENT }}>
                K
              </div>
              <p style={{ flex: 1, fontSize: '0.875rem', color: '#f0f6fc', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', minWidth: 0 }}>
                {ex.response}
              </p>
              <button
                onClick={() => { navigator.clipboard.writeText(ex.response); toast.success('Copied'); }}
                title="Copy response"
                style={{ flexShrink: 0, padding: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,246,252,0.2)', borderRadius: 4, transition: 'color 0.15s', alignSelf: 'flex-start' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.6)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.2)')}
              >
                <Copy size={13} />
              </button>
            </div>
          </div>
        ))}

        {exchanges.length > 0 && (
          <button
            onClick={() => setExchanges([])}
            style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'rgba(240,246,252,0.2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,246,252,0.2)')}
          >
            <Trash2 size={12} />
            Clear session
          </button>
        )}
      </div>
    </div>
  );
}
