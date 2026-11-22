// Shown for a split second while the signed-in part of a page loads.
export function PageLoading() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <span className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">ZMC</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="h-4 w-40 rounded bg-line" />
        <div className="h-28 rounded-2xl border border-line bg-card" />
        <div className="h-20 rounded-2xl border border-line bg-card" />
        <span className="sr-only">Loading…</span>
      </main>
    </div>
  );
}
