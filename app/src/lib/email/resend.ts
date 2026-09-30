const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const DEFAULT_FROM = 'SongStage <noreply@songstage.riconciliazionetorino.net>';

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendMail(input: SendMailInput): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[resend] RESEND_API_KEY not set — skipping email to', input.to);
    return { error: 'RESEND_API_KEY non configurato' };
  }
  const res = await fetch(RESEND_ENDPOINT, {
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
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[resend] send failed', res.status, text);
    return { error: `Resend ${res.status}` };
  }
  return {};
}
