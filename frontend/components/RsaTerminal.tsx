"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type {
  RsaDecryptResponse,
  RsaEncryptResponse,
  RsaKeygenResponse,
} from "@/lib/api";

export type RsaTerminalPhase =
  | "idle"
  | "keygen"
  | "publish"
  | "encrypt"
  | "tap"
  | "decrypt"
  | "done";

interface RsaTerminalProps {
  phase: RsaTerminalPhase;
  keys: RsaKeygenResponse | null;
  encrypt: RsaEncryptResponse | null;
  decrypt: RsaDecryptResponse | null;
  /** How many keygen/encrypt/decrypt trace lines to reveal (for pacing). */
  reveal: number;
  letter: string | null;
  projectionYears: string | null;
  /** True once the public key reached Ale (and Hacker copied it). */
  keysShared: boolean;
}

function formatYears(years: number): string {
  if (years >= 1e6) return `${years.toExponential(2)} years`;
  if (years >= 1000) return `${(years / 1000).toFixed(1)}k years`;
  return `${years.toFixed(2)} years`;
}

/**
 * Terminal story:
 * Brayan keygen → publish PK on cable → Ale encrypt → Hacker idle (PK+c) → Brayan decrypt.
 */
export default function RsaTerminal({
  phase,
  keys,
  encrypt,
  decrypt,
  reveal,
  letter,
  projectionYears,
  keysShared,
}: RsaTerminalProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [phase, reveal, projectionYears, keysShared]);

  if (phase === "idle" && !keys) return null;

  const host =
    phase === "encrypt"
      ? "ale@send"
      : phase === "tap" || phase === "publish"
        ? phase === "publish"
          ? "brayan@recv"
          : "hacker@tap"
        : phase === "keygen" || phase === "decrypt" || phase === "done"
          ? "brayan@recv"
          : "rsa@session";

  const title =
    phase === "keygen"
      ? "rsa-keygen"
      : phase === "publish"
        ? "publish-pubkey"
        : phase === "encrypt"
          ? "rsa-encrypt"
          : phase === "tap"
            ? "tap — PK + c"
            : phase === "decrypt" || phase === "done"
              ? "rsa-decrypt"
              : keysShared
                ? "keys shared"
                : "keys ready";

  const showPublish =
    phase === "publish" ||
    keysShared ||
    phase === "encrypt" ||
    phase === "tap" ||
    phase === "decrypt" ||
    phase === "done";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-accent-teal/40 bg-[#0b1210] shadow-inner"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-accent-teal/30 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-accent-teal" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent-teal">
          {host} — {title}
        </span>
        <span className="ml-auto font-mono text-[10px] text-stage-muted">
          {phase}
        </span>
      </div>

      {/*
        Scroll lives here. Parent must be a bounded flex child (min-h-0);
        do not animate height:auto on the shell — that fights overflow.
      */}
      <div
        ref={scroller}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 pt-2 font-mono text-[11px] leading-relaxed sm:text-xs"
      >
        {keys && (
          <>
            <p className="text-actor-brayan">
              brayan@recv$ rsa-keygen --N {keys.N}
            </p>
            {keys.trace.slice(0, phase === "keygen" ? reveal : 99).map((t) => (
              <p key={t.step} className="text-stage-muted">
                [*] {t.step}: {t.detail}
              </p>
            ))}
            {(phase !== "keygen" || reveal >= keys.trace.length) && (
              <>
                <p className="text-accent-amber">
                  [✓] PUBLIC (e={keys.e}, N={keys.N}) — will publish on cable
                </p>
                <p className="text-actor-brayan">
                  [✓] PRIVATE (d={keys.d}, N={keys.N}) — stays with Brayan
                </p>
              </>
            )}
          </>
        )}

        {keys && showPublish && (
          <>
            <p className="mt-1 text-actor-brayan">
              brayan@recv$ publish --pubkey e={keys.e} N={keys.N}
            </p>
            <p className="text-stage-muted">
              [*] putting PUBLIC key on the public cable…
            </p>
            {(phase !== "publish" || keysShared) && (
              <>
                <p className="text-actor-hacker">
                  hacker@tap$ # copied PUBLIC key (e={keys.e}, N={keys.N})
                </p>
                <p className="text-actor-ale">
                  ale@send$ # received PUBLIC key — can encrypt
                </p>
                <p className="text-stage-muted">
                  [*] PRIVATE key never left Brayan
                </p>
              </>
            )}
          </>
        )}

        {encrypt &&
          (phase === "encrypt" ||
            phase === "tap" ||
            phase === "decrypt" ||
            phase === "done") && (
            <>
              <p className="mt-1 text-actor-ale">
                ale@send$ rsa-encrypt --m {encrypt.m}
                {letter ? ` (${letter})` : ""} --pub e={encrypt.e} N=
                {encrypt.N}
              </p>
              {encrypt.trace
                .slice(0, phase === "encrypt" ? reveal : 99)
                .map((t, i) => (
                  <p key={`enc-${i}`} className="text-stage-muted">
                    [*] {t.op}: {t.detail}
                  </p>
                ))}
              {(phase !== "encrypt" || reveal >= encrypt.trace.length) && (
                <p className="text-accent-amber">
                  [✓] c = {encrypt.m}^{encrypt.e} mod {encrypt.N} ={" "}
                  <strong>{encrypt.c}</strong>{" "}
                  <span className="text-stage-muted"># on public cable</span>
                </p>
              )}
            </>
          )}

        {(phase === "tap" || phase === "decrypt" || phase === "done") &&
          encrypt &&
          keys && (
            <>
              <p className="mt-1 text-actor-hacker">
                hacker@tap$ # inventory: PUBLIC key + c={encrypt.c}
              </p>
              <p className="text-actor-hacker/90">
                [*] has PK (e={keys.e}, N={keys.N}) and ciphertext
              </p>
              <p className="text-actor-hacker/90">
                [*] missing PRIVATE d — cannot compute c^d mod N
              </p>
              <p className="text-stage-muted">
                [*] toy N is factorable, but RSA-2048 ≈{" "}
                <span className="text-accent-amber">
                  {projectionYears ?? "…"}
                </span>{" "}
                classically
              </p>
              <p className="text-actor-hacker">
                hacker@tap$ # idle — PK + c only
              </p>
            </>
          )}

        {decrypt && (phase === "decrypt" || phase === "done") && (
          <>
            <p className="mt-1 text-actor-brayan">
              brayan@recv$ rsa-decrypt --c {decrypt.c} --priv d={decrypt.d} N=
              {decrypt.N}
            </p>
            {decrypt.trace
              .slice(0, phase === "decrypt" ? reveal : 99)
              .map((t, i) => (
                <p key={`dec-${i}`} className="text-stage-muted">
                  [*] {t.op}: {t.detail}
                </p>
              ))}
            {(phase !== "decrypt" || reveal >= decrypt.trace.length) && (
              <p className="text-accent-amber">
                [✓] m = {decrypt.c}^{decrypt.d} mod {decrypt.N} ={" "}
                <strong>{decrypt.m}</strong>
                {letter ? ` → ${letter}` : ""}{" "}
                <span className="text-stage-muted"># private key only</span>
              </p>
            )}
          </>
        )}

        {phase !== "done" && phase !== "idle" && (
          <p className="animate-pulse text-accent-teal">_</p>
        )}
        {/* Spacer so the last line clears the scrollport edge */}
        <div className="h-6 shrink-0" aria-hidden />
      </div>
    </motion.div>
  );
}

export { formatYears };
