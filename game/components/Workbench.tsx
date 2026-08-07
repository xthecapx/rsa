"use client";

import { useState } from "react";
import clsx from "clsx";

import type { ActNumber } from "@/content/types";
import { QuantumUplink } from "./QuantumUplink";
import { resolvePanel } from "@/game/dialog";
import { runApiCall } from "@/game/effects";
import { charOf } from "@/game/secret";
import { useGame } from "@/game/state";
import { api } from "@/lib/api";

/**
 * The laptop. Whatever the listener pulled off the wire lands here, and the
 * buttons below it are the only way to turn it back into words. Every one of
 * them is a real request to the backend.
 */
export function Workbench({ act }: { act: ActNumber }) {
  const capture = useGame((s) => s.capture);
  const recovered = useGame((s) => s.vars.recovered);

  return (
    <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b-2 border-stage-border px-3 py-2 text-[10px] uppercase tracking-widest text-accent-teal">
        Workbench
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {capture ? (
          <div className="border-2 border-stage-border bg-stage-bg/60 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-widest text-stage-muted">
              Off the wire &middot; {capture.scheme}
            </p>
            <p className="mt-1 break-all font-mono text-[13px] text-accent-amber">
              {capture.payload}
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-stage-muted">
            Nothing captured yet. The listener has to be on the line before
            there is anything to work on.
          </p>
        )}

        {capture && <Tools act={act} />}

        {recovered && (
          <div className="border-2 border-actor-brayan/60 bg-actor-brayan/10 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-widest text-stage-muted">
              Plaintext
            </p>
            <p className="mt-1 break-all font-mono text-[15px] text-actor-brayan">
              {recovered}
            </p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-stage-border p-2">
        <button
          type="button"
          disabled={!recovered}
          onClick={() => void resolvePanel()}
          className={clsx(
            "w-full border-2 px-3 py-2 text-[11px] transition-colors",
            recovered
              ? "border-accent-amber text-accent-amber hover:bg-accent-amber/15"
              : "cursor-not-allowed border-stage-border text-stage-muted",
          )}
        >
          {recovered ? "I have it. Go tell the client." : "Decode it first"}
        </button>
      </div>
    </div>
  );
}

function Tools({ act }: { act: ActNumber }) {
  if (act === 1) return <MappingTool />;
  if (act === 2) return <CaesarTool />;
  if (act === 3) return <RsaTool />;
  return <QuantumUplink />;
}

function ToolButton({
  label,
  busy,
  onClick,
  disabled,
}: {
  label: string;
  busy?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={clsx(
        "w-full border-2 px-2.5 py-1.5 text-left text-[11px] transition-colors",
        disabled || busy
          ? "cursor-not-allowed border-stage-border text-stage-muted"
          : "border-stage-border text-[#cfe6ee] hover:border-accent-teal hover:text-white",
      )}
    >
      {busy ? `${label}...` : label}
    </button>
  );
}

/** Act 1: the numbers on the wire are the alphabet, in order. */
function MappingTool() {
  const values = useGame((s) => s.vars.values);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [table, setTable] = useState<{ char: string; value: number }[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadTable() {
    setBusy(true);
    try {
      const res = await api.keyboard();
      setTable(res.keys.map((key) => ({ char: key.char, value: key.value })));
      pushTerminal({
        tone: "info",
        text: "Pulled the alphabet table: A=1 through Z=26.",
      });
    } finally {
      setBusy(false);
    }
  }

  function applyMapping() {
    const numbers = String(values).trim().split(/\s+/).filter(Boolean);
    const lookup = new Map(table.map((row) => [row.value, row.char]));
    const word = numbers
      .map((n) => lookup.get(Number(n)) ?? charOf(Number(n)))
      .join("");
    for (const n of numbers) {
      pushTerminal({
        tone: "info",
        text: `${n} -> ${lookup.get(Number(n)) ?? "?"}`,
      });
    }
    pushTerminal({ tone: "good", text: `Message reads: ${word}` });
    setVars({ recovered: word });
  }

  return (
    <div className="space-y-2">
      <ToolButton label="Fetch the alphabet table" busy={busy} onClick={() => void loadTable()} />

      {table.length > 0 && (
        <>
          <div className="grid grid-cols-6 gap-x-2 gap-y-0.5 border-2 border-stage-border px-2 py-1.5 font-mono text-[10px] text-stage-muted">
            {table.map((row) => (
              <span key={row.char}>
                {row.char}={row.value}
              </span>
            ))}
          </div>
          <ToolButton label="Apply the mapping" onClick={applyMapping} />
        </>
      )}
    </div>
  );
}

/**
 * Act 2: the shift is secret but there are only 25 of them, so ask the backend
 * for every candidate and read the one that is a word.
 */
function CaesarTool() {
  const cipherText = useGame((s) => s.vars.cipherText);
  const setVars = useGame((s) => s.setVars);
  const pushTerminal = useGame((s) => s.pushTerminal);
  const [candidates, setCandidates] = useState<{ shift: number; word: string }[]>([]);
  const [busy, setBusy] = useState(false);

  async function bruteForce() {
    setBusy(true);
    try {
      // One request per character; each returns that character under all 25
      // shifts, so the candidate words are assembled from real backend output.
      const perChar = await Promise.all(
        String(cipherText)
          .split("")
          .map((char) => api.caesar.crack(char)),
      );
      const rows = Array.from({ length: 25 }, (_, i) => {
        const shift = i + 1;
        const word = perChar
          .map((res) => res.trials.find((t) => t.shift === shift)?.candidate ?? "?")
          .join("");
        return { shift, word };
      });
      setCandidates(rows);
      pushTerminal({
        tone: "info",
        text: `Tried all 25 shifts against "${cipherText}". One of them is English.`,
      });
    } finally {
      setBusy(false);
    }
  }

  function pick(row: { shift: number; word: string }) {
    setVars({ recovered: row.word, shift: row.shift });
    pushTerminal({ tone: "good", text: `k=${row.shift} gives "${row.word}".` });
  }

  return (
    <div className="space-y-2">
      <ToolButton label="Try all 25 shifts" busy={busy} onClick={() => void bruteForce()} />

      {candidates.length > 0 && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto border-2 border-stage-border px-2 py-1.5 font-mono text-[11px]">
          {candidates.map((row) => (
            <li key={row.shift}>
              <button
                type="button"
                onClick={() => pick(row)}
                className="flex w-full gap-3 px-1 text-left text-[#cfe6ee] hover:bg-accent-amber/15 hover:text-white"
              >
                <span className="text-stage-muted">
                  k={String(row.shift).padStart(2, " ")}
                </span>
                <span>{row.word}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Act 3: the public key is public, so the only secret left is the factoring. */
function RsaTool() {
  const vars = useGame((s) => s.vars);
  const setVars = useGame((s) => s.setVars);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(call: "rsaCrack" | "deriveKey", key: string) {
    setBusy(key);
    try {
      await runApiCall(call);
      if (call === "deriveKey") {
        const recovered = useGame.getState().vars.recovered;
        if (recovered) setVars({ recovered: String(recovered) });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-2 border-stage-border px-2 py-1.5 font-mono text-[10px]">
        <dt className="text-stage-muted">public e</dt>
        <dd className="text-[#cfe6ee]">{vars.e ?? "?"}</dd>
        <dt className="text-stage-muted">modulus N</dt>
        <dd className="text-[#cfe6ee]">{vars.modulus}</dd>
        <dt className="text-stage-muted">ciphertext c</dt>
        <dd className="text-accent-amber">{vars.cipherNumber ?? "?"}</dd>
        <dt className="text-stage-muted">factors</dt>
        <dd className="text-[#cfe6ee]">{vars.factors ?? "unknown"}</dd>
        <dt className="text-stage-muted">private d</dt>
        <dd className="text-[#cfe6ee]">{vars.d ?? "unknown"}</dd>
      </dl>

      <ToolButton
        label={`Factor N = ${vars.modulus}`}
        busy={busy === "factor"}
        onClick={() => void run("rsaCrack", "factor")}
      />
      <ToolButton
        label="Derive d and decrypt"
        busy={busy === "derive"}
        disabled={!vars.factors}
        onClick={() => void run("deriveKey", "derive")}
      />

      <p className="text-[10px] leading-relaxed text-stage-muted">
        N = {vars.modulus} falls in microseconds. The same attack on a 2048-bit
        modulus is what keeps RSA standing.
      </p>
    </div>
  );
}