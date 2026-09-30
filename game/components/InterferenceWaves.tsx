"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Qubit } from "@/game/qubit";
import { t, useLocale } from "@/i18n";

const W = 320, H = 92, MID = 44, SCALE = 24, WAVES = 2;
const PART_COLORS = ["#2dd4bf", "#f5a623"];
/** Seconds until the second swell joins, and until the sea has become their sum. */
const JOIN = 1.6, MERGED = 3.4;
const BOAT_X = 0.68;

const surface = (amplitude: number, phase: number, x: number) => MID - amplitude * SCALE * Math.cos((x / W) * WAVES * 2 * Math.PI - phase);
function line(amplitude: number, phase: number): string {
  let d = "";
  for (let x = 0; x <= W; x += 4) d += `${x === 0 ? "M" : "L"}${x} ${surface(amplitude, phase, x).toFixed(1)}`;
  return d;
}
const fmt = (value: number) => (Math.abs(value) < 1e-6 ? "0" : Math.abs(Math.abs(value) - Math.SQRT1_2) < 1e-6 ? `${value < 0 ? "−" : ""}1/√2` : `${value < 0 ? "−" : ""}${+Math.abs(value).toFixed(2)}`);
const pct = (value: number) => `${Math.round(value * value * 100)}%`;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The last H as two swells meeting at sea. Each part of the state before it
 * (its |0⟩ and |1⟩ amplitude) sends a swell to both outcomes; H flips the sign
 * of the |1⟩ part's swell into outcome 1. The first swell rolls in, the second
 * joins, and the water becomes their sum: crests on crests grow, crests on
 * troughs go flat. A boat rides each sea so the height is easy to read.
 */
export function OceanWaves({ from, reveal = true }: { from: Qubit; reveal?: boolean }) {
  useLocale((state) => state.locale);
  const gradient = useId().replace(/:/g, "");
  const [clock, setClock] = useState({ phase: 0, time: MERGED });
  const start = useRef(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setClock({ phase: 0, time: MERGED }); return; }
    let frame = 0;
    start.current = 0;
    const tick = (now: number) => {
      if (!start.current) start.current = now;
      setClock({ phase: (now / 700) % (2 * Math.PI), time: (now - start.current) / 1000 });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const joined = ease((clock.time - JOIN + 0.4) / 0.6);
  const merge = ease((clock.time - JOIN) / (MERGED - JOIN));
  const r = Math.SQRT1_2;
  const outcomes = [[r * from.a, r * from.b], [r * from.a, -r * from.b]];
  const stage = clock.time < JOIN ? "The swell from the |0⟩ part rolls in…" : clock.time < MERGED ? "…the swell from the |1⟩ part joins it…" : "…and the sea becomes their sum.";

  return <div className="ocean-waves" role="img" aria-label={t("Swells from the last H meeting at sea")}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-xs text-stage-muted">{t("Watch the last H: each part of the state sends a swell to both outcomes. Do they grow, or go flat?")}</p>
      <button type="button" className="btn-ghost text-xs" onClick={() => setRun((n) => n + 1)}>{t("Replay the waves")}</button>
    </div>
    <p className="ocean-legend">
      <span style={{ color: PART_COLORS[0] }}>┄ {t("swell from the |0⟩ part")}</span>
      <span style={{ color: PART_COLORS[1] }}>┄ {t("swell from the |1⟩ part")}</span>
      <span className="text-[#e8f4f8]">▬ {t("the sea")}</span>
    </p>
    <p className="text-xs text-accent-teal" aria-live="polite">{t(stage)}</p>
    {outcomes.map((parts, outcome) => {
      const shown = [parts[0], parts[1] * joined];
      const sea = parts[0] * (1 - merge) + (parts[0] + parts[1]) * merge;
      const sum = parts[0] + parts[1];
      const both = parts.every((part) => Math.abs(part) > 1e-6);
      const note = !both ? `Only one swell arrives: amplitude ${fmt(sum)}, probability ${pct(sum)}.`
        : Math.abs(sum) < 1e-6 ? "The swells cancel: a flat sea, amplitude 0, probability 0%." : `The swells add: amplitude ${fmt(sum)}, probability ${pct(sum)}.`;
      const top = line(sea, clock.phase);
      const bx = W * BOAT_X, by = surface(sea, clock.phase, bx);
      const tilt = (Math.atan2(surface(sea, clock.phase, bx + 6) - surface(sea, clock.phase, bx - 6), 12) * 180) / Math.PI;
      const crests: number[] = [];
      for (let x = 8; x < W; x += 16) if (surface(sea, clock.phase, x) < MID - SCALE * 0.55) crests.push(x);
      return <div key={outcome} className="ocean-row">
        <span className="ocean-label">{t(`Outcome ${outcome}`)}</span>
        <svg viewBox={`0 0 ${W} ${H}`} className="ocean-svg" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${gradient}-${outcome}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#3aa6c9" /><stop offset="1" stopColor="#0b3a55" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="#0a1d2b" />
          <path d={`${top}L${W} ${H}L0 ${H}Z`} fill={`url(#${gradient}-${outcome})`} />
          <path d={top} fill="none" stroke="#e8f7ff" strokeWidth="2" strokeLinecap="round" />
          {crests.map((x) => <circle key={x} cx={x} cy={surface(sea, clock.phase, x) - 1} r="1.6" fill="#ffffff" opacity="0.85" />)}
          {shown.map((part, i) => Math.abs(part) > 1e-6 && <path key={i} d={line(part, clock.phase)} fill="none" stroke={PART_COLORS[i]} strokeWidth="1.6" strokeDasharray="5 4" strokeDashoffset={i * 4.5} opacity={i === 1 ? 0.35 + 0.65 * joined : 0.95} />)}
          <g transform={`translate(${bx} ${by}) rotate(${tilt})`}>
            <path d="M-9 -1 L9 -1 L6 4 L-6 4 Z" fill="#8b5a2b" stroke="#3b2412" strokeWidth="0.8" />
            <path d="M0 -1 L0 -15" stroke="#3b2412" strokeWidth="1" />
            <path d="M1 -14 L8 -3 L1 -3 Z" fill="#f5f5f0" />
          </g>
        </svg>
        {reveal && clock.time >= MERGED && <span className={`ocean-note ${both && Math.abs(sum) < 1e-6 ? "cancel" : ""}`}>{t(note)}</span>}
      </div>;
    })}
  </div>;
}

const GW = 280, GH = 56, GMID = GH / 2, GSCALE = 22;
function graphPath(amplitude: number, phase: number): string {
  let d = "";
  for (let x = 0; x <= GW; x += 4) d += `${x === 0 ? "M" : "L"}${x} ${(GMID - amplitude * GSCALE * Math.cos((x / GW) * 4 * Math.PI - phase)).toFixed(1)}`;
  return d;
}

/**
 * The same last H as a plain chart: each part's ripple dashed, their sum solid.
 * Sits under the bench circuit and follows whatever the player builds.
 */
export function RippleGraph({ from }: { from: Qubit }) {
  useLocale((state) => state.locale);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const tick = (time: number) => { setPhase((time / 450) % (2 * Math.PI)); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const r = Math.SQRT1_2;
  const outcomes = [[r * from.a, r * from.b], [r * from.a, -r * from.b]];
  return <div className="interference-waves" role="img" aria-label={t("Ripples from the last H")}>
    <p className="text-xs text-stage-muted">{t("Watch the last H: each part of the state sends a ripple to both outcomes.")}</p>
    <p className="interference-legend">
      <span style={{ color: PART_COLORS[0] }}>— {t("from the |0⟩ part")}</span>
      <span style={{ color: PART_COLORS[1] }}>— {t("from the |1⟩ part")}</span>
      <span className="text-[#e8f4f8]">━ {t("sum")}</span>
    </p>
    {outcomes.map((parts, outcome) => {
      const sum = parts[0] + parts[1];
      const both = parts.every((part) => Math.abs(part) > 1e-6);
      const note = !both ? `Only one ripple arrives: amplitude ${fmt(sum)}, probability ${pct(sum)}.`
        : Math.abs(sum) < 1e-6 ? "The ripples cancel: amplitude 0, probability 0%." : `The ripples add: amplitude ${fmt(sum)}, probability ${pct(sum)}.`;
      return <div key={outcome} className="interference-row">
        <span className="interference-label">{t(`Outcome ${outcome}`)}</span>
        <svg viewBox={`0 0 ${GW} ${GH}`} className="interference-svg" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={GW} y1={GMID} y2={GMID} stroke="#1e4450" />
          {parts.map((part, i) => Math.abs(part) > 1e-6 && <path key={i} d={graphPath(part, phase)} fill="none" stroke={PART_COLORS[i]} strokeWidth="1.5" strokeDasharray="4 3" strokeDashoffset={i * 3.5} />)}
          <path d={graphPath(sum, phase)} fill="none" stroke="#e8f4f8" strokeWidth="2.5" />
        </svg>
        <span className={`interference-note ${both && Math.abs(sum) < 1e-6 ? "cancel" : ""}`}>{t(note)}</span>
      </div>;
    })}
  </div>;
}
