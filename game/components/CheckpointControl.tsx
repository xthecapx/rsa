"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { t, useLocale } from "@/i18n";
import { CHECKPOINT_TOWNS, checkpoint, currentCheckpoint } from "@/game/checkpoints";
import { useTown } from "@/game/town";
import { useProgress } from "@/game/progress";
import { useKnowledge } from "@/game/knowledge";
import { useGame } from "@/game/state";
import { useMedals } from "@/game/medals";

const STAGES = ["Town arrival", "All five neighbor lessons complete", "Town challenge complete · next road open"];

export function CheckpointControl({ disabled: parentDisabled, onOpenChange }: { disabled: boolean; onOpenChange: (open: boolean) => void }) {
  useLocale((state) => state.locale);
  const executing = useGame((state) => state.operations > 0 || state.phase === "busy" || !!state.busyLabel);
  const disabled = parentDisabled || executing;
  const location = useTown((state) => state.location);
  const cards = useKnowledge((state) => state.cards);
  const completed = useProgress((state) => state.completed);
  const earned = useMedals((state) => state.earned);
  const labFrom = useTown((state) => state.labFrom);
  const code = currentCheckpoint(location, cards, completed, earned, labFrom);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = useId();
  function close() { setOpen(false); onOpenChange(false); trigger.current?.focus(); }
  useEffect(() => { if (open) dialog.current?.querySelector<HTMLInputElement>("input")?.focus(); }, [open]);
  function restore(value: string) {
    if (disabled) return;
    if (!checkpoint(value)) { setError(true); return; }
    close();
    window.dispatchEvent(new CustomEvent("quantum-restore-checkpoint", { detail: value }));
  }
  return <>
    <button ref={trigger} type="button" className="btn-ghost text-xs" disabled={disabled} aria-label={t("Save progress")}
      title={t("Save progress")} onClick={() => { setOpen(true); setInput(""); setError(false); onOpenChange(true); }}>
      <span aria-hidden="true">▣</span><span className="ml-1 hidden sm:inline">{t("Save progress")}</span>
    </button>
    {open && createPortal(<div className="viewport-overlay z-[100] grid place-items-center bg-black/70 p-3" onPointerDown={(event) => event.stopPropagation()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title} className="textbox max-h-full w-full max-w-lg space-y-4 overflow-y-auto p-5 font-body"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") { event.preventDefault(); close(); }
          if (event.key === "Tab") {
            const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])") ?? []);
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <div className="flex items-center justify-between gap-2"><h2 id={title} className="text-accent-amber">{t("Save progress")}</h2><button type="button" className="btn-ghost text-sm" onClick={close}>{t("Close")}</button></div>
        <p className="text-sm text-stage-muted">{t("Keep this short code before restarting or changing backends. Enter it in either version of the game to return to this checkpoint.")}</p>
        <label className="block text-sm text-accent-teal">{t("Your checkpoint code")}
          <input className="mt-2 w-full bg-stage-bg p-3 font-mono text-lg text-accent-amber" readOnly value={code} onFocus={(event) => event.target.select()} />
        </label>
        <p className="text-sm text-stage-muted">{t(checkpoint(code)!.title)} · {t(code === "qt1" ? "Quantum Town replay hub" : STAGES[checkpoint(code)!.stage - 1])}</p>
        <p className="text-xs text-stage-muted">{t("Codes restore town milestones: completed neighbor lessons, challenges, and earlier town badges. Unfinished conversations, circuits, and measurement results are not included.")}</p>
        <p className="text-xs text-stage-muted">{t("These are lesson shortcuts, not exact saves. Restoring a challenge-complete code also grants that town’s optional knowledge cards and town badge.")}</p>
        <div className="space-y-2">
          <label className="block text-sm">{t("Restore a checkpoint")}
            <input className="mt-2 w-full border border-stage-border bg-stage-bg p-3 text-base" value={input} placeholder="ct2" autoCapitalize="none" autoCorrect="off" maxLength={12}
              onChange={(event) => { setInput(event.target.value); setError(false); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); restore(input); } }} />
          </label>
          {error && <p role="alert" className="text-sm text-accent-amber">{t("Unknown checkpoint code. Choose one below or enter a code such as ct2.")}</p>}
          <button type="button" className="btn-primary text-sm" disabled={!input.trim() || disabled} onClick={() => restore(input)}>{t("Restore checkpoint")}</button>
        </div>
        <p className="text-xs text-stage-muted">{t("Restoring keeps any progress already earned in this run. No circuit is submitted.")}</p>
        <h3 className="text-sm text-accent-teal">{t("Quick lesson checkpoints")}</h3>
        <div className="space-y-3">{CHECKPOINT_TOWNS.map((town) => <section key={town.prefix}>
          <h4 className="mb-1 text-sm">{t(town.title)}</h4>
          <div className="grid gap-1">{STAGES.map((stage, index) => <button key={stage} type="button" className="btn-ghost flex items-center gap-3 p-2 text-left text-xs" disabled={disabled}
            onClick={() => restore(`${town.prefix}${index + 1}`)}><code className="text-accent-amber">{town.prefix}{index + 1}</code><span>{t(stage)}</span></button>)}</div>
        </section>)}</div>
        <button type="button" className="btn-ghost w-full text-left text-sm" disabled={disabled} onClick={() => restore("qt1")}><code className="text-accent-amber">qt1</code> · {t("Quantum Town replay hub")}</button>
      </div>
    </div>, document.body)}
  </>;
}
