"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { groupBits, summarize, type Measurement } from "@/game/histogram";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";

const percent = (share: number) => `${share >= 0.995 || share === 0 ? Math.round(share * 100) : share >= 0.1 ? (share * 100).toFixed(0) : (share * 100).toFixed(1)}%`;
type Tab = "outcomes" | "qubits" | "raw";

/**
 * What the M block read, opened from the M block itself. A 25-qubit result
 * has 33 million possible strings, so this shows the few that got shots, puts
 * the rest in one bucket, and offers a qubit-by-qubit vote, the way you would
 * read a noisy result from real hardware.
 */
export function MeasurementExplorer({ measurement, title, qubitName = "Qubit", onClose }: {
  measurement: Measurement; title: string;
  /** What each bit is called in this story, e.g. "Tumbler". */
  qubitName?: string; onClose: () => void;
}) {
  useLocale((state) => state.locale);
  const [tab, setTab] = useState<Tab>("outcomes");
  const panel = useRef<HTMLDivElement>(null);
  const summary = summarize(measurement);
  const { shots, rows, other, ones, vote, top } = summary;
  useEffect(() => {
    const element = panel.current;
    element?.querySelector<HTMLButtonElement>("button")?.focus();
    // Escape closes this panel, not the laptop around it.
    function key(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }
    element?.addEventListener("keydown", key);
    return () => element?.removeEventListener("keydown", key);
  }, [onClose]);
  const raw = Object.entries(measurement.counts).sort(([, a], [, b]) => b - a);
  const tabButton = (id: Tab, label: string) => <button type="button" role="tab" aria-selected={tab === id} className={`measure-tab ${tab === id ? "active" : ""}`}
    onClick={() => { gameAudio.playSfx("select"); setTab(id); }}>{t(label)}</button>;

  return <div className="measure-explorer" role="dialog" aria-modal="true" aria-label={t(title)} ref={panel}>
    <div className="measure-card">
      <header className="measure-head">
        <div>
          <h3>🔍 {t(title)}</h3>
          <p className="text-xs text-stage-muted">
            {measurement.bits} {t("qubits")} · {summary.possible.toLocaleString("en-US")} {t("possible outcomes")} · {shots} {t(shots === 1 ? "shot" : "shots")} · {summary.distinct} {t("seen")}
          </p>
          <p className="text-xs text-accent-teal">{measurement.source === "hardware" ? `${t("Real hardware")}${measurement.backend ? ` · ${measurement.backend}` : ""}` : t("Ideal simulator")}</p>
        </div>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>{t("Close")}</button>
      </header>
      <div className="measure-tabs" role="tablist">{tabButton("outcomes", "Outcomes")}{tabButton("qubits", "Qubit by qubit")}{tabButton("raw", "Raw counts")}</div>

      {tab === "outcomes" && <div className="space-y-2" role="tabpanel">
        <p className="text-xs text-stage-muted">{t("Each bar is one bitstring and the share of shots that landed on it, tallest first. The marker shows what an ideal machine would give.")}</p>
        <ol className="measure-rows">
          {rows.map((row) => <li key={row.bitstring} className={row.highlight ? "highlight" : ""}>
            <code className="measure-bits">{groupBits(row.bitstring)}</code>
            <span className="measure-bar" aria-hidden="true"><span style={{ width: `${row.share * 100}%` }} />
              {row.probability !== null && <i style={{ left: `${row.probability * 100}%` }} />}</span>
            <span className="measure-share">{percent(row.share)}{shots > 0 && <small> · {row.count}</small>}</span>
          </li>)}
          {other.outcomes > 0 && <li className="other">
            <span className="measure-bits">{t("Every other outcome")} ({other.outcomes.toLocaleString("en-US")})</span>
            <span className="measure-bar" aria-hidden="true"><span style={{ width: `${other.share * 100}%` }} /></span>
            <span className="measure-share">{percent(other.share)}{shots > 0 && <small> · {other.count}</small>}</span>
          </li>}
          <li className="other">
            <span className="measure-bits">{t("Never seen")} ({(summary.possible - BigInt(summary.distinct || rows.length)).toLocaleString("en-US")})</span>
            <span className="measure-bar" aria-hidden="true" /><span className="measure-share">0%</span>
          </li>
        </ol>
        <p className="text-xs">{note(measurement, shots, top)}</p>
      </div>}

      {tab === "qubits" && <div className="space-y-2" role="tabpanel">
        <p className="text-xs text-stage-muted">{t("How often each qubit read 1 across all shots. With moderate noise, a majority vote for each qubit may help recover the answer even when the full string rarely appears.")}</p>
        <div className="measure-qubits" style={{ gridTemplateColumns: `repeat(${Math.min(measurement.bits, 25)}, minmax(0, 1fr))` }}>
          {ones.map((p, i) => <span key={i} title={`${t(qubitName)} ${i + 1}: ${percent(p)} 1`}>
            <span className="measure-column" aria-hidden="true"><span style={{ height: `${p * 100}%` }} /></span>
            <b className={vote[i] === "1" ? "one" : ""}>{vote[i]}</b><small>{i + 1}</small>
          </span>)}
        </div>
        <p className="text-xs">{t("Majority vote")}: <code className="measure-bits">{groupBits(vote)}</code>{top && <> · {t(vote === top ? "matches the tallest bar" : "differs from the tallest bar")}</>}</p>
        <p className="text-xs text-stage-muted">{t("Bits read left to right: the first bit is number 1.")}</p>
      </div>}

      {tab === "raw" && <div className="space-y-2" role="tabpanel">
        <p className="text-xs text-stage-muted">{t("The counts exactly as the service returns them: bitstring → number of shots.")}</p>
        <pre className="measure-raw">{`{\n${raw.slice(0, 64).map(([bits, count]) => `  "${bits}": ${count}`).join(",\n")}${raw.length > 64 ? `,\n  … ${t(`${raw.length - 64} more`)}` : ""}\n}`}</pre>
      </div>}
    </div>
  </div>;
}

function note(measurement: Measurement, shots: number, top: string | null): ReactNode {
  if (measurement.source === "hardware") return t("Real hardware is noisy: shots spread over strings close to the answer. Read the tallest bars, or the qubit-by-qubit vote.");
  if (shots <= 1) return <>{t("This circuit ran once, so there is one shot. For this circuit, an ideal device gives the same string every time. Real hardware may give other strings because of noise; repeated runs help us compare the results.")}{top && <> <code className="measure-bits">{groupBits(top)}</code></>}</>;
  return t("An ideal simulator: no noise, only the spread the circuit itself makes.");
}

/** The M block after a run: a magnifier cursor and badge, and a click or tap opens the explorer. */
export function MeasureInspectBadge(): ReactNode {
  return <span className="measure-inspect-badge" aria-hidden="true">🔍</span>;
}

/** The hint every run shows under its circuit, so the M block reads the same everywhere. */
export function MeasureHint(): ReactNode {
  useLocale((state) => state.locale);
  return <p className="text-sm text-accent-teal">{t("🔍 Tap the M block to explore what it measured.")}</p>;
}

/**
 * Any M block that isn't a puzzle slot: wrap its picture, and after a run it
 * gets the magnifier and opens the same explorer as every other circuit.
 */
export function MeasureInspect({ measurement, qubitName, className = "", children }: {
  measurement: Measurement | null; qubitName?: string; className?: string; children: ReactNode;
}) {
  useLocale((state) => state.locale);
  const [open, setOpen] = useState(false);
  if (!measurement) return <span className={className}>{children}</span>;
  return <>
    <button type="button" className={`measure-inspect ${className}`} aria-label={t("Explore what the M block measured")}
      onClick={() => { gameAudio.playSfx("select"); setOpen(true); }}>
      {children}<MeasureInspectBadge />
    </button>
    {open && <MeasurementExplorer measurement={measurement} title="What the M block read" qubitName={qubitName} onClose={() => setOpen(false)} />}
  </>;
}
