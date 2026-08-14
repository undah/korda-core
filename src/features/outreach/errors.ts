// src/features/outreach/errors.ts

/**
 * Turn anything thrown into something worth showing a user.
 *
 * The reason this exists: supabase-js does not throw `Error` instances.
 * PostgrestError is a plain object — `{ message, details, hint, code }` — so
 * the obvious `e instanceof Error ? e.message : 'fallback'` is false for every
 * database failure, and the console showed a generic "could not do that" while
 * the actual cause (a missing table, an RLS denial, a constraint violation)
 * was sitting right there in the object.
 *
 * `hint` is included when PostgREST provides one, because for the errors that
 * matter here — a migration that has not been applied — the hint is the fix.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object') {
    const e = error as { message?: unknown; hint?: unknown; details?: unknown; code?: unknown };
    const message = typeof e.message === 'string' ? e.message : '';
    const hint = typeof e.hint === 'string' ? e.hint : '';
    const details = typeof e.details === 'string' ? e.details : '';

    const parts = [message || details, hint].filter(Boolean);
    if (parts.length) {
      // PGRST205 is "table not found in schema cache", which in this project has
      // meant one thing every time: a migration in supabase/ was never run.
      const suffix = e.code === 'PGRST205' || /does not exist/i.test(message)
        ? ' — a migration in supabase/ may not have been applied yet.'
        : '';
      return parts.join(' ') + suffix;
    }
  }

  return fallback;
}
