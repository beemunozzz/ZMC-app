export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center gap-2 border-b border-line px-4">
        <span className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">ZMC</span>
        <span className="font-display text-xl font-bold uppercase tracking-wide text-muted">Hub</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rise rounded-2xl border border-line bg-card p-6">
          <div className="mb-4 h-1.5 w-12 rounded-full bg-tape" aria-hidden />
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink">
            Hello ZMC
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            The new ZMC Hub is up and running. Jobs, crew schedules, quotes and invoices will
            show up here as we build them.
          </p>
          <a
            href="tel:+12093265601"
            className="press mt-6 flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-white dark:text-navy"
          >
            Call Zach: (209) 326-5601
          </a>
        </div>
        <p className="mt-6 text-center text-sm text-muted">Don&apos;t break your back, call Zach!</p>
      </main>
    </div>
  );
}
