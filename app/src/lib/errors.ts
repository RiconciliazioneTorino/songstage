/**
 * Turn a Postgres/PostgREST error into something a musician can read.
 *
 * Almost every write in this app is authorised by RLS rather than by an
 * explicit check in the action, so the raw failure a user hits is usually
 * `new row violates row-level security policy for table "songs"`. Returning
 * `error.message` straight to the UI leaks schema details and says nothing
 * useful in an Italian interface.
 */

type MaybePostgrestError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null | undefined;

const BY_CODE: Record<string, string> = {
  // insufficient_privilege / RLS rejection
  '42501': 'Non hai i permessi per questa operazione.',
  // unique_violation
  '23505': 'Esiste già un elemento con questi dati.',
  // foreign_key_violation
  '23503': 'Operazione non possibile: ci sono ancora riferimenti collegati.',
  // not_null_violation
  '23502': 'Manca un campo obbligatorio.',
  // check_violation
  '23514': 'I dati non rispettano i vincoli previsti.',
  // PostgREST: no rows returned where one was expected
  PGRST116: 'Elemento non trovato o non accessibile.',
};

const FALLBACK = 'Qualcosa è andato storto. Riprova.';

export function friendlyError(error: MaybePostgrestError, fallback = FALLBACK): string {
  if (!error) return fallback;

  const code = error.code ?? '';
  if (code && BY_CODE[code]) return BY_CODE[code];

  // RLS denials don't always carry 42501 — PostgREST reports some of them as
  // plain messages.
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return BY_CODE['42501'];
  }
  if (message.includes('duplicate key')) return BY_CODE['23505'];
  if (message.includes('violates foreign key')) return BY_CODE['23503'];

  return fallback;
}
