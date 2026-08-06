"use client";

import { useCallback, useEffect, useState } from "react";
import {
  api,
  type RsaDecryptResponse,
  type RsaEncryptResponse,
} from "@/lib/api";
import { getLevelCopy } from "@/content/levels";
import { PACKET_TIMINGS } from "@/lib/timings";
import { useGameStore, type Modulus } from "@/store/game";
import Keyboard from "@/components/Keyboard";
import RsaTerminal, {
  formatYears,
  type RsaTerminalPhase,
} from "@/components/RsaTerminal";
import Stage from "@/components/Stage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function revealLines(
  count: number,
  setReveal: (n: number) => void,
  stepMs = 280,
) {
  for (let i = 1; i <= count; i++) {
    setReveal(i);
    await sleep(stepMs);
  }
}

export default function ActRSA() {
  const tier = useGameStore((s) => s.tier);
  const modulus = useGameStore((s) => s.modulus);
  const setModulus = useGameStore((s) => s.setModulus);
  const selectedChar = useGameStore((s) => s.selectedChar);
  const rsaKeys = useGameStore((s) => s.rsaKeys);
  const setRsaKeys = useGameStore((s) => s.setRsaKeys);
  const setRsaCipher = useGameStore((s) => s.setRsaCipher);
  const setPacketState = useGameStore((s) => s.setPacketState);
  const setMessagePayload = useGameStore((s) => s.setMessagePayload);
  const setError = useGameStore((s) => s.setError);
  const rsaPubOnAle = useGameStore((s) => s.rsaPubOnAle);
  const setRsaPubOnAle = useGameStore((s) => s.setRsaPubOnAle);
  const setRsaPubOnHacker = useGameStore((s) => s.setRsaPubOnHacker);
  const setRsaShareState = useGameStore((s) => s.setRsaShareState);
  const resetRsaShare = useGameStore((s) => s.resetRsaShare);
  const packetState = useGameStore((s) => s.packetState);
  const copy = getLevelCopy(3, tier);

  const [phase, setPhase] = useState<RsaTerminalPhase>("idle");
  const [reveal, setReveal] = useState(0);
  const [encryptRes, setEncryptRes] = useState<RsaEncryptResponse | null>(null);
  const [decryptRes, setDecryptRes] = useState<RsaDecryptResponse | null>(null);
  const [projectionLabel, setProjectionLabel] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const busy =
    running ||
    packetState === "sending" ||
    packetState === "intercepted";

  /** Keygen + publish PK on the cable before anyone can encrypt. */
  const keygenAndShare = useCallback(async () => {
    setError(null);
    setPhase("keygen");
    setReveal(0);
    setEncryptRes(null);
    setDecryptRes(null);
    setProjectionLabel(null);
    setMessagePayload(null);
    setPacketState("idle");
    resetRsaShare();

    try {
      const keys = await api.rsa.keygen(modulus);
      setRsaKeys(keys);
      await revealLines(keys.trace.length, setReveal, 300);

      // Publish public key: Brayan → Hacker (copy) → Ale
      setPhase("publish");
      setRsaShareState("sending");
      await sleep(PACKET_TIMINGS.leaveAle);

      setRsaShareState("intercepted");
      setRsaPubOnHacker(true);
      await sleep(PACKET_TIMINGS.toHacker + PACKET_TIMINGS.holdTap);

      setRsaShareState("delivered");
      setRsaPubOnAle(true);
      await sleep(PACKET_TIMINGS.toBrayan);

      setRsaShareState(null);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keygen failed");
      setPhase("idle");
      resetRsaShare();
    }
  }, [
    modulus,
    setRsaKeys,
    setError,
    setMessagePayload,
    setPacketState,
    resetRsaShare,
    setRsaShareState,
    setRsaPubOnAle,
    setRsaPubOnHacker,
  ]);

  useEffect(() => {
    keygenAndShare();
  }, [keygenAndShare]);

  const send = useCallback(async () => {
    if (!selectedChar || !rsaKeys) {
      setError("Pick a letter and wait for keys.");
      return;
    }
    if (!rsaPubOnAle) {
      setError("Wait for the public key to reach Ale.");
      return;
    }
    setError(null);
    setRunning(true);
    setEncryptRes(null);
    setDecryptRes(null);
    setProjectionLabel(null);
    setReveal(0);

    try {
      const m = selectedChar.charCodeAt(0) - 64;

      // Ale encrypts with the public key she received
      setPhase("encrypt");
      setPacketState("sending");
      const enc = await api.rsa.encrypt(m, rsaKeys.e, rsaKeys.N);
      setRsaCipher(enc.c);
      setEncryptRes(enc);
      setMessagePayload({
        char: selectedChar,
        value: m,
        encrypted: true,
        ciphertext: String(enc.c),
        readableByHacker: false,
        equation: enc.equation,
      });
      await revealLines(enc.trace.length, setReveal, 260);
      await sleep(PACKET_TIMINGS.leaveAle);

      // Ciphertext on the cable; Hacker already has PK, now also gets c
      setPacketState("intercepted");
      setPhase("tap");
      setReveal(0);

      const crack = await api.rsa.crack(modulus, 2048);
      setProjectionLabel(
        formatYears(crack.rsa2048_projection.projected_years),
      );

      await sleep(PACKET_TIMINGS.toHacker + PACKET_TIMINGS.holdTap);

      // Brayan decrypts with the private key that never left him
      setPacketState("delivered");
      setPhase("decrypt");
      setReveal(0);
      const dec = await api.rsa.decrypt(enc.c, rsaKeys.d, rsaKeys.N);
      setDecryptRes(dec);
      await revealLines(dec.trace.length, setReveal, 260);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "RSA encrypt failed");
      setPacketState("idle");
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  }, [
    selectedChar,
    rsaKeys,
    rsaPubOnAle,
    modulus,
    setPacketState,
    setMessagePayload,
    setRsaCipher,
    setError,
  ]);

  useEffect(() => {
    (window as unknown as { __actRsaSend?: () => void }).__actRsaSend = send;
    return () => {
      delete (window as unknown as { __actRsaSend?: () => void }).__actRsaSend;
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

      {/* Remaining viewport: controls stay put, terminal fills + scrolls */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <div className="shrink-0 space-y-2">
          <div className="panel flex flex-wrap items-center gap-2 px-2 py-2">
            <span className="text-xs text-stage-muted">Modulus N</span>
            {([15, 21] as Modulus[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setModulus(n)}
                disabled={busy || phase === "keygen" || phase === "publish"}
                className={
                  modulus === n ? "btn-primary text-xs" : "btn-ghost text-xs"
                }
              >
                N = {n}
              </button>
            ))}
            {rsaKeys && (
              <span className="font-mono text-[10px] text-stage-muted sm:ml-auto sm:text-xs">
                <span className="text-accent-teal">PUB e={rsaKeys.e}</span>
                {" · "}
                <span className="text-accent-amber">PRIV d={rsaKeys.d}</span>
                {" · "}N={rsaKeys.N}
                {rsaPubOnAle ? " · shared" : " · publishing…"}
              </span>
            )}
          </div>

          <Keyboard
            compact
            modulus={modulus}
            requireCoprime
            disabled={busy || !rsaPubOnAle}
            onSelect={() => setError(null)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedChar || !rsaKeys || !rsaPubOnAle || busy}
              onClick={send}
            >
              {busy
                ? "Running…"
                : !rsaPubOnAle
                  ? "Sharing keys…"
                  : copy.sendLabel}
            </button>
            <button
              type="button"
              className="btn-ghost text-xs"
              disabled={busy || phase === "keygen" || phase === "publish"}
              onClick={keygenAndShare}
            >
              Regen + share keys
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

        {(phase !== "idle" || rsaKeys) && (
          <div className="min-h-0 flex-1">
            <RsaTerminal
              phase={phase === "idle" && rsaKeys ? "idle" : phase}
              keys={rsaKeys}
              encrypt={encryptRes}
              decrypt={decryptRes}
              reveal={reveal}
              letter={selectedChar}
              projectionYears={projectionLabel}
              keysShared={rsaPubOnAle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
