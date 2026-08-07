"use client";

import { useEffect, useRef, useState } from "react";

import { submitReport } from "@/game/dialog";
import { useGame } from "@/game/state";

/**
 * Handing the plaintext to the client. Typing it out is the point: the player
 * has to have actually read the message, not just watched a tool run.
 */
export function ReportForm() {
  const capture = useGame((s) => s.capture);
  const recovered = useGame((s) => s.vars.recovered);
  const reportError = useGame((s) => s.reportError);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!answer.trim() || sending) return;
    setSending(true);
    try {
      await submitReport(answer);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void send(event)}
      className="panel flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="shrink-0 border-b-2 border-stage-border px-3 py-2 text-[10px] uppercase tracking-widest text-actor-boss">
        Report to the client
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <p className="text-[11px] leading-relaxed text-stage-muted">
          He wants the words, not the numbers. Type exactly what Ale sent.
        </p>

        {capture && (
          <div className="border-2 border-stage-border bg-stage-bg/60 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-widest text-stage-muted">
              Off the wire
            </p>
            <p className="mt-1 break-all font-mono text-[12px] text-accent-amber">
              {capture.payload}
            </p>
          </div>
        )}

        {recovered && (
          <p className="text-[10px] text-stage-muted">
            Your notes read{" "}
            <span className="font-mono text-actor-brayan">{recovered}</span>.
          </p>
        )}

        <input
          ref={field}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="The message"
          autoComplete="off"
          spellCheck={false}
          className="w-full border-2 border-stage-border bg-stage-bg px-2.5 py-2 font-mono text-[14px] uppercase tracking-widest text-[#e8f4f8] outline-none focus:border-accent-amber"
        />

        {reportError && (
          <p className="text-[11px] leading-relaxed text-actor-hacker">
            {reportError}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t-2 border-stage-border p-2">
        <button
          type="submit"
          disabled={!answer.trim() || sending}
          className="w-full border-2 border-accent-amber px-3 py-2 text-[11px] text-accent-amber transition-colors hover:bg-accent-amber/15 disabled:cursor-not-allowed disabled:border-stage-border disabled:text-stage-muted"
        >
          {sending ? "Saying it out loud..." : "Tell him"}
        </button>
      </div>
    </form>
  );
}
