// Decorative background shared by the login and dashboard pages.
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-backdrop absolute inset-0" />

      <div className="animate-glow-drift absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-maroon/45 blur-[130px]" />
      <div
        className="animate-glow-drift absolute -bottom-52 -right-40 h-[32rem] w-[32rem] rounded-full bg-orange/25 blur-[130px]"
        style={{ animationDelay: "-7s" }}
      />

      {/* Livery-style racing stripes */}
      <div className="absolute -bottom-10 -left-32 flex h-[140%] origin-bottom-left rotate-[28deg] gap-3 opacity-[0.09]">
        <div className="w-10 bg-orange" />
        <div className="w-4 bg-maroon-bright" />
        <div className="w-1.5 bg-orange" />
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange/40 to-transparent" />
    </div>
  );
}
