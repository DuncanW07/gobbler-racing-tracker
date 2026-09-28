// Decorative background shared by the login and dashboard pages.
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-70" />

      <div className="animate-glow-drift absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-maroon/40 blur-[130px]" />
      <div
        className="animate-glow-drift absolute -bottom-52 -right-40 h-[32rem] w-[32rem] rounded-full bg-orange/20 blur-[130px]"
        style={{ animationDelay: "-7s" }}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange/40 to-transparent" />
    </div>
  );
}
