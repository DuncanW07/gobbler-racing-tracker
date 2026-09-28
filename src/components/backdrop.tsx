// Decorative background shared by the login and dashboard pages.
// Glows are plain gradients (no blur filter). They only drift on computers.
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-70" />

      <div className="glow-maroon animate-glow-drift absolute -left-72 -top-72 h-[52rem] w-[52rem] rounded-full" />
      <div
        className="glow-orange animate-glow-drift absolute -bottom-80 -right-72 h-[50rem] w-[50rem] rounded-full"
        style={{ animationDelay: "-7s" }}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange/40 to-transparent" />
    </div>
  );
}
