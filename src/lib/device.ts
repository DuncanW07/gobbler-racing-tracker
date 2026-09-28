// One definition of "computer" (laptop/PC) vs "phone/tablet", used everywhere.
// The deciding check is the main input: mouse/trackpad vs touch. Touchscreen
// laptops still count as computers because their main input is the trackpad.
// Keep in sync with the @media query in globals.css.
export const COMPUTER_QUERY = "(pointer: fine) and (hover: hover) and (min-width: 1024px)";

export function isComputer(): boolean {
  return typeof window !== "undefined" && window.matchMedia(COMPUTER_QUERY).matches;
}

// The 3D car also needs WebGL2.
export function canShow3D(): boolean {
  if (!isComputer()) return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
