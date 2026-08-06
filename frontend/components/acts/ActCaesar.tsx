"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getLevelCopy } from "@/content/levels";
import { PACKET_TIMINGS } from "@/lib/timings";
import { useGameStore } from "@/store/game";
import CrackTerminal from "@/components/CrackTerminal";
import Keyboard from "@/components/Keyboard";
import Stage from "@/components/Stage";

export default function ActCaesar() {
  const tier = useGameStore((s) => s.tier);
  const shift = useGameStore((s) => s.shift);
  const setShift = useGameStore((s) => s.setShift);
  const selectedChar = useGameStore((s) => s.selectedChar);
  const setPacketState = useGameStore((s) => s.setPacketState);
  const setMessagePayload = useGameStore((s) => s.setMessagePayload);
  const setError = useGameStore((s) => s.setError);
  const packetState = useGameStore((s) => s.packetState);
  const copy = getLevelCopy(2, tier);

  const [crackIndex, setCrackIndex] = useState(-1);
  const [crackTrials, setCrackTrials] = useState<
    { shift: number; candidate: string; match: boolean }[]
  >([]);
  const [crackMs, setCrackMs] = useState<number | null>(null);
  const [cipherOnWire, setCipherOnWire] = useState<string | null>(null);
  const crackingRef = useRef(false);

  const busy =
    packetState === "sending" ||
    packetState === "intercepted" ||
    packetState === "cracked" ||
    crackingRef.current;

  const send = useCallback(async () => {
    if (!selectedChar) {
      setError("Pick a letter first.");
      return;
    }
    if (crackingRef.current) return;
    setError(null);
    setCrackIndex(-1);
    setCrackTrials([]);
    setCrackMs(null);
    setCipherOnWire(null);
    setPacketState("sending");

    try {
      const enc = await api.caesar.encrypt(selectedChar, shift);
      setCipherOnWire(enc.ciphertext);
      setMessagePayload({
        char: enc.plaintext,
        value: enc.plaintext_value,
        encrypted: true,
        ciphertext: enc.ciphertext,
        readableByHacker: false,
        equation: enc.equation,
      });

      // Hold Ale's letter, then ride to the tap
      await new Promise((r) => setTimeout(r, PACKET_TIMINGS.leaveAle));
      setPacketState("intercepted");
      await new Promise((r) => setTimeout(r, PACKET_TIMINGS.toHacker));

      // Hacker brute-forces while the packet sits on the tap
      crackingRef.current = true;
      const crack = await api.caesar.crack(enc.ciphertext, enc.plaintext);

      for (let i = 0; i < crack.trials.length; i++) {
        setCrackIndex(i);
        setCrackTrials(crack.trials.slice(0, i + 1));
        await new Promise((r) => setTimeout(r, 80));
      }

      setCrackMs(crack.elapsed_ms);
      setMessagePayload({
        char: enc.plaintext,
        value: enc.plaintext_value,
        encrypted: true,
        ciphertext: enc.ciphertext,
        readableByHacker: true,
        equation: enc.equation,
      });
      setPacketState("cracked");
      await new Promise((r) => setTimeout(r, PACKET_TIMINGS.afterCrack));

      // Ciphertext still reaches Brayan — Hacker already has the plaintext copy
      setPacketState("delivered");
      crackingRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encrypt failed");
      setPacketState("idle");
      crackingRef.current = false;
    }
  }, [selectedChar, shift, setPacketState, setMessagePayload, setError]);

  useEffect(() => {
    (window as unknown as { __actCaesarSend?: () => void }).__actCaesarSend =
      send;
    return () => {
      delete (window as unknown as { __actCaesarSend?: () => void })
        .__actCaesarSend;
    };
  }, [send]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <header className="shrink-0">
        <h2 className="font-display text-base font-bold text-accent-amber sm:text-lg">
          {copy.headline}
        </h2>
        <p className="text-xs text-stage-muted sm:text-sm">{copy.subhead}</p>
      </header>

      <div className="shrink-0">
        <Stage />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="shrink-0 space-y-2">
          <div className="panel flex flex-wrap items-center gap-3 px-2 py-2">
            <label className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-stage-muted">Shift k</span>
              <input
                type="number"
                min={1}
                max={25}
                value={shift}
                onChange={(e) => setShift(Number(e.target.value) || 1)}
                className="w-14 rounded border border-stage-border bg-stage-bg px-2 py-1 font-mono text-sm"
              />
            </label>
            <span className="font-mono text-[10px] text-stage-muted sm:text-xs">
              c = (m + {shift}) mod 26
            </span>
          </div>

          <Keyboard compact onSelect={() => setError(null)} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedChar || busy}
              onClick={send}
            >
              {busy ? "On the cable…" : copy.sendLabel}
            </button>
            {copy.hint && (
              <span className="text-xs text-stage-muted">{copy.hint}</span>
            )}
            <span className="text-xs text-stage-muted">
              Open <strong className="text-accent-teal">Math</strong> for the
              blackboard.
            </span>
          </div>
        </div>

        <AnimatePresence>
          {crackTrials.length > 0 && cipherOnWire && (
            <div className="min-h-0 flex-1">
              <CrackTerminal
                ciphertext={cipherOnWire}
                trials={crackTrials}
                activeIndex={crackIndex}
                elapsedMs={crackMs}
              />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
