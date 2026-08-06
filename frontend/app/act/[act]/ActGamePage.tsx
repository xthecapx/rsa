"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ACT_TITLES } from "@/content/levels";
import ActNav from "@/components/ActNav";
import Blackboard from "@/components/Blackboard";
import ConfigDrawer from "@/components/ConfigDrawer";
import PresenterHotkeys from "@/components/PresenterHotkeys";
import TierToggle from "@/components/TierToggle";
import ActPlaintext from "@/components/acts/ActPlaintext";
import ActCaesar from "@/components/acts/ActCaesar";
import ActRSA from "@/components/acts/ActRSA";
import ActShor from "@/components/acts/ActShor";
import { PACKET_TIMINGS } from "@/lib/timings";
import { useGameStore, type ActNumber, type Tier } from "@/store/game";

interface ActPageProps {
  actParam: string;
  tierParam?: string;
}

function parseAct(raw: string): ActNumber {
  const n = Number(raw);
  if (n >= 1 && n <= 4) return n as ActNumber;
  return 1;
}

function parseTier(raw?: string): Tier {
  const n = Number(raw);
  if (n >= 1 && n <= 3) return n as Tier;
  return 1;
}

export default function ActGamePage({ actParam, tierParam }: ActPageProps) {
  const act = useGameStore((s) => s.act);
  const tier = useGameStore((s) => s.tier);
  const setAct = useGameStore((s) => s.setAct);
  const setTier = useGameStore((s) => s.setTier);
  const resetPacket = useGameStore((s) => s.resetPacket);
  const presenterMode = useGameStore((s) => s.presenterMode);
  const togglePresenterMode = useGameStore((s) => s.togglePresenterMode);
  const error = useGameStore((s) => s.error);

  const [sceneOpen, setSceneOpen] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);

  useEffect(() => {
    setAct(parseAct(actParam));
  }, [actParam, setAct]);

  useEffect(() => {
    setTier(parseTier(tierParam));
  }, [tierParam, setTier]);

  // Keep URL in sync when tier changes from drawer
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tier", String(tier));
    window.history.replaceState({}, "", url.toString());
  }, [tier]);

  const onSend = useCallback(() => {
    const w = window as unknown as {
      __actPlaintextSend?: () => void;
      __actCaesarSend?: () => void;
      __actRsaSend?: () => void;
      __actShorSend?: () => void;
    };
    if (act === 1) w.__actPlaintextSend?.();
    if (act === 2) w.__actCaesarSend?.();
    if (act === 3) w.__actRsaSend?.();
    if (act === 4) w.__actShorSend?.();
  }, [act]);

  const onReset = useCallback(() => {
    resetPacket();
  }, [resetPacket]);

  const ActComponent = useMemo(() => {
    switch (act) {
      case 1:
        return ActPlaintextWithHotkeys;
      case 2:
        return ActCaesar;
      case 3:
        return ActRSA;
      case 4:
        return ActShor;
      default:
        return ActPlaintextWithHotkeys;
    }
  }, [act]);

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-2">
        <div className="min-w-0">
          <p className="font-display text-[10px] uppercase tracking-[0.2em] text-accent-teal">
            RSA → Shor
          </p>
          <h1 className="truncate font-display text-base font-bold sm:text-lg">
            Act {act} · {ACT_TITLES[act]}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => {
              setMathOpen(false);
              setSceneOpen(true);
            }}
          >
            Scene
          </button>
          <button
            type="button"
            className={clsx(
              "btn-ghost text-xs",
              mathOpen && "border-accent-amber text-accent-amber",
            )}
            onClick={() => {
              setSceneOpen(false);
              setMathOpen(true);
            }}
          >
            Math {tier}
          </button>
          <button
            type="button"
            onClick={togglePresenterMode}
            className={clsx(
              "rounded-lg border px-2.5 py-1.5 text-[10px] uppercase tracking-wider transition sm:text-xs",
              presenterMode
                ? "border-accent-amber bg-accent-amber/20 text-accent-amber"
                : "border-stage-border text-stage-muted hover:text-accent-teal",
            )}
          >
            {presenterMode ? "Exit" : "Presenter"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-2 shrink-0 rounded-lg border border-actor-hacker/50 bg-actor-hacker/10 px-3 py-1.5 text-xs text-actor-hacker">
          {error}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <ActComponent />
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-stage-border pt-1.5 text-[10px] text-stage-muted">
        <PresenterHotkeys onSend={onSend} onReset={onReset} />
        {!presenterMode && (
          <span className="hidden sm:inline">
            /act/{act}?tier={tier}
          </span>
        )}
      </footer>

      <ConfigDrawer
        open={sceneOpen}
        onClose={() => setSceneOpen(false)}
        title="Scene · acts"
        side="left"
      >
        <p className="mb-3 text-sm text-stage-muted">
          Pick which story beat to play. Hotkeys: ← →
        </p>
        <ActNav vertical onNavigate={() => setSceneOpen(false)} />
      </ConfigDrawer>

      <ConfigDrawer
        open={mathOpen}
        onClose={() => setMathOpen(false)}
        title="Math · blackboard"
        side="right"
        size="lg"
      >
        <p className="mb-3 text-sm text-stage-muted">
          Depth of explanation. Hotkeys: 1 / 2 / 3
        </p>
        <TierToggle vertical />
        <div className="mt-5 pb-6">
          <Blackboard />
        </div>
      </ConfigDrawer>
    </div>
  );
}

function ActPlaintextWithHotkeys() {
  const selectedChar = useGameStore((s) => s.selectedChar);
  const setPacketState = useGameStore((s) => s.setPacketState);
  const setMessagePayload = useGameStore((s) => s.setMessagePayload);
  const setError = useGameStore((s) => s.setError);

  const send = useCallback(async () => {
    if (!selectedChar) {
      setError("Pick a letter first.");
      return;
    }
    setError(null);
    setPacketState("sending");
    try {
      const { api } = await import("@/lib/api");
      const res = await api.plaintext(selectedChar);
      setMessagePayload({
        char: res.char,
        value: res.value,
        encrypted: false,
        readableByHacker: true,
      });
      // Hold at Ale, travel to tap, pause while Hacker reads, continue to Brayan
      await new Promise((r) => setTimeout(r, PACKET_TIMINGS.leaveAle));
      setPacketState("intercepted");
      await new Promise((r) =>
        setTimeout(r, PACKET_TIMINGS.toHacker + PACKET_TIMINGS.holdTap),
      );
      setPacketState("delivered");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
      setPacketState("idle");
    }
  }, [selectedChar, setPacketState, setMessagePayload, setError]);

  useEffect(() => {
    (window as unknown as { __actPlaintextSend?: () => void }).__actPlaintextSend =
      send;
    return () => {
      delete (window as unknown as { __actPlaintextSend?: () => void })
        .__actPlaintextSend;
    };
  }, [send]);

  return <ActPlaintext onSend={send} />;
}
