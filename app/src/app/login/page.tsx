'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setStep('code');
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
            Ti abbiamo mandato un codice a <span className="text-white">{email}</span>.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="12345678"
            className="w-full px-3 py-2 rounded-md bg-panel border border-border focus:border-accent outline-none text-center text-2xl tracking-[0.4em] font-mono"
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
