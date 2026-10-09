import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s) throw new Error('UNSUBSCRIBE_SECRET non configurato');
  return s;
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(userId).digest('base64url');
}

export function unsubscribeLink(baseUrl: string, userId: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/unsubscribe?u=${encodeURIComponent(userId)}&sig=${sign(userId)}`;
}

export function verifyUnsubscribeToken(userId: string, sig: string): boolean {
  try {
    const expected = Buffer.from(sign(userId));
    const given = Buffer.from(sig);
    if (expected.length !== given.length) return false;
    return timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}
