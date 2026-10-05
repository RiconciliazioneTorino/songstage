export default function Loading() {
  return (
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto p-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-zinc-800 rounded" />
          <div className="flex gap-2">
            <div className="h-8 w-24 bg-zinc-800 rounded-full" />
            <div className="h-8 w-24 bg-zinc-800 rounded-full" />
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-8 w-1/2 bg-zinc-800 rounded" />
          <div className="h-4 w-1/4 bg-zinc-800/60 rounded" />
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-panel p-3 flex items-center gap-3"
            >
              <div className="h-5 w-6 bg-zinc-800 rounded" />
              <div className="flex-1 h-4 bg-zinc-800 rounded" />
              <div className="h-5 w-10 bg-zinc-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
