// Page title. The intro animation is run by <IntroStage>, which looks for the
// data-split (title lines) and data-reveal (single rows) markers below.
export function HeroHeader() {
  return (
    <header className="text-center">
      <div className="mb-6 overflow-clip">
        <div
          data-reveal="label"
          className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-orange shadow-[0_0_12px_rgba(229,117,31,0.9)]" />
          Secure team access
        </div>
      </div>

      <h1
        data-split
        className="hero-title text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl"
      >
        <span className="block text-white">Gobbler Racing</span>
        <span className="block">
          <span className="bg-linear-to-r from-orange-bright via-orange to-maroon-bright bg-clip-text text-transparent">
            Consumables Tracker
          </span>
        </span>
      </h1>

      <div className="mt-5 overflow-clip">
        <div data-reveal="subtitle" className="flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-linear-to-r from-transparent to-maroon-bright" />
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-200">
            Virginia Tech
          </p>
          <span className="h-px w-10 bg-linear-to-l from-transparent to-maroon-bright" />
        </div>
      </div>
    </header>
  );
}
