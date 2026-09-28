"use client";

import { useEffect, useRef } from "react";
import { createTimeline, splitText, stagger, utils } from "animejs";

const STEP = 140; // ms between each piece starting

// Runs the page intro in one sequence: label, title lines, subtitle,
// then the card flips down, then the footer line slides up. Plays once.
export function IntroStage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

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
    const card = root.querySelector<HTMLElement>("[data-flip]")!;
    const footer = root.querySelector<HTMLElement>("[data-reveal='footer']")!;
    const clipped = [label, subtitle, footer];

    const splitter = splitText(title, { lines: { wrap: "clip" } });
    let played = false;

    // addEffect runs once the lines exist (after fonts load), and again whenever
    // the lines are re-split on resize. Only the first run animates.
    splitter.addEffect(({ lines }: { lines: HTMLElement[] }) => {
      if (played) return;
      played = true;

      const rows = [label, ...lines, subtitle];
      const cardAt = 150 + STEP * rows.length;

      // 130% (not 100%) so tall letters are fully hidden below the extra room
      // the title rows get for descenders.
      utils.set([...rows, footer], { y: "130%" });
      utils.set(card, { rotateX: 90, opacity: 0 });
      root.dataset.intro = "done";

      return createTimeline({
        // Once everything is in place, stop clipping so glows and descenders show fully.
        onComplete: () => {
          [...rows, footer].forEach((row) => {
            if (row.parentElement) row.parentElement.style.overflow = "visible";
          });
        },
      })
        .add(rows, {
          y: ["130%", "0%"],
          duration: 800,
          ease: "out(3)",
          delay: stagger(STEP, { start: 150 }),
        }, 0)
        // Card is hinged at its top edge and flips down into place. Kept quick
        // so the form is usable almost immediately.
        .add(card, {
          rotateX: [90, 0],
          opacity: [0, 1],
          duration: 450,
          ease: "out(3)",
        }, cardAt)
        .add(footer, {
          y: ["130%", "0%"],
          duration: 500,
          ease: "out(3)",
        }, cardAt + STEP);
    });

    return () => {
      splitter.revert();
      clipped.forEach((el) => el.parentElement?.style.removeProperty("overflow"));
      card.style.removeProperty("transform");
      card.style.removeProperty("opacity");
    };
  }, []);

  return (
    <div ref={rootRef} data-intro="pending" className={`intro-stage ${className ?? ""}`}>
      {children}
    </div>
  );
}
