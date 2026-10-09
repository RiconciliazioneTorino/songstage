import Link from 'next/link';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type Status =
  | { kind: 'ok'; email: string | null; alreadyOff: boolean }
  | { kind: 'invalid' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string };

async function unsubscribe(userId: string): Promise<Status> {
  // `email_notifications` was added in migration 0010; the generated types may
  // not include it yet, so we talk to the users table through `any` here.
  const supabase = createServiceClient() as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string
        ) => {
          maybeSingle: () => Promise<{
            data: { email: string | null; email_notifications: boolean } | null;
            error: { message: string } | null;
          }>;
        };
      };
      update: (patch: Record<string, unknown>) => {
        eq: (
          k: string,
          v: string
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { data: existing, error: readErr } = await supabase
    .from('users')
    .select('email, email_notifications')
    .eq('id', userId)
    .maybeSingle();
  if (readErr) return { kind: 'error', message: readErr.message };
  if (!existing) return { kind: 'notfound' };
  if (existing.email_notifications === false) {
    return { kind: 'ok', email: existing.email, alreadyOff: true };
  }
  const { error: updateErr } = await supabase
    .from('users')
    .update({ email_notifications: false })
    .eq('id', userId);
  if (updateErr) return { kind: 'error', message: updateErr.message };
  return { kind: 'ok', email: existing.email, alreadyOff: false };
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; sig?: string }>;
}) {
  const { u, sig } = await searchParams;

  let status: Status;
  if (!u || !sig || !verifyUnsubscribeToken(u, sig)) {
    status = { kind: 'invalid' };
  } else {
    try {
      status = await unsubscribe(u);
    } catch (e) {
      status = { kind: 'error', message: (e as Error).message };
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:p-8 max-w-xl mx-auto">
      <div className="mt-10 rounded-lg border border-border bg-panel p-6 space-y-3">
        <div className="text-xs uppercase tracking-wide text-zinc-500">
          SongStage
        </div>
        {status.kind === 'ok' && !status.alreadyOff && (
          <>
            <h1 className="text-2xl font-semibold">
              Disiscrizione completata
            </h1>
            <p className="text-sm text-zinc-300">
              Non riceverai più email di aggiornamento sui rilasci
              {status.email ? (
                <> all&apos;indirizzo <strong>{status.email}</strong></>
              ) : null}
              . Le email di servizio (inviti, accesso) continueranno ad
              arrivare.
            </p>
          </>
        )}
        {status.kind === 'ok' && status.alreadyOff && (
          <>
            <h1 className="text-2xl font-semibold">Già disiscritto</h1>
            <p className="text-sm text-zinc-300">
              L&apos;indirizzo{' '}
              {status.email ? <strong>{status.email}</strong> : 'associato'} è
              già fuori dalla lista. Nessun cambiamento necessario.
            </p>
          </>
        )}
        {status.kind === 'invalid' && (
          <>
            <h1 className="text-2xl font-semibold">Link non valido</h1>
            <p className="text-sm text-zinc-300">
              Il link di disiscrizione è malformato o scaduto. Scrivimi a{' '}
              <a
                href="mailto:torres.federico@gmail.com"
                className="text-accent hover:underline"
              >
                torres.federico@gmail.com
              </a>{' '}
              e ti rimuovo manualmente.
            </p>
          </>
        )}
        {status.kind === 'notfound' && (
          <>
            <h1 className="text-2xl font-semibold">Utente non trovato</h1>
            <p className="text-sm text-zinc-300">
              Non trovo l&apos;account associato a questo link. Potrebbe
              essere stato eliminato.
            </p>
          </>
        )}
        {status.kind === 'error' && (
          <>
            <h1 className="text-2xl font-semibold">Qualcosa è andato storto</h1>
            <p className="text-sm text-zinc-300">
              Riprova fra qualche minuto. Se continua a fallire, scrivimi a{' '}
              <a
                href="mailto:torres.federico@gmail.com"
                className="text-accent hover:underline"
              >
                torres.federico@gmail.com
              </a>
              .
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Dettaglio tecnico: {status.message}
            </p>
          </>
        )}
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="text-sm text-accent hover:underline"
          >
            Vai alla dashboard →
          </Link>
        </div>
      </div>
    </main>
  );
}
