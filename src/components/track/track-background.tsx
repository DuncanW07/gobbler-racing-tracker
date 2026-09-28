"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isComputer } from "@/lib/device";

// The animated VIR track is heavy to draw, so phones and tablets never load it.
const RaceTrack = dynamic(() => import("./race-track").then((m) => m.RaceTrack), { ssr: false });

export function TrackBackground() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only check, once
    setShow(isComputer());
  }, []);
  return show ? <RaceTrack /> : null;
}
