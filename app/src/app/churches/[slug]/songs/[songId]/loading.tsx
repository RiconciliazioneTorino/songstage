export default function Loading() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto p-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-zinc-800 rounded" />
          <div className="h-8 w-28 bg-zinc-800 rounded-full" />
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-8 w-2/3 bg-zinc-800 rounded" />
          <div className="h-4 w-1/3 bg-zinc-800/60 rounded" />
        </div>
        <div className="mt-6 rounded-md border border-border bg-panel p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-zinc-800/50 rounded"
              style={{ width: `${60 + ((i * 7) % 35)}%` }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
