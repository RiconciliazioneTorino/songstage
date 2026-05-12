import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold mb-4">SongStage</h1>
        <p className="text-zinc-400 mb-8">
          Proiezione e arrangiamenti di canti di adorazione per chiese.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-accent text-accent hover:bg-accent/10 transition"
          >
            Accedi
          </Link>
        </div>
      </div>
    </main>
  );
}
