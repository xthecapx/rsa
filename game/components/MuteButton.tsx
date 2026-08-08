"use client";

import clsx from "clsx";

import { gameAudio, useAudio } from "@/game/audio";

export function MuteButton({ className }: { className?: string }) {
  const muted = useAudio((s) => s.muted);
  const unlocked = useAudio((s) => s.unlocked);

  return (
    <button
      type="button"
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      title={muted ? "Unmute" : "Mute"}
      onClick={() => {
        if (!unlocked) {
          void gameAudio.unlock().then(() => gameAudio.setMuted(false));
          return;
        }
        gameAudio.toggleMute();
      }}
      className={clsx(
        "kenney-btn kenney-btn-blue px-3 py-2 text-[9px] uppercase tracking-widest text-[#e8f4f8]",
        className,
      )}
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}
