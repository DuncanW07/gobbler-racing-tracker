"use client";

import { useEffect, useRef } from "react";
import { animate, splitText, stagger, utils } from "animejs";

// Page title. Each line slides up out of a clipped row, once, on load.
export function HeroHeader() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.dataset.intro = "done";
      return;
    }

    const title = root.querySelector<HTMLElement>("[data-split]")!;
    const label = root.querySelector<HTMLElement>("[data-reveal='label']")!;
    const subtitle = root.querySelector<HTMLElement>("[data-reveal='subtitle']")!;
    const splitter = splitText(title, { lines: { wrap: "clip" } });
    let played = false;

    // addEffect runs once the lines exist (after fonts load), and again whenever
    // the lines are re-split on resize. Only the first run animates.
    splitter.addEffect(({ lines }: { lines: HTMLElement[] }) => {
      if (played) return;
      played = true;
      const rows = [label, ...lines, subtitle];
      // 130% (not 100%) so tall letters are fully hidden below the extra room
      // the title rows get for descenders.
      utils.set(rows, { y: "130%" });
      root.dataset.intro = "done";
      return animate(rows, {
        y: ["130%", "0%"],
        duration: 800,
        ease: "out(3)",
        delay: stagger(140, { start: 150 }),
        // Once everything is in place, stop clipping so glows and descenders show fully.
        onComplete: () => {
          rows.forEach((row) => {
            if (row.parentElement) row.parentElement.style.overflow = "visible";
          });
        },
      });
    });

    return () => {
      splitter.revert();
      label.parentElement?.style.removeProperty("overflow");
      subtitle.parentElement?.style.removeProperty("overflow");
    };
  }, []);

  return (
    <header ref={rootRef} data-intro="pending" className="hero-header text-center">
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
