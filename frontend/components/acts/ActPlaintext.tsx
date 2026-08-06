"use client";

import { getLevelCopy } from "@/content/levels";
import { useGameStore } from "@/store/game";
import Keyboard from "@/components/Keyboard";
import Stage from "@/components/Stage";

interface ActPlaintextProps {
  onSend?: () => void;
}

export default function ActPlaintext({ onSend }: ActPlaintextProps) {
  const tier = useGameStore((s) => s.tier);
  const selectedChar = useGameStore((s) => s.selectedChar);
  const setError = useGameStore((s) => s.setError);
  const packetState = useGameStore((s) => s.packetState);
  const copy = getLevelCopy(1, tier);
  const busy = packetState === "sending" || packetState === "intercepted";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <header className="shrink-0">
        <h2 className="font-display text-base font-bold text-accent-amber sm:text-lg">
          {copy.headline}
        </h2>
        <p className="text-xs text-stage-muted sm:text-sm">{copy.subhead}</p>
      </header>

      <Stage />

      <div className="shrink-0 space-y-2">
        <Keyboard compact onSelect={() => setError(null)} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedChar || busy}
            onClick={onSend}
          >
            {busy ? "On the cable…" : copy.sendLabel}
          </button>
          {copy.hint && (
            <span className="text-xs text-stage-muted">{copy.hint}</span>
          )}
          <span className="text-xs text-stage-muted">
            Open <strong className="text-accent-teal">Math</strong> for the blackboard.
          </span>
        </div>
      </div>
    </div>
  );
}
