export function ListSkeleton({
  title,
  rows = 8,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto animate-pulse">
      <div className="h-4 w-24 bg-zinc-800 rounded" />
      <header className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-zinc-100">{title}</h1>
        <div className="h-8 w-24 bg-zinc-800 rounded-full" />
      </header>

      <div className="rounded-md border border-border bg-panel p-3 space-y-2">
        <div className="h-9 w-full bg-zinc-800 rounded-md" />
        <div className="flex gap-2">
          <div className="h-9 flex-1 bg-zinc-800 rounded-md" />
          <div className="h-9 w-28 bg-zinc-800 rounded-md" />
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-md border border-border bg-panel p-3 flex items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-4 w-2/3 bg-zinc-800 rounded" />
              <div className="h-3 w-1/3 bg-zinc-800/60 rounded" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-14 bg-zinc-800 rounded-full" />
              <div className="h-5 w-10 bg-zinc-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
