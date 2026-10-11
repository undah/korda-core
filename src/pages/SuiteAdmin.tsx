// src/pages/SuiteAdmin.tsx — /admin: every Korda account, who gets which app, passwords and the rest.
//
// Same look as the suite's front door (SuiteHome): near-black, Playfair for
// names, IBM Plex Mono for labels, each app in its own colour. Only admins get
// here (AdminRoute); the server checks again on every call
// (functions/api/admin/_middleware.js), so this page holds no power itself.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

type BeperkteApp = "outreach" | "crm" | "training";

type Account = {
  id: string;
  email: string;
  naam: string | null;
  aangemaakt: string | null;
  laatstIngelogd: string | null;
  bevestigd: boolean;
  geblokkeerd: boolean;
  providers: string[];
  apps: BeperkteApp[];
  admin: boolean;
  huishoudens: number;
};
type LogRegel = { door_email: string | null; wie_email: string | null; actie: string; details: string | null; at: string };
type Overzicht = { accounts: Account[]; log: LogRegel[]; ik: string };

const OPEN_APPS = [
  { id: "budget", naam: "KordaBudget", c: "139,138,245" },
  { id: "tracker", naam: "KordaTracker", c: "90,180,212" },
  { id: "trading", naam: "KordaTrading", c: "0,184,148" },
];
const BEPERKT: Array<{ id: BeperkteApp; naam: string; c: string }> = [
  { id: "outreach", naam: "Outreach", c: "232,150,68" },
  { id: "crm", naam: "CRM", c: "59,130,246" },
  { id: "training", naam: "Training", c: "214,120,200" },
];

const ACTIE_TEKST: Record<string, string> = {
  wachtwoord: "changed the password of",
  email: "changed the e-mail of",
  naam: "renamed",
  blokkeer: "blocked",
  deblokkeer: "unblocked",
  verwijder: "deleted",
  app: "changed app access for",
  admin: "changed admin rights for",
  link: "made a sign-in link for",
  maak: "created",
};

async function api<T>(init?: { method?: string; body?: unknown }): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/accounts", {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j as T;
}

const datum = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

function geleden(iso: string | null) {
  if (!iso) return "Never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return datum(iso);
}

const binnen = (iso: string | null, dagen: number) => !!iso && Date.now() - new Date(iso).getTime() < dagen * 86400_000;

function wachtwoordVoorstel() {
  const tekens = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(r, (n) => tekens[n % tekens.length]).join("");
}

type Filter = "alle" | "admins" | "nieuw" | "beperkt" | "geblokkeerd" | "nooit";
const FILTERS: Array<{ id: Filter; label: string; past: (a: Account) => boolean }> = [
  { id: "alle", label: "All", past: () => true },
  { id: "nieuw", label: "New this week", past: (a) => binnen(a.aangemaakt, 7) },
  { id: "beperkt", label: "Outreach · CRM · Training", past: (a) => a.apps.length > 0 },
  { id: "admins", label: "Admins", past: (a) => a.admin },
  { id: "nooit", label: "Never signed in", past: (a) => !a.laatstIngelogd },
  { id: "geblokkeerd", label: "Blocked", past: (a) => a.geblokkeerd },
];

export default function SuiteAdmin() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["admin_accounts"], queryFn: () => api<Overzicht>() });
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState(false);

  useSuiteStijl();

  const accounts = data?.accounts ?? [];
  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const f = FILTERS.find((x) => x.id === filter)!;
    return accounts.filter((a) => f.past(a) && (!q || a.email.toLowerCase().includes(q) || (a.naam ?? "").toLowerCase().includes(q)));
  }, [accounts, zoek, filter]);
  const open = accounts.find((a) => a.id === openId) ?? null;

  const cijfers = [
    { label: "Accounts", waarde: accounts.length, c: "232,230,225" },
    { label: "New this week", waarde: accounts.filter((a) => binnen(a.aangemaakt, 7)).length, c: "139,138,245" },
    { label: "Active, last 7 days", waarde: accounts.filter((a) => binnen(a.laatstIngelogd, 7)).length, c: "0,184,148" },
    { label: "Blocked", waarde: accounts.filter((a) => a.geblokkeerd).length, c: "232,110,100" },
  ];

  return (
    <div className="suite-portal">
      <div className="suite-root">
        <div className="suite-noise" />
        <div className="suite-orb suite-orb-1" />
        <div className="suite-orb suite-orb-2" />

        <nav className="suite-nav">
          <Link to="/" className="suite-nav-logo" style={{ textDecoration: "none" }}>
            Korda<sup>™</sup>
          </Link>
          <div className="suite-nav-links">
            <Link to="/">Apps</Link>
            <a aria-current="page" style={{ color: "#e8e6e1" }}>
              Accounts
            </a>
          </div>
        </nav>

        <section className="ka-kop suite-anim-1">
          <p className="suite-eyebrow" style={{ justifyContent: "flex-start" }}>
            The Korda™ Suite · Admin
          </p>
          <div className="ka-kop-rij">
            <h1 className="suite-h1" style={{ marginBottom: 0 }}>
              Accounts<em>.</em>
            </h1>
            <button type="button" className="ka-knop ka-knop-primair" onClick={() => setNieuw(true)}>
              + New account
            </button>
          </div>
          <p className="suite-sub" style={{ margin: "1rem 0 0", textAlign: "left" }}>
            Everyone with a Korda login. Budget, Tracker and Trading are open to all; Outreach, CRM and Training you hand out
            per person.
          </p>
        </section>

        <section className="ka-cijfers suite-anim-2">
          {cijfers.map((c) => (
            <div key={c.label} className="ka-cijfer" style={{ ["--c" as string]: c.c }}>
              <span className="ka-label">{c.label}</span>
              <span className="ka-getal">{isLoading ? "–" : c.waarde}</span>
            </div>
          ))}
        </section>

        <section className="ka-lijst suite-anim-3">
          <div className="ka-gereedschap">
            <input
              className="ka-invoer ka-zoek"
              type="search"
              placeholder="Search name or e-mail"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              aria-label="Search accounts"
            />
            <div className="ka-filters" role="tablist" aria-label="Filter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`ka-chip ${filter === f.id ? "ka-chip-aan" : ""}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="ka-chip-n">{accounts.filter(f.past).length}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="ka-fout">{(error as Error).message}</p>}

          <div className="ka-tabel" role="table" aria-label="Accounts">
            <div className="ka-rij ka-rij-kop" role="row">
              <span role="columnheader">Account</span>
              <span role="columnheader">Apps</span>
              <span role="columnheader">Last sign-in</span>
              <span role="columnheader">Joined</span>
              <span role="columnheader" aria-label="Open" />
            </div>
            {isLoading && <p className="ka-leeg">Loading accounts…</p>}
            {!isLoading && zichtbaar.length === 0 && <p className="ka-leeg">No accounts match.</p>}
            {zichtbaar.map((a) => (
              <button key={a.id} type="button" role="row" className="ka-rij" onClick={() => setOpenId(a.id)}>
                <span className="ka-wie" role="cell">
                  <Initiaal a={a} />
                  <span style={{ minWidth: 0 }}>
                    <span className="ka-naam">
                      {a.naam ?? a.email.split("@")[0]}
                      {a.id === data?.ik && <span className="ka-badge">You</span>}
                      {a.admin && <span className="ka-badge">Admin</span>}
                      {a.geblokkeerd && <span className="ka-badge ka-badge-rood">Blocked</span>}
                      {!a.bevestigd && <span className="ka-badge ka-badge-dim">Unconfirmed</span>}
                    </span>
                    <span className="ka-email">{a.email}</span>
                  </span>
                </span>
                <span className="ka-apps" role="cell">
                  {BEPERKT.filter((b) => a.apps.includes(b.id)).map((b) => (
                    <span key={b.id} className="ka-app" style={{ ["--c" as string]: b.c }}>
                      {b.naam}
                    </span>
                  ))}
                  {a.apps.length === 0 && <span className="ka-dim">Open apps only</span>}
                </span>
                <span className="ka-mono" role="cell">
                  <span className="ka-mob-label">Last sign-in </span>
                  {geleden(a.laatstIngelogd)}
                </span>
                <span className="ka-mono ka-dim ka-alleen-breed" role="cell">
                  {datum(a.aangemaakt)}
                </span>
                <span className="ka-pijl" role="cell" aria-hidden>
                  →
                </span>
              </button>
            ))}
          </div>
        </section>

        {(data?.log.length ?? 0) > 0 && (
          <section className="ka-lijst">
            <div className="suite-divider" style={{ padding: "1rem 0 1.5rem" }}>
              <div className="suite-divider-line" />
              <span className="suite-divider-text">Recent admin activity</span>
              <div className="suite-divider-line" />
            </div>
            <ul className="ka-log">
              {data!.log.map((l, i) => (
                <li key={i}>
                  <span className="ka-mono ka-dim">{geleden(l.at)}</span>
                  <span>
                    {l.door_email ?? "Someone"} {ACTIE_TEKST[l.actie] ?? l.actie} <strong>{l.wie_email ?? "an account"}</strong>
                    {l.details && <span className="ka-dim"> · {l.details}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="suite-footer">
          <span className="suite-footer-logo">Korda™</span>
          <span className="suite-footer-copy">ADMIN · CHANGES ARE LOGGED</span>
        </footer>
      </div>

      {open && data && <Paneel account={open} ik={data.ik} onSluit={() => setOpenId(null)} />}
      {nieuw && <NieuwAccount onSluit={() => setNieuw(false)} onKlaar={() => qc.invalidateQueries({ queryKey: ["admin_accounts"] })} />}
    </div>
  );
}

function Initiaal({ a }: { a: Account }) {
  const letter = (a.naam ?? a.email).trim()[0]?.toUpperCase() ?? "?";
  return (
    <span className="ka-initiaal" aria-hidden>
      {letter}
    </span>
  );
}

function useActie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ ok: boolean; link?: string | null; code?: string | null }>({ method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_accounts"] }),
    onError: (e) => toast.error((e as Error).message),
  });
}

function Laag({ titel, onSluit, children }: { titel: ReactNode; onSluit: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onSluit();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onSluit]);
  return (
    <div className="ka-laag" role="dialog" aria-modal="true">
      <button type="button" className="ka-laag-achter" aria-label="Close" onClick={onSluit} />
      <aside className="ka-paneel">
        <div className="ka-paneel-kop">
          <div style={{ minWidth: 0 }}>{titel}</div>
          <button type="button" className="ka-sluit" onClick={onSluit} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ka-paneel-inhoud">{children}</div>
      </aside>
    </div>
  );
}

function Blok({ titel, children, gevaar }: { titel: string; children: ReactNode; gevaar?: boolean }) {
  return (
    <section className={`ka-blok ${gevaar ? "ka-blok-gevaar" : ""}`}>
      <p className="ka-label">{titel}</p>
      <div style={{ marginTop: "0.9rem" }}>{children}</div>
    </section>
  );
}

function Paneel({ account: a, ik, onSluit }: { account: Account; ik: string; onSluit: () => void }) {
  const actie = useActie();
  const zelf = a.id === ik;
  const [naam, setNaam] = useState(a.naam ?? "");
  const [email, setEmail] = useState(a.email);
  const [wachtwoord, setWachtwoord] = useState("");
  const [toon, setToon] = useState(false);
  const [link, setLink] = useState<{ link: string | null; code: string | null } | null>(null);
  const [bevestig, setBevestig] = useState("");

  useEffect(() => {
    setNaam(a.naam ?? "");
    setEmail(a.email);
  }, [a.naam, a.email]);

  const doe = (body: Record<string, unknown>, gelukt: string) =>
    actie.mutate({ userId: a.id, ...body }, { onSuccess: () => toast.success(gelukt) });

  const kopieer = async (tekst: string) => {
    try {
      await navigator.clipboard.writeText(tekst);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy; select it by hand");
    }
  };

  return (
    <Laag
      onSluit={onSluit}
      titel={
        <>
          <p className="ka-label">{zelf ? "Your account" : "Account"}</p>
          <p className="ka-paneel-naam">{a.naam ?? a.email.split("@")[0]}</p>
          <p className="ka-email" style={{ marginTop: "0.2rem" }}>
            {a.email}
          </p>
        </>
      }
    >
      <dl className="ka-feiten">
        <div>
          <dt>Joined</dt>
          <dd>{datum(a.aangemaakt)}</dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>{geleden(a.laatstIngelogd)}</dd>
        </div>
        <div>
          <dt>Signs in with</dt>
          <dd>{a.providers.length ? a.providers.join(", ") : "e-mail"}</dd>
        </div>
        <div>
          <dt>Budget households</dt>
          <dd>{a.huishoudens}</dd>
        </div>
      </dl>

      <Blok titel="App access">
        <ul className="ka-schakels">
          {OPEN_APPS.map((o) => (
            <li key={o.id} style={{ ["--c" as string]: o.c }}>
              <span className="ka-app-stip" />
              <span className="ka-schakel-naam">{o.naam}</span>
              <span className="ka-dim ka-mono">Open to all</span>
            </li>
          ))}
          {BEPERKT.map((b) => {
            const aan = a.apps.includes(b.id);
            return (
              <li key={b.id} style={{ ["--c" as string]: b.c }}>
                <span className="ka-app-stip" />
                <span className="ka-schakel-naam">Korda{b.naam}</span>
                <Schakel
                  aan={aan}
                  bezig={actie.isPending}
                  label={`${b.naam} ${aan ? "off" : "on"}`}
                  onChange={() => doe({ actie: "app", app: b.id, aan: !aan }, `${b.naam} ${aan ? "taken away" : "given"}`)}
                />
              </li>
            );
          })}
          <li style={{ ["--c" as string]: "232,230,225" }}>
            <span className="ka-app-stip" />
            <span className="ka-schakel-naam">
              Admin <span className="ka-dim">· manages accounts here</span>
            </span>
            <Schakel
              aan={a.admin}
              bezig={actie.isPending || (zelf && a.admin)}
              label={a.admin ? "Remove admin" : "Make admin"}
              onChange={() => doe({ actie: "admin", aan: !a.admin }, a.admin ? "No longer admin" : "Now admin")}
            />
          </li>
        </ul>
      </Blok>

      <Blok titel="Profile">
        <form
          className="ka-form-rij"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            doe({ actie: "naam", naam }, "Name saved");
          }}
        >
          <input className="ka-invoer" value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Display name" aria-label="Display name" />
          <button className="ka-knop" disabled={actie.isPending || naam === (a.naam ?? "")}>
            Save
          </button>
        </form>
        <form
          className="ka-form-rij"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            doe({ actie: "email", email }, "E-mail changed");
          }}
        >
          <input className="ka-invoer" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail address" />
          <button className="ka-knop" disabled={actie.isPending || email.trim().toLowerCase() === a.email.toLowerCase()}>
            Change
          </button>
        </form>
      </Blok>

      <Blok titel="Password">
        <form
          className="ka-form-rij"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            doe({ actie: "wachtwoord", wachtwoord }, "Password set");
          }}
        >
          <input
            className="ka-invoer ka-mono"
            type={toon ? "text" : "password"}
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            placeholder="New password (8+)"
            autoComplete="new-password"
            aria-label="New password"
            minLength={8}
            required
          />
          <button type="submit" className="ka-knop" disabled={actie.isPending || wachtwoord.length < 8}>
            Set
          </button>
        </form>
        <div className="ka-klein-rij">
          <button
            type="button"
            className="ka-tekstknop"
            onClick={() => {
              setWachtwoord(wachtwoordVoorstel());
              setToon(true);
            }}
          >
            Generate one
          </button>
          {wachtwoord && (
            <>
              <button type="button" className="ka-tekstknop" onClick={() => setToon((t) => !t)}>
                {toon ? "Hide" : "Show"}
              </button>
              <button type="button" className="ka-tekstknop" onClick={() => kopieer(wachtwoord)}>
                Copy
              </button>
            </>
          )}
        </div>
        <p className="ka-hint">They can keep signing in with a link by e-mail too; a password is optional.</p>
      </Blok>

      <Blok titel="Sign-in link">
        <p className="ka-hint" style={{ marginTop: 0 }}>
          A one-time link and code you pass on yourself, for when the mail doesn't arrive.
        </p>
        <button
          type="button"
          className="ka-knop"
          style={{ marginTop: "0.8rem" }}
          disabled={actie.isPending || a.geblokkeerd}
          onClick={() =>
            actie.mutate({ userId: a.id, actie: "link" }, { onSuccess: (r) => setLink({ link: r.link ?? null, code: r.code ?? null }) })
          }
        >
          Make a link
        </button>
        {link && (
          <div className="ka-link">
            {link.code && (
              <p>
                <span className="ka-label">Code</span> <span className="ka-mono ka-code">{link.code}</span>
                <button type="button" className="ka-tekstknop" onClick={() => kopieer(link.code!)}>
                  Copy
                </button>
              </p>
            )}
            {link.link && (
              <p>
                <span className="ka-label">Link</span>
                <button type="button" className="ka-tekstknop" onClick={() => kopieer(link.link!)}>
                  Copy link
                </button>
              </p>
            )}
            <p className="ka-hint">Works once, for about an hour.</p>
          </div>
        )}
      </Blok>

      {!zelf && (
        <Blok titel="Danger zone" gevaar>
          <div className="ka-klein-rij" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="ka-knop"
              disabled={actie.isPending}
              onClick={() => doe({ actie: a.geblokkeerd ? "deblokkeer" : "blokkeer" }, a.geblokkeerd ? "Unblocked" : "Blocked")}
            >
              {a.geblokkeerd ? "Unblock" : "Block sign-in"}
            </button>
          </div>
          <p className="ka-hint">Blocking stops new sign-ins and token refreshes; their data stays.</p>
          <form
            className="ka-form-rij"
            style={{ marginTop: "1.2rem" }}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              actie.mutate(
                { userId: a.id, actie: "verwijder", bevestig },
                {
                  onSuccess: () => {
                    toast.success("Account deleted");
                    onSluit();
                  },
                },
              );
            }}
          >
            <input
              className="ka-invoer"
              value={bevestig}
              onChange={(e) => setBevestig(e.target.value)}
              placeholder={`Type ${a.email} to delete`}
              aria-label="Type the e-mail address to confirm deleting"
            />
            <button
              className="ka-knop ka-knop-gevaar"
              disabled={actie.isPending || bevestig.trim().toLowerCase() !== a.email.toLowerCase()}
            >
              Delete
            </button>
          </form>
          <p className="ka-hint">Deleting removes the login for good. This can't be undone.</p>
        </Blok>
      )}
    </Laag>
  );
}

function Schakel({ aan, bezig, label, onChange }: { aan: boolean; bezig: boolean; label: string; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={aan} aria-label={label} disabled={bezig} onClick={onChange} className={`ka-schakel ${aan ? "ka-schakel-aan" : ""}`}>
      <span />
    </button>
  );
}

function NieuwAccount({ onSluit, onKlaar }: { onSluit: () => void; onKlaar: () => void }) {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [apps, setApps] = useState<BeperkteApp[]>([]);
  const maak = useMutation({
    mutationFn: () => api({ method: "POST", body: { actie: "maak", email, wachtwoord: wachtwoord || null, apps } }),
    onSuccess: () => {
      toast.success("Account created");
      onKlaar();
      onSluit();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Laag
      onSluit={onSluit}
      titel={
        <>
          <p className="ka-label">New account</p>
          <p className="ka-paneel-naam">Add someone</p>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          maak.mutate();
        }}
        className="ka-stapel"
      >
        <label className="ka-veld">
          <span className="ka-label">E-mail</span>
          <input className="ka-invoer" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="ka-veld">
          <span className="ka-label">Password (optional)</span>
          <span className="ka-form-rij" style={{ marginTop: 0 }}>
            <input className="ka-invoer ka-mono" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} placeholder="Leave empty: they sign in by link" />
            <button type="button" className="ka-knop" onClick={() => setWachtwoord(wachtwoordVoorstel())}>
              Generate
            </button>
          </span>
        </label>
        <div className="ka-veld">
          <span className="ka-label">Also give</span>
          <ul className="ka-schakels" style={{ marginTop: "0.6rem" }}>
            {BEPERKT.map((b) => {
              const aan = apps.includes(b.id);
              return (
                <li key={b.id} style={{ ["--c" as string]: b.c }}>
                  <span className="ka-app-stip" />
                  <span className="ka-schakel-naam">Korda{b.naam}</span>
                  <Schakel aan={aan} bezig={false} label={b.naam} onChange={() => setApps((x) => (aan ? x.filter((y) => y !== b.id) : [...x, b.id]))} />
                </li>
              );
            })}
          </ul>
        </div>
        <p className="ka-hint">Budget, Tracker and Trading are always included. No mail is sent; tell them to sign in at kordacore.com/budget/login.</p>
        <button className="ka-knop ka-knop-primair" disabled={maak.isPending}>
          Create account
        </button>
      </form>
    </Laag>
  );
}

// ─── styles: the suite's own (SuiteHome) plus the admin parts ────────────────

function useSuiteStijl() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.classList.add("suite-page");
    return () => {
      link.remove();
      style.remove();
      document.body.classList.remove("suite-page");
    };
  }, []);
}

const CSS = `
  body.suite-page { overflow: hidden; }
  .suite-portal { position: fixed; inset: 0; z-index: 50; overflow-y: auto; background: #080809; }
  .suite-root { min-height: 100vh; background: #080809; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; overflow-x: hidden; position: relative; }
  .suite-root *, .suite-root *::before, .suite-root *::after, .ka-laag *, .ka-laag *::before { box-sizing: border-box; }
  :where(.suite-root, .ka-laag) :where(p, h1, dl, dd, ul) { margin: 0; padding: 0; }
  .suite-noise { position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); opacity: .45; }
  .suite-orb { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; }
  .suite-orb-1 { width: 600px; height: 600px; top: -200px; left: -150px; background: radial-gradient(circle, rgba(0,184,148,0.05) 0%, transparent 70%); animation: orb-drift 18s ease-in-out infinite alternate; }
  .suite-orb-2 { width: 500px; height: 500px; bottom: -150px; right: -100px; background: radial-gradient(circle, rgba(109,107,240,0.07) 0%, transparent 70%); animation: orb-drift 22s ease-in-out infinite alternate-reverse; }
  @keyframes orb-drift { from { transform: translate(0,0) scale(1); } to { transform: translate(40px,30px) scale(1.1); } }
  .suite-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 40; display: flex; align-items: center; justify-content: space-between; padding: 1.4rem 4rem; border-bottom: 1px solid rgba(255,255,255,0.04); background: rgba(8,8,9,0.88); backdrop-filter: blur(20px); }
  .suite-nav-logo { font-family: 'Playfair Display', serif; font-size: 1.1rem; font-weight: 400; color: #e8e6e1; letter-spacing: 0.01em; }
  .suite-nav-logo sup { font-size: 0.5rem; color: rgba(232,230,225,0.3); vertical-align: super; margin-left: 1px; }
  .suite-nav-links { display: flex; gap: 2.5rem; align-items: center; }
  .suite-nav-links a { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(232,230,225,0.35); text-decoration: none; transition: color 0.2s; }
  .suite-nav-links a:hover { color: #e8e6e1; }
  .suite-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 0.65rem; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(232,230,225,0.25); margin: 0 0 1.4rem; display: flex; align-items: center; gap: 1rem; }
  .suite-eyebrow::before { content: ''; display: block; width: 24px; height: 1px; background: rgba(232,230,225,0.15); }
  .suite-h1 { font-family: 'Playfair Display', serif; font-size: clamp(2.6rem, 6vw, 4.6rem); font-weight: 400; line-height: 1.05; letter-spacing: -0.02em; margin: 0; }
  .suite-h1 em { font-style: italic; color: rgba(232,230,225,0.35); }
  .suite-sub { font-size: 0.98rem; font-weight: 300; line-height: 1.8; color: rgba(232,230,225,0.45); max-width: 560px; }
  .suite-divider { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 2rem; }
  .suite-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.04); }
  .suite-divider-text { font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(232,230,225,0.2); white-space: nowrap; }
  .suite-footer { position: relative; z-index: 1; border-top: 1px solid rgba(255,255,255,0.04); padding: 2.5rem 4rem; display: flex; align-items: center; justify-content: space-between; max-width: 1300px; margin: 3rem auto 0; }
  .suite-footer-logo { font-family: 'Playfair Display', serif; font-size: 0.9rem; color: rgba(232,230,225,0.3); }
  .suite-footer-copy { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(232,230,225,0.15); }
  @keyframes suite-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  .suite-anim-1 { animation: suite-fadeUp 0.6s ease both; }
  .suite-anim-2 { animation: suite-fadeUp 0.6s 0.08s ease both; }
  .suite-anim-3 { animation: suite-fadeUp 0.6s 0.16s ease both; }

  /* ─── admin ─── */
  .ka-kop, .ka-cijfers, .ka-lijst { position: relative; z-index: 1; max-width: 1300px; margin: 0 auto; padding-left: 4rem; padding-right: 4rem; }
  .ka-kop { padding-top: 8.5rem; padding-bottom: 2.5rem; }
  .ka-kop-rij { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
  .ka-label { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(232,230,225,0.35); }
  .ka-mono { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; }
  .ka-dim { color: rgba(232,230,225,0.3); }
  .ka-hint { margin-top: 0.7rem; font-size: 0.78rem; line-height: 1.6; color: rgba(232,230,225,0.35); }
  .ka-fout { color: #e8908a; font-size: 0.85rem; margin-bottom: 1rem; }

  .ka-cijfers { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 3px; padding-bottom: 2.5rem; }
  .ka-cijfer { --c: 232,230,225; position: relative; display: flex; flex-direction: column; gap: 0.8rem; padding: 1.4rem 1.4rem 1.3rem; background: #0e0e10; }
  .ka-cijfer::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: rgba(var(--c),0.55); }
  .ka-getal { font-family: 'Playfair Display', serif; font-size: 2.4rem; line-height: 1; color: #e8e6e1; font-variant-numeric: tabular-nums; }

  .ka-gereedschap { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .ka-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .ka-chip { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.8rem; border: 1px solid rgba(232,230,225,0.1); background: transparent; color: rgba(232,230,225,0.5); font: 400 0.74rem 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s; }
  .ka-chip:hover { border-color: rgba(232,230,225,0.25); color: #e8e6e1; }
  .ka-chip-aan { border-color: rgba(232,230,225,0.4); background: rgba(232,230,225,0.06); color: #e8e6e1; }
  .ka-chip-n { font-family: 'IBM Plex Mono', monospace; font-size: 0.62rem; color: rgba(232,230,225,0.35); }

  .ka-invoer { width: 100%; min-width: 0; height: 2.6rem; padding: 0 0.85rem; background: rgba(232,230,225,0.03); border: 1px solid rgba(232,230,225,0.12); color: #e8e6e1; font: 300 0.88rem 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s, background 0.2s; border-radius: 0; }
  .ka-invoer.ka-mono { font-family: 'IBM Plex Mono', monospace; font-size: 0.82rem; }
  .ka-invoer:focus { border-color: rgba(139,138,245,0.6); background: rgba(139,138,245,0.05); }
  .ka-invoer::placeholder { color: rgba(232,230,225,0.25); }
  .ka-zoek { max-width: 320px; }

  .ka-knop { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; height: 2.6rem; padding: 0 1.1rem; border: 1px solid rgba(232,230,225,0.18); background: rgba(232,230,225,0.04); color: #e8e6e1; font: 500 0.7rem 'IBM Plex Mono', monospace; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: background 0.2s, border-color 0.2s; }
  .ka-knop:hover:not(:disabled) { background: rgba(232,230,225,0.09); border-color: rgba(232,230,225,0.35); }
  .ka-knop:disabled { opacity: 0.35; cursor: not-allowed; }
  .ka-knop-primair { border-color: rgba(139,138,245,0.45); background: rgba(139,138,245,0.12); color: #d6d5ff; }
  .ka-knop-primair:hover:not(:disabled) { background: rgba(139,138,245,0.22); border-color: rgba(139,138,245,0.7); }
  .ka-knop-gevaar { border-color: rgba(232,110,100,0.4); background: rgba(232,110,100,0.08); color: #f0a49d; }
  .ka-knop-gevaar:hover:not(:disabled) { background: rgba(232,110,100,0.16); border-color: rgba(232,110,100,0.7); }
  .ka-tekstknop { background: none; border: 0; padding: 0; color: rgba(160,159,250,0.9); font: 400 0.78rem 'DM Sans', sans-serif; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: rgba(160,159,250,0.35); }

  .ka-tabel { display: flex; flex-direction: column; gap: 3px; }
  .ka-rij { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) 1.5rem; gap: 1.2rem; align-items: center; width: 100%; padding: 1rem 1.3rem; background: #0e0e10; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background 0.2s; }
  .ka-rij:hover:not(.ka-rij-kop), .ka-rij:focus-visible { background: #141417; outline: none; }
  .ka-rij-kop { background: transparent; cursor: default; padding-top: 0.4rem; padding-bottom: 0.4rem; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(232,230,225,0.25); }
  .ka-wie { display: flex; align-items: center; gap: 0.9rem; min-width: 0; }
  .ka-initiaal { flex-shrink: 0; width: 2.3rem; height: 2.3rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(232,230,225,0.14); font-family: 'Playfair Display', serif; font-size: 1.05rem; color: rgba(232,230,225,0.75); }
  .ka-naam { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; font-size: 0.95rem; font-weight: 400; color: #e8e6e1; }
  .ka-email { display: block; font-size: 0.78rem; color: rgba(232,230,225,0.4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ka-badge { font-family: 'IBM Plex Mono', monospace; font-size: 0.55rem; letter-spacing: 0.14em; text-transform: uppercase; padding: 0.15rem 0.45rem; border: 1px solid rgba(139,138,245,0.35); color: rgba(180,179,255,0.9); }
  .ka-badge-rood { border-color: rgba(232,110,100,0.4); color: #f0a49d; }
  .ka-badge-dim { border-color: rgba(232,230,225,0.15); color: rgba(232,230,225,0.4); }
  .ka-apps { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .ka-app { --c: 232,230,225; font-family: 'IBM Plex Mono', monospace; font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.2rem 0.5rem; border: 1px solid rgba(var(--c),0.3); background: rgba(var(--c),0.06); color: rgba(var(--c),0.95); }
  .ka-apps .ka-dim { font-size: 0.78rem; }
  .ka-pijl { color: rgba(232,230,225,0.25); transition: transform 0.2s, color 0.2s; }
  .ka-rij:hover .ka-pijl { transform: translateX(4px); color: #e8e6e1; }
  .ka-mob-label { display: none; }
  .ka-leeg { padding: 2rem 1.3rem; color: rgba(232,230,225,0.35); font-size: 0.9rem; background: #0e0e10; }

  .ka-log { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
  .ka-log li { display: grid; grid-template-columns: 7rem 1fr; gap: 1rem; padding: 0.75rem 1.3rem; background: #0b0b0d; font-size: 0.83rem; color: rgba(232,230,225,0.6); }
  .ka-log strong { font-weight: 400; color: #e8e6e1; }

  .ka-laag { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; color: #e8e6e1; font-family: 'DM Sans', sans-serif; font-weight: 300; }
  .ka-laag-achter { position: absolute; inset: 0; border: 0; background: rgba(4,4,5,0.72); backdrop-filter: blur(4px); cursor: default; animation: ka-in 0.25s ease both; }
  .ka-paneel { position: relative; width: min(520px, 100%); height: 100%; display: flex; flex-direction: column; background: #0c0c0e; border-left: 1px solid rgba(255,255,255,0.06); animation: ka-schuif 0.35s cubic-bezier(0.16,1,0.3,1) both; }
  .ka-paneel::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(to right, transparent, rgba(139,138,245,0.7), transparent); }
  @keyframes ka-in { from { opacity: 0; } }
  @keyframes ka-schuif { from { transform: translateX(40px); opacity: 0; } }
  .ka-paneel-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 2rem 2rem 1.4rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .ka-paneel-naam { margin-top: 0.6rem; font-family: 'Playfair Display', serif; font-size: 2rem; line-height: 1.05; overflow-wrap: anywhere; }
  .ka-sluit { width: 2.4rem; height: 2.4rem; flex-shrink: 0; border: 1px solid rgba(232,230,225,0.14); background: transparent; color: rgba(232,230,225,0.6); font-size: 1.3rem; line-height: 1; cursor: pointer; }
  .ka-sluit:hover { color: #e8e6e1; border-color: rgba(232,230,225,0.35); }
  .ka-paneel-inhoud { flex: 1; overflow-y: auto; padding: 1.5rem 2rem calc(2.5rem + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 3px; }
  .ka-feiten { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem 1.5rem; margin: 0 0 1.5rem; }
  .ka-feiten dt { font-family: 'IBM Plex Mono', monospace; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(232,230,225,0.3); }
  .ka-feiten dd { margin: 0.3rem 0 0; font-size: 0.9rem; color: #e8e6e1; }
  .ka-blok { padding: 1.3rem 1.3rem 1.4rem; background: #111114; }
  .ka-blok-gevaar { background: #140f0f; }
  .ka-blok-gevaar > .ka-label { color: rgba(240,164,157,0.7); }
  .ka-schakels { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
  .ka-schakels li { --c: 232,230,225; display: flex; align-items: center; gap: 0.8rem; min-height: 2.9rem; border-top: 1px solid rgba(255,255,255,0.04); }
  .ka-schakels li:first-child { border-top: 0; }
  .ka-app-stip { width: 6px; height: 6px; border-radius: 50%; background: rgba(var(--c),0.85); flex-shrink: 0; }
  .ka-schakel-naam { flex: 1; font-size: 0.9rem; }
  .ka-schakel { position: relative; width: 2.6rem; height: 1.45rem; flex-shrink: 0; border: 1px solid rgba(232,230,225,0.2); background: rgba(232,230,225,0.04); cursor: pointer; transition: background 0.2s, border-color 0.2s; padding: 0; }
  .ka-schakel span { position: absolute; top: 2px; left: 2px; width: calc(1.45rem - 6px); height: calc(1.45rem - 6px); background: rgba(232,230,225,0.45); transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.2s; }
  .ka-schakel-aan { background: rgba(var(--c),0.25); border-color: rgba(var(--c),0.7); }
  .ka-schakel-aan span { transform: translateX(1.15rem); background: rgb(var(--c)); }
  .ka-schakel:disabled { opacity: 0.4; cursor: not-allowed; }
  .ka-form-rij { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
  .ka-form-rij:first-child { margin-top: 0; }
  .ka-klein-rij { display: flex; flex-wrap: wrap; gap: 1.1rem; margin-top: 0.7rem; }
  .ka-link { margin-top: 1rem; padding: 1rem; border: 1px dashed rgba(139,138,245,0.35); display: flex; flex-direction: column; gap: 0.6rem; }
  .ka-link p { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .ka-code { font-size: 1.15rem; letter-spacing: 0.25em; color: #e8e6e1; }
  .ka-stapel { display: flex; flex-direction: column; gap: 1.3rem; }
  .ka-veld { display: flex; flex-direction: column; gap: 0.5rem; }

  @media (prefers-reduced-motion: reduce) {
    .suite-anim-1, .suite-anim-2, .suite-anim-3, .suite-orb, .ka-paneel, .ka-laag-achter { animation: none; }
  }
  @media (max-width: 900px) {
    .suite-nav { padding: 1rem; }
    .suite-nav-links { gap: 1.25rem; }
    .ka-kop, .ka-cijfers, .ka-lijst { padding-left: 1rem; padding-right: 1rem; }
    .ka-kop { padding-top: 6.5rem; padding-bottom: 1.8rem; }
    .ka-cijfers { grid-template-columns: 1fr 1fr; }
    .ka-getal { font-size: 1.9rem; }
    .ka-zoek { max-width: none; }
    .ka-filters { flex-wrap: nowrap; overflow-x: auto; width: 100%; padding-bottom: 2px; scrollbar-width: none; }
    .ka-chip { flex-shrink: 0; }
    .ka-rij-kop { display: none; }
    .ka-rij { grid-template-columns: minmax(0, 1fr) 1.2rem; gap: 0.6rem 0.8rem; padding: 1rem; }
    .ka-wie { grid-column: 1; }
    .ka-pijl { grid-column: 2; grid-row: 1; }
    .ka-apps, .ka-rij > .ka-mono { grid-column: 1 / -1; padding-left: 3.2rem; }
    .ka-alleen-breed { display: none; }
    .ka-mob-label { display: inline; color: rgba(232,230,225,0.3); }
    .ka-log li { grid-template-columns: 1fr; gap: 0.2rem; padding: 0.75rem 1rem; }
    .ka-paneel { width: 100%; }
    .ka-paneel-kop { padding: 1.4rem 1rem 1.1rem; }
    .ka-paneel-inhoud { padding: 1.1rem 1rem calc(2rem + env(safe-area-inset-bottom)); }
    .ka-paneel-naam { font-size: 1.7rem; }
    .suite-footer { padding: 2rem 1rem; }
  }
`;
