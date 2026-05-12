'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setStatus('error');
      setError(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-bold">Accedi</h1>
        <p className="text-zinc-400 text-sm">Ti inviamo un link magico via email.</p>
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
          disabled={status === 'sending'}
          className="w-full px-4 py-2 rounded-md border border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {status === 'sending' ? 'Invio…' : 'Invia link'}
        </button>
        {status === 'sent' && (
          <p className="text-sm text-accent">Controlla la tua email — ti è arrivato un link per entrare.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400">{error}</p>
        )}
      </form>
    </main>
  );
}
