"use client";
import { tOptional, localize, useLocale } from "@/i18n";

import clsx from "clsx";
import { LanguageSwitch } from "./LanguageSwitch";

import { gameAudio, useAudio } from "@/game/audio";

export function MuteButton({ className }: { className?: string }) {
  useLocale((state) => state.locale);
  const muted = useAudio((s) => s.muted);
  const unlocked = useAudio((s) => s.unlocked);

  return (
    <div className="flex items-center gap-2"><LanguageSwitch /><button
      type="button"
      aria-label={tOptional(muted ? "Unmute sound" : "Mute sound")}
      title={tOptional(muted ? "Unmute" : "Mute")}
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
      {localize(muted ? "Sound off" : "Sound on")}
    </button></div>
  );
}
