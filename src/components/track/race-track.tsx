"use client";

import { useEffect, useRef } from "react";
import { animate, createScope, svg, utils } from "animejs";
import {
  LAP_PROFILE,
  START_FINISH,
  VIR_PATH,
  VIR_VIEWBOX,
} from "./vir-full-course";

// One lap of VIR on screen. The real lap is ~2:20; this is about 3.5x speed.
const LAP_MS = 40_000;

// Comet trail behind the car: longest/faintest first, shortest/brightest last.
// Lengths are fractions of a lap.
const TRAILS = [
  { length: 0.065, width: 10, color: "#e5751f", opacity: 0.55 },
  { length: 0.02, width: 7, color: "#ff8a2b", opacity: 0.95 },
];

// Maps time (0..1 of a lap) to distance (0..1 of a lap) from the lap simulation,
// so the car brakes into corners and runs faster on the straights.
function lapEase(t: number): number {
  const last = LAP_PROFILE.length - 1;
  const x = Math.min(Math.max(t, 0), 1) * last;
  const i = Math.min(Math.floor(x), last - 1);
  return LAP_PROFILE[i] + (LAP_PROFILE[i + 1] - LAP_PROFILE[i]) * (x - i);
}

export function RaceTrack() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const line = root.querySelector<SVGPathElement>("[data-track-line]")!;
    const car = root.querySelector<SVGGElement>("[data-car]")!;
    const carLayer = root.querySelector<SVGGElement>("[data-car-layer]")!;
    const trails = [...root.querySelectorAll<SVGPathElement>("[data-trail]")];
    const total = line.getTotalLength();

    const placeCar = (distance: number) => {
      const p = line.getPointAtLength(distance);
      car.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
      trails.forEach((trail, i) => {
        const len = TRAILS[i].length * total;
        // One dash of the trail's length that ends exactly at the car. The dash
        // pattern repeats every lap, so the trail wraps across start/finish.
        trail.style.strokeDasharray = `${len} ${total - len}`;
        trail.style.strokeDashoffset = `${len - distance}`;
      });
    };

    placeCar(0);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      trails.forEach((t) => (t.style.display = "none"));
      root.dataset.ready = "true";
      return;
    }

    const scope = createScope({ root }).add(() => {
      const drawables = svg.createDrawable("[data-track-draw]");
      utils.set(drawables, { draw: "0 0" });
      utils.set(carLayer, { opacity: 0 });
      utils.set("[data-start-finish]", { opacity: 0 });
      root.dataset.ready = "true";

      // Track (edges, asphalt and glow together) draws itself in from
      // start/finish, in race direction. Then the start/finish line appears.
      animate(drawables, {
        draw: ["0 0", "0 1"],
        duration: 1800,
        delay: 350,
        ease: "inOut(2)",
      });
      animate("[data-start-finish]", { opacity: [0, 1], duration: 500, delay: 2000 });

      // Then the car rolls out and laps forever.
      animate(carLayer, { opacity: [0, 1], duration: 700, delay: 1900 });
      const progress = { distance: 0 };
      animate(progress, {
        distance: [0, total],
        duration: LAP_MS,
        delay: 1900,
        ease: lapEase,
        loop: true,
        onUpdate: () => placeCar(progress.distance),
      });
    });

    return () => scope.revert();
  }, []);

  const sfAngle = START_FINISH.angle + 90;

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-ready="false"
      className="race-track pointer-events-none fixed inset-0 flex items-center justify-center"
    >
      <div className="relative">
        {/* Static layer: glow, track edges, asphalt, start/finish line */}
        <svg
          viewBox={VIR_VIEWBOX}
          className="block h-[88vh] max-h-[1060px] w-auto max-w-[94vw] overflow-visible"
          fill="none"
        >
          <defs>
            <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
          </defs>
          <path
            data-track-draw
            d={VIR_PATH}
            stroke="#861f41"
            strokeOpacity="0.55"
            strokeWidth="60"
            filter="url(#track-glow)"
          />
          <path
            data-track-draw
            d={VIR_PATH}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="34"
            strokeLinejoin="round"
          />
          <path
            data-track-draw
            d={VIR_PATH}
            stroke="#08070a"
            strokeWidth="27"
            strokeLinejoin="round"
          />
          <path data-track-line d={VIR_PATH} stroke="none" />
          <g
            data-start-finish
            transform={`translate(${START_FINISH.x} ${START_FINISH.y}) rotate(${sfAngle})`}
          >
            <rect x="-19" y="-3.5" width="38" height="7" fill="#f4f4f5" opacity="0.85" />
          </g>
        </svg>

        {/* Moving layer: trail + car */}
        <svg
          viewBox={VIR_VIEWBOX}
          className="absolute inset-0 h-full w-full overflow-visible"
          fill="none"
        >
          <defs>
            <radialGradient id="car-halo">
              <stop offset="0%" stopColor="#ff8a2b" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#e5751f" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#e5751f" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g data-car-layer>
            {TRAILS.map((t) => (
              <path
                key={t.length}
                data-trail
                d={VIR_PATH}
                stroke={t.color}
                strokeOpacity={t.opacity}
                strokeWidth={t.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <g data-car>
              <circle r="32" fill="url(#car-halo)" />
              <circle r="10" fill="#fff7ed" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
