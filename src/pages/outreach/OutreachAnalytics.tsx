import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState, PageHeader } from '@/features/outreach/components/indicators';
import {
  RANGES, useAnalytics,
} from '@/features/outreach/hooks/useAnalytics';
import type {
  AnalyticsRange, CampaignStat, DailyPoint, IdentityStat,
} from '@/features/outreach/hooks/useAnalytics';

/*
 * Chart palette — validated against the Marvero light surface (#fafaf8), not
 * inherited from the old dark console. Colours do not survive a surface swap:
 * the previous amber/aqua set was stepped for a near-black plane and several
 * of those steps fall below 3:1 on white.
 *
 * The stack order is load-bearing. Replied-green next to bounced-red is the
 * pair a deuteranope cannot separate, so a third hue has to sit between them.
 * Amber was the obvious candidate and is the wrong one twice over: at a
 * readable lightness it collapses into the green (ΔE 1.3), and light enough to
 * separate it drops to 2.07:1 against the surface. Violet clears both — worst
 * adjacent pair ΔE 9.1 under CVD, 18.8 unsimulated, and every fill above 3:1.
 *
 * The neutral is deliberately chroma-less: "no response yet" is the remainder,
 * not an identity, and should recede rather than compete.
 */
const VIZ = {
  sent: '#2743f0',
  replied: '#008300',
  unsubscribed: '#4a3aa7',
  bounced: '#d03b3b',
  none: '#8a8781',
  grid: '#e8e7e1',
  axis: '#86847d',
  surface: '#fafaf8',
};

/*
 * Status is reserved and never reused as a series colour. Marks and text take
 * different steps: a fill only needs 3:1, but the same hue as small text needs
 * 4.5:1, and the vivid warning step is nowhere near that on white.
 */
const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' };
const STATUS_TEXT = { good: '#006300', warning: '#8a5a00', critical: '#b3261e', none: '#56554f' };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const compact = (n: number) =>
  n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('en-GB');

/**
 * Bounce rate is the number that decides whether the domain survives. Mailbox
 * providers start filtering around 3%, so this is a threshold reading, not a
 * trend — which is why it gets status colour and a word, never colour alone.
 */
function bounceVerdict(rate: number, sent: number) {
  // STATUS_TEXT, not STATUS: these render as a number and a word, and the
  // mark-grade steps are unreadable as small text on a white plane.
  if (sent < 20) return { color: STATUS_TEXT.none, word: 'too early to judge' };
  if (rate >= 0.03) return { color: STATUS_TEXT.critical, word: 'stop and fix targeting' };
  if (rate >= 0.02) return { color: STATUS_TEXT.warning, word: 'watch closely' };
  return { color: STATUS_TEXT.good, word: 'healthy' };
}

function Delta({ now, before, unit }: { now: number; before: number | null; unit: 'pct' | 'count' }) {
  if (before === null) return null;
  const diff = now - before;
  if (Math.abs(diff) < (unit === 'pct' ? 0.0005 : 0.5)) {
    return <span className="text-[0.7rem] text-muted-foreground">no change</span>;
  }
  const up = diff > 0;
  return (
    <span className="text-[0.7rem]" style={{ color: up ? STATUS_TEXT.good : STATUS_TEXT.none }}>
      {up ? '↑' : '↓'} {unit === 'pct' ? pct(Math.abs(diff)) : compact(Math.abs(diff))}
      <span className="text-muted-foreground"> vs previous</span>
    </span>
  );
}

/** 12-point sparkline, de-emphasised — shape only, the tile's value carries the number. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const w = 96, h = 24;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} aria-hidden style={{ display: 'block', marginTop: '0.5rem' }}>
      <path d={d} fill="none" stroke={VIZ.sent} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
    </svg>
  );
}

function StatTile({
  label, value, delta, footnote, accent, spark,
}: {
  label: string; value: string; delta?: React.ReactNode;
  footnote?: React.ReactNode; accent?: string; spark?: number[];
}) {
  return (
    <div className="o-panel p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {delta && <div className="mt-1">{delta}</div>}
      {footnote && <div className="mt-1 text-[0.7rem] text-muted-foreground">{footnote}</div>}
      {spark && <Sparkline points={spark} />}
    </div>
  );
}

interface TooltipEntry { name: string; value: number; color: string }

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipEntry[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e4e3dd',
      borderRadius: 3, padding: '0.5rem 0.7rem', fontSize: '0.75rem',
      fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
    }}>
      <div style={{ color: '#0d0d0d', marginBottom: 4 }}>{label}</div>
      {payload.map(entry => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 2, background: entry.color, flexShrink: 0,
          }} />
          <span style={{ color: '#56554f' }}>{entry.name}</span>
          <span style={{ color: '#0d0d0d', fontVariantNumeric: 'tabular-nums' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Part-to-whole as one bar. Built from flex rather than a chart library so the
 * 2px surface gaps between segments are exact — that gap, not a border, is what
 * separates touching marks.
 */
function OutcomeBar({ segments, total }: {
  segments: { key: string; label: string; value: number; color: string }[];
  total: number;
}) {
  const shown = segments.filter(s => s.value > 0);
  return (
    <>
      <div style={{ display: 'flex', gap: 2, height: 28, borderRadius: 2, overflow: 'hidden' }}>
        {shown.map(s => {
          const share = s.value / total;
          // Only label inside when the text genuinely fits — a clipped label is
          // worse than none, and the table below carries every value anyway.
          const roomy = share > 0.14;
          return (
            <div key={s.key}
              title={`${s.label}: ${s.value}`}
              style={{
                width: `${share * 100}%`, background: s.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 3,
              }}>
              {roomy && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600,
                  color: '#ffffff',
                }}>
                  {Math.round(share * 100)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', marginTop: '0.75rem' }}>
        {segments.map(s => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
          </span>
        ))}
      </div>
    </>
  );
}

function CampaignTable({ rows }: { rows: CampaignStat[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Campaign</TableHead>
          <TableHead className="text-right">Sent</TableHead>
          <TableHead className="text-right">Replied</TableHead>
          <TableHead className="text-right">Bounced</TableHead>
          <TableHead className="w-40">Reply rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(c => (
          <TableRow key={c.id}>
            <TableCell className="text-sm">{c.name}</TableCell>
            <TableCell className="o-num text-right text-xs">{c.sent}</TableCell>
            <TableCell className="o-num text-right text-xs">{c.replied}</TableCell>
            <TableCell className="o-num text-right text-xs"
              style={c.bounced > 0 ? { color: STATUS_TEXT.critical } : undefined}>
              {c.bounced}
            </TableCell>
            <TableCell>
              <div className="o-meter">
                <div className="o-meter-track">
                  <div className="o-meter-fill"
                    style={{
                      // Rates above ~10% are exceptional in cold outreach, so the
                      // track is scaled to 20% rather than 100% — otherwise every
                      // real bar is a sliver and the column says nothing.
                      width: `${Math.min(100, c.replyRate * 500)}%`,
                      background: VIZ.replied,
                    }} />
                </div>
                <span className="o-meter-num">{pct(c.replyRate)}</span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MailboxTable({ rows }: { rows: IdentityStat[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mailbox</TableHead>
          <TableHead className="w-44">Today</TableHead>
          <TableHead className="text-right">Sent all time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(i => {
          const share = i.capToday > 0 ? i.sentToday / i.capToday : 0;
          const full = i.sentToday >= i.capToday;
          return (
            <TableRow key={i.id}>
              <TableCell>
                <div className="text-sm">{i.label}</div>
                <div className="outreach-mono text-[0.7rem] text-muted-foreground">{i.fromEmail}</div>
              </TableCell>
              <TableCell>
                <div className="o-meter">
                  <div className="o-meter-track">
                    <div className="o-meter-fill"
                      style={{
                        width: `${Math.min(100, share * 100)}%`,
                        background: full ? STATUS.warning : VIZ.sent,
                      }} />
                  </div>
                  <span className="o-meter-num">{i.sentToday}/{i.capToday}</span>
                </div>
                {i.warming && (
                  <span className="text-[0.65rem]" style={{ color: STATUS_TEXT.warning }}>
                    warming up — cap rises weekly
                  </span>
                )}
              </TableCell>
              <TableCell className="o-num text-right text-xs">{i.sentTotal}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function OutreachAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>(RANGES[1]);
  const { data, isLoading, error } = useAnalytics(range);

  if (error) return <ErrorState error={error} />;

  const verdict = data ? bounceVerdict(data.bounceRate, data.sent) : null;
  const daily: DailyPoint[] = data?.daily ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Analytics"
        sub="Replies are the metric that pays; bounce rate is the one that decides whether the domain survives."
        actions={
          <div style={{ display: 'flex', border: '1px solid #e4e3dd', borderRadius: 3, overflow: 'hidden' }}>
            {RANGES.map(r => (
              <button key={r.label}
                onClick={() => setRange(r)}
                className="text-xs"
                style={{
                  padding: '0.4rem 0.75rem', border: 'none', cursor: 'pointer',
                  fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.63rem',
                  background: r.label === range.label ? '#2743f0' : '#ffffff',
                  color: r.label === range.label ? '#ffffff' : '#56554f',
                }}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading ? (
        <EmptyState title="Loading analytics…" />
      ) : data?.isEmpty ? (
        <EmptyState
          title="Nothing sent yet."
          hint="Once the first campaign goes out, reply and bounce rates land here."
        />
      ) : data && verdict ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Emails sent"
              value={compact(data.sent)}
              delta={<Delta now={data.sent} before={data.previous?.sent ?? null} unit="count" />}
              spark={daily.map(d => d.sent)}
            />
            <StatTile
              label="Reply rate"
              value={pct(data.replyRate)}
              delta={<Delta now={data.replyRate} before={data.previous?.replyRate ?? null} unit="pct" />}
              footnote={`${data.replied} of ${data.sent} contacted`}
            />
            <StatTile
              label="Bounce rate"
              value={pct(data.bounceRate)}
              accent={verdict.color}
              footnote={<><span style={{ color: verdict.color }}>●</span> {verdict.word}</>}
            />
            <StatTile
              label="Unsubscribe rate"
              value={pct(data.unsubRate)}
              footnote={`${data.unsubscribed} opted out`}
            />
          </div>

          <div className="o-panel mb-4 p-4">
            <div className="mb-1 text-sm">Daily activity</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Sends and replies per day, counted on the day each happened.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2}>
                <CartesianGrid stroke={VIZ.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: VIZ.axis, fontSize: 11 }}
                  tickLine={false} axisLine={{ stroke: VIZ.grid }} minTickGap={24} />
                <YAxis tick={{ fill: VIZ.axis, fontSize: 11 }} tickLine={false}
                  axisLine={false} allowDecimals={false} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(13,13,13,0.035)' }} />
                <Legend wrapperStyle={{ fontSize: '0.75rem', color: '#56554f' }}
                  iconType="square" iconSize={8} />
                <Bar dataKey="sent" name="Sent" fill={VIZ.sent} maxBarSize={24} radius={[2, 2, 0, 0]} />
                <Bar dataKey="replied" name="Replied" fill={VIZ.replied} maxBarSize={24} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <div className="o-panel p-4">
              <div className="mb-1 text-sm">What happened to everything sent</div>
              <p className="mb-3 text-xs text-muted-foreground">
                Share of {compact(data.sent)} delivered emails by outcome.
              </p>
              <OutcomeBar
                total={Math.max(1, data.sent)}
                segments={[
                  { key: 'replied', label: 'Replied', value: data.replied, color: VIZ.replied },
                  { key: 'unsub', label: 'Unsubscribed', value: data.unsubscribed, color: VIZ.unsubscribed },
                  { key: 'bounced', label: 'Bounced', value: data.bounced, color: VIZ.bounced },
                  { key: 'none', label: 'No response yet', value: data.noResponse, color: VIZ.none },
                ]}
              />
            </div>

            <div className="o-panel p-4">
              <div className="mb-1 text-sm">Mailbox capacity</div>
              <p className="mb-3 text-xs text-muted-foreground">
                Daily headroom per sender. A warming mailbox ramps from 5/day.
              </p>
              {data.identities.length === 0
                ? <p className="text-xs text-muted-foreground">No senders configured.</p>
                : <MailboxTable rows={data.identities} />}
            </div>
          </div>

          <div className="o-panel p-4">
            <div className="mb-1 text-sm">By campaign</div>
            <p className="mb-3 text-xs text-muted-foreground">
              Reply-rate bars are scaled to 20% — above that is exceptional for cold outreach.
            </p>
            {data.campaigns.length === 0
              ? <p className="text-xs text-muted-foreground">No campaigns have sent yet.</p>
              : <CampaignTable rows={data.campaigns} />}
          </div>
        </>
      ) : null}
    </div>
  );
}
