// scripts/shoot.mjs
//
// Screenshots the app so Claude can actually look at it.
//
// Every page in these sections was built without anyone seeing it render —
// reviews happened by the user screenshotting things by hand, which caught the
// obvious breakage (unstyled buttons) and missed the rest (a table that was
// unreadable at eight rows, mono set too small to read). This closes that loop.
//
//   npm run shoot                      every page in every section
//   npm run shoot -- tracker           one section
//   npm run shoot -- /outreach/usage   one page
//   npm run shoot -- tracker --mobile  at 390x844 instead of desktop
//   BASE=http://localhost:8080 npm run shoot
//
// Credentials come from .env.local, which is gitignored. They are never printed,
// and the saved session goes to a gitignored file too — so running this does not
// put anything secret anywhere it can be committed or pasted.

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';
import { config as loadEnv } from 'dotenv';

// .env.local explicitly — dotenv's default entry point only reads `.env`, and
// Vite's convention (which this repo follows, and .gitignore already covers) is
// that local secrets live in `.env.local`.
loadEnv({ path: '.env.local' });
loadEnv();

const BASE = (process.env.BASE ?? 'https://kordacore.com').replace(/\/$/, '');
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const OUT = 'screenshots';
const SESSION = '.playwright-session.json';

/** Default sweep, per section. Ordered the way you'd actually review each. */
const SECTIONS = {
  outreach: [
    '/outreach/leads',
    '/outreach/niches',
    '/outreach/campaigns',
    '/outreach/messages',
    '/outreach/analytics',
    '/outreach/usage',
    '/outreach/senders',
    '/outreach/suppression',
    '/outreach/settings',
    '/outreach/runs',
  ],
  tracker: [
    '/tracker/dashboard',
    '/tracker/graph',
    '/tracker/progress',
    '/tracker/journal',
    '/tracker/photos',
    '/tracker/analysis',
    '/tracker/strava',
    '/tracker/settings',
  ],
};
const SECTION_NAMES = Object.keys(SECTIONS);
const ALL_PAGES = SECTION_NAMES.flatMap(k => SECTIONS[k]);

/** The two sections have separate layouts, so the readiness selectors differ. */
const READY = '.o-main, .kt-main';
const CONTENT = '.o-panel, .o-state, .kt-card, table';

/** Mobile matters for the tracker specifically — its bottom nav and grid
 *  collapse below 768px, and that layout has never been reviewed. */
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/**
 * Normalise a path argument.
 *
 * Git Bash rewrites a leading "/" into a Windows path before Node ever sees it,
 * so `npm run shoot -- /outreach/usage` arrives as
 * "C:/Program Files/Git/outreach/usage". Recover the tail rather than making
 * the caller remember to escape it.
 */
const normalise = (arg) => {
  // Recover the tail at the first known section name. Done by string search
  // rather than a regex: the pattern needs a literal backslash inside a
  // character class, and threading that through a template literal collapses
  // it to `[/\]`, which is an unterminated class.
  for (const name of SECTION_NAMES) {
    const i = arg.indexOf(`/${name}/`);
    if (i > 0) return arg.slice(i);
  }
  return arg.startsWith('/') ? arg : `/${arg}`;
};

const rawArgs = process.argv.slice(2);
const mobile = rawArgs.includes('--mobile');
const viewport = mobile ? MOBILE : DESKTOP;
const pathArgs = rawArgs.filter(a => !a.startsWith('--'));

// A bare section name expands to that whole section; anything else is a path.
const targets = pathArgs.length
  ? pathArgs.flatMap(a => (SECTION_NAMES.includes(a) ? SECTIONS[a] : [normalise(a)]))
  : ALL_PAGES;

if (!EMAIL || !PASSWORD) {
  console.error(
    'Missing E2E_EMAIL / E2E_PASSWORD.\n' +
    'Put them in .env.local (already gitignored):\n\n' +
    '  E2E_EMAIL=you@example.com\n' +
    '  E2E_PASSWORD=…\n',
  );
  process.exit(1);
}

/** Log in once and keep the session, so later runs skip straight to shooting. */
async function login(browser) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');

  // Supabase auth is a network round trip and then a client-side redirect, so
  // wait for the app rather than for navigation — the URL can change before the
  // session is actually usable.
  try {
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  } catch {
    // A wrong password leaves you on /login with a toast; say so plainly rather
    // than letting every subsequent page shoot a login screen.
    const message = await page.locator('[data-sonner-toast], .text-destructive').first()
      .textContent().catch(() => null);
    throw new Error(`Login failed${message ? `: ${message.trim()}` : ' — still on /login'}`);
  }

  await context.storageState({ path: SESSION });
  await page.close();
  return context;
}

async function shoot(context, path) {
  const page = await context.newPage();
  const name = (path.replace(/^\//, '').replace(/\//g, '_') || 'root') + (mobile ? '_mobile' : '');

  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });

  // Content arrives from React Query after mount, so waiting on the network is
  // unreliable (some pages poll). Wait for the section chrome, then for either
  // real content or an empty state — both are legitimate things to photograph.
  await page.waitForSelector(READY, { timeout: 20_000 });
  await page.waitForSelector(CONTENT, { timeout: 20_000 }).catch(() => {});
  // Charts animate in; a short settle avoids catching them mid-transition.
  await page.waitForTimeout(1200);

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  ${name}.png`);
  await page.close();
}

const browser = await chromium.launch();
try {
  // Only clear what this run will rewrite. Wiping the whole directory meant a
  // desktop sweep followed by `--mobile` destroyed the desktop set.
  mkdirSync(OUT, { recursive: true });
  for (const p of targets) {
    const n = (p.replace(/^\//, '').replace(/\//g, '_') || 'root') + (mobile ? '_mobile' : '');
    rmSync(`${OUT}/${n}.png`, { force: true });
  }

  const context = existsSync(SESSION)
    ? await browser.newContext({ storageState: SESSION, viewport })
    : await login(browser);

  console.log(`Shooting ${targets.length} page(s) at ${BASE} (${viewport.width}x${viewport.height})`);
  for (const path of targets) {
    try {
      await shoot(context, path);
    } catch (e) {
      // One bad page should not cost the whole sweep.
      console.error(`  ${path} FAILED: ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`\nWritten to ${OUT}/`);
} finally {
  await browser.close();
}
