const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const DEFAULT_FROM = 'SongStage <noreply@songstage.riconciliazionetorino.net>';

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export type SendMailResult = {
  /** Resend's message id. Present only when the message was really accepted. */
  id?: string;
  error?: string;
};

/** Escape user-supplied text before interpolating it into an email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email to', input.to);
    return { error: 'Invio email non configurato (RESEND_API_KEY mancante).' };
  }

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from ?? DEFAULT_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
  } catch (e) {
    console.error('[resend] request failed', e);
    return { error: 'Il servizio email non risponde.' };
  }

  const payload = await res.json().catch(() => null) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!res.ok) {
    console.error('[resend] send failed', res.status, payload);
    const detail = payload?.message ? `: ${payload.message}` : '';
    return { error: `Il servizio email ha rifiutato il messaggio (${res.status})${detail}` };
  }

  // A 2xx without an id means Resend accepted the request but queued nothing we
  // can point at — treat it as a failure rather than reporting success.
  if (!payload?.id) {
    console.error('[resend] accepted but no message id', res.status, payload);
    return { error: 'Il servizio email non ha confermato l\'invio.' };
  }

  return { id: payload.id };
}
