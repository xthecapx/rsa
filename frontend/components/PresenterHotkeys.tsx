"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore, type ActNumber, type Tier } from "@/store/game";

interface PresenterHotkeysProps {
  onSend?: () => void;
  onReset?: () => void;
}

export default function PresenterHotkeys({
  onSend,
  onReset,
}: PresenterHotkeysProps) {
  const router = useRouter();
  const act = useGameStore((s) => s.act);
  const tier = useGameStore((s) => s.tier);
  const setAct = useGameStore((s) => s.setAct);
  const setTier = useGameStore((s) => s.setTier);
  const togglePresenterMode = useGameStore((s) => s.togglePresenterMode);
  const presenterMode = useGameStore((s) => s.presenterMode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && act > 1) {
        e.preventDefault();
        const next = (act - 1) as ActNumber;
        setAct(next);
        router.push(`/act/${next}?tier=${tier}`);
      }
      if (e.key === "ArrowRight" && act < 4) {
        e.preventDefault();
        const next = (act + 1) as ActNumber;
        setAct(next);
        router.push(`/act/${next}?tier=${tier}`);
      }
      if (e.key === "1") setTier(1);
      if (e.key === "2") setTier(2);
      if (e.key === "3") setTier(3);
      if (e.key === " " && onSend) {
        e.preventDefault();
        onSend();
      }
      if (e.key === "r" || e.key === "R") onReset?.();
      if (e.key === "p" || e.key === "P") togglePresenterMode();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    act,
    tier,
    setAct,
    setTier,
    togglePresenterMode,
    onSend,
    onReset,
    router,
  ]);

  if (presenterMode) return null;

  return (
    <div className="hidden text-xs text-stage-muted lg:block">
      <span className="font-display uppercase tracking-wider">Hotkeys</span>:{" "}
      ← → acts · 1/2/3 tier · Space send · R reset · P presenter
    </div>
  );
}
