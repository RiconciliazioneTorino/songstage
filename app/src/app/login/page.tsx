'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center p-8">
          <div className="text-zinc-500 text-sm">Caricamento…</div>
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(prefilledEmail);
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const autoSentRef = useRef(false);

  async function submitSendCode(targetEmail: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('code');
  }

  // If cookies were dropped (e.g. iOS PWA cold start) but localStorage still
  // holds the session, createClient() rehydrates cookies; getSession then
  // sees a valid session and we can skip the login form entirely.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }
      setCheckingSession(false);
      // Auto-send code if the invite link pre-filled ?email=...
      if (prefilledEmail && !autoSentRef.current) {
        autoSentRef.current = true;
        submitSendCode(prefilledEmail);
      }
    });
  }, [router, prefilledEmail]);

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-zinc-500 text-sm">Caricamento…</div>
      </main>
    );
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    await submitSendCode(email);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      {step === 'email' ? (
        <form onSubmit={sendCode} className="w-full max-w-sm space-y-4">
          <h1 className="text-3xl font-bold">Accedi</h1>
          <p className="text-zinc-400 text-sm">
            Ti inviamo un codice via email.
          </p>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tua@email.com"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {busy ? 'Invio…' : 'Invia codice'}
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="w-full max-w-sm space-y-4">
          <h1 className="text-3xl font-bold">Inserisci il codice</h1>
          <p className="text-zinc-400 text-sm">
            Ti abbiamo mandato un codice a 6 cifre a <span className="text-white">{email}</span>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-center text-2xl tracking-[0.5em] font-mono"
          />
          <button
            type="submit"
            disabled={busy || token.length < 6}
            className="w-full px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {busy ? 'Verifica…' : 'Entra'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setToken('');
              setError(null);
            }}
            className="w-full text-sm text-zinc-400 hover:text-white"
          >
            ← Cambia email
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  );
}
