"use client";
import { useEffect, useRef, useState } from "react";
import { CAMPUS_EXHIBITS, type CampusActivityId } from "@/content/campus";
import type { Speaker } from "@/content/types";
import { CAMPUS_STORIES } from "@/content/campusStories";
import { useCampus, campusSession } from "@/game/campus";
import {
  evidenceFor,
  evidenceLabel,
  investigationFor,
  investigationReady,
  rotationPair,
  type CampusRun,
} from "@/game/campusJourney";
import { t, useLocale } from "@/i18n";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { AngleDial } from "./AngleDial";
import { MedalReveal } from "./MedalCase";

export function CampusEvidenceCard({
  id,
  run,
  selected,
  onSelect,
}: {
  id: CampusActivityId;
  run: CampusRun;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const result = run.result;
  const body = (
    <>
      <strong className="text-accent-teal">
        {t(evidenceLabel(id, run.key))}
      </strong>
      <span className="block text-xs text-stage-muted">
        {result.backend} ·{" "}
        {t(
          result.kind === "noise"
            ? "Noise-model simulator"
            : result.source === "hardware"
              ? "Physical QPU"
              : result.kind === "ideal"
                ? "Ideal simulator"
                : "Simulator",
        )}{" "}
        · {result.shots} {t("shots")}
      </span>
      <span className="mt-2 block font-mono text-sm">
        {Object.entries(result.counts)
          .map(([bit, count]) => `${bit}: ${count}`)
          .join(" · ")}
      </span>
      {run.settings && id === "rotations" && (
        <span className="block text-sm">
          R{run.settings.axis}(
          {Number(((run.settings.angle * 180) / Math.PI).toFixed(1))}°)
          {run.settings.inverse ? " → R(−θ)" : ""}
        </span>
      )}
      {onSelect && (
        <span className="mt-2 block text-xs">
          {t(selected ? "Evidence selected" : "Select this evidence")}
        </span>
      )}
    </>
  );
  return onSelect ? (
    <button
      className="campus-evidence-card text-left"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {body}
    </button>
  ) : (
    <section className="campus-evidence-card">{body}</section>
  );
}

export function CampusConversation({
  id,
  speaker,
  completed,
  onLater,
  onOpen,
  onFinish,
}: {
  id: CampusActivityId;
  speaker: Speaker;
  completed: boolean;
  onLater: () => void;
  onOpen: (guided: boolean) => void;
  onFinish: () => void;
}) {
  useLocale((s) => s.locale);
  const store = useCampus();
  const session = store.sessions[id] ?? campusSession();
  const j = session.journey;
  const story = CAMPUS_STORIES[id];
  const stage = investigationFor(id, session);
  const [reference, setReference] = useState(false);
  const [repairFeedback, setRepairFeedback] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setRepairFeedback(false);
    frame.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [j.phase, j.investigation]);
  const event = (value: Parameters<typeof store.event>[1]) =>
    store.event(id, value);
  const ready = investigationReady(id, session);
  const prediction =
    j.prediction === "unsure"
      ? { label: "I’m not sure yet" }
      : story.predictions.find((p) => p.id === j.prediction);
  const answer = stage.options.find((o) => o.id === j.answerId);
  const pair = id === "rotations" ? rotationPair(session) : null;
  const evidence =
    id === "rotations"
      ? pair
        ? [pair.first, pair.inverse]
        : []
      : stage.keys
          .map((key) => evidenceFor(id, session, key))
          .filter((r): r is CampusRun => !!r);
  const selected = stage.select.every((key) => j.selected.includes(key));
  const done = completed;
  const phase = done ? "complete" : j.phase === "complete" ? "intro" : j.phase;
  const text = reference
    ? (CAMPUS_EXHIBITS.find((e) => e.id === id)?.explain ?? stage.clues[0])
    : phase === "intro"
      ? story.intro
      : phase === "prediction"
        ? story.prediction
        : phase === "investigate"
          ? stage.question
          : phase === "discuss"
            ? stage.prompt
            : phase === "apply"
              ? story.application.prompt
              : story.payoff;
  const apply = (key: string, value: string | number) =>
    event({ type: "application", key, value });
  const button = (label: string, action: () => void, primary = false) => (
    <button
      key={label}
      type="button"
      className={primary ? "btn-primary" : "btn-ghost"}
      onClick={action}
    >
      {t(label)}
    </button>
  );
  const finish = () => {
    setRepairFeedback(true);
    onFinish();
  };
  const batch =
    id === "arcade" ? evidenceFor(id, session, "batch")?.result : undefined;
  let actions;
  if (reference)
    actions = (
      <>
        {button("Back to our investigation", () => setReference(false), true)}
        {button("Later", onLater)}
      </>
    );
  else if (phase === "intro")
    actions = (
      <>
        {button("Let’s investigate", () => event({ type: "begin" }), true)}
        {button("What should I look for?", () => setReference(true))}
        {button("Later", onLater)}
      </>
    );
  else if (phase === "prediction")
    actions = (
      <>
        {story.predictions.map((p) =>
          button(p.label, () => event({ type: "predict", id: p.id })),
        )}
        {button("I’m not sure; let’s test it", () =>
          event({ type: "predict", id: "unsure" }),
        )}
        {button("Later", onLater)}
      </>
    );
  else if (phase === "investigate")
    actions = (
      <>
        {ready
          ? button(
              "Discuss our evidence",
              () => event({ type: "return" }),
              true,
            )
          : button("Open the experiment", () => onOpen(true), true)}
        {button("Give me a clue", () => event({ type: "hint" }))}
        {button("Later", onLater)}
      </>
    );
  else if (phase === "discuss")
    actions = (
      <>
        {stage.options.map((o) => (
          <button
            key={o.id}
            className="btn-ghost text-left"
            disabled={!ready || !selected}
            onClick={() => event({ type: "answer", id: o.id })}
          >
            {t(o.label)}
          </button>
        ))}
        {button("Test another idea", () => onOpen(true))}
        {button("Give me a clue", () => event({ type: "hint" }))}
        {button("Later", onLater)}
      </>
    );
  else if (phase === "apply")
    actions = (
      <>
        <button
          className="btn-primary"
          disabled={
            !story.application.slots.every(
              (slot) => j.application[slot.id] !== undefined,
            ) ||
            (id === "arcade" && j.application.frequency === undefined) ||
            (id === "rotations" &&
              (j.application.axis === undefined ||
                j.application.angle === undefined))
          }
          onClick={finish}
        >
          {t(
            id === "festival"
              ? j.investigation === 2
                ? "Open the Festival"
                : "Finish this repair"
              : "Put it into practice",
          )}
        </button>
        {button("Give me a clue", () => event({ type: "hint" }))}
        {button("Later", onLater)}
      </>
    );
  else
    actions = (
      <>
        {button("Experiment freely", () => onOpen(false), true)}
        {button("Tell me more", () => setReference(true))}
        {button("Keep exploring", onLater)}
      </>
    );
  const evidenceCards = (
    <div
      className="mt-4 grid gap-2 sm:grid-cols-2"
      aria-label={t("Returned experiment evidence")}
    >
      {evidence.map((run, i) => (
        <CampusEvidenceCard
          key={`${run.key}:${i}`}
          id={id}
          run={run}
          selected={j.selected.includes(run.key)}
          onSelect={
            phase === "discuss" && stage.select.length
              ? () => event({ type: "select", key: run.key })
              : undefined
          }
        />
      ))}
    </div>
  );
  return (
    <DialogueFrame
      className="max-w-4xl campus-conversation"
      pageKey={`${id}:${phase}:${j.investigation}`}
      actions={
        <div ref={frame} className="flex flex-wrap gap-2">
          {actions}
        </div>
      }
    >
      <DialogueLine speaker={speaker}>{t(text)}</DialogueLine>
      {prediction && (phase === "investigate" || phase === "discuss") && (
        <p className="mt-3 text-sm text-stage-muted">
          {t("Your prediction: {prediction}").replace(
            "{prediction}",
            t(prediction.label),
          )}
        </p>
      )}
      {!reference && j.hints > 0 && phase !== "complete" && (
        <p className="campus-clue mt-3" role="status">
          {t(stage.clues[j.hints - 1])}
        </p>
      )}
      {!reference &&
        (phase === "discuss" || phase === "apply") &&
        evidence.length > 0 &&
        (phase === "apply" && id !== "arcade" && id !== "rotations" ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-accent-teal">
              {t("Review our measurements")}
            </summary>
            {evidenceCards}
          </details>
        ) : (
          evidenceCards
        ))}
      {!reference && phase === "discuss" && stage.select.length > 0 && (
        <p className="mt-2 text-sm text-stage-muted">
          {t("Choose the evidence cards that support your explanation.")}
        </p>
      )}
      {!reference && answer && (phase === "discuss" || phase === "apply") && (
        <p className="mt-3 text-accent-teal" role="status">
          {t(answer.feedback)}
        </p>
      )}
      {!reference && phase === "apply" && (
        <section
          className="campus-repair-board mt-4 space-y-4"
          aria-label={t("Apply your discovery")}
        >
          {story.application.slots.map((slot) => (
            <fieldset key={slot.id} className="space-y-2">
              <legend className="text-sm text-accent-teal">
                {t(slot.label)}
              </legend>
              <div className="flex flex-wrap gap-2">
                {slot.options.map((o) => (
                  <button
                    key={o.id}
                    className="btn-ghost text-left"
                    aria-pressed={j.application[slot.id] === o.id}
                    onClick={() => apply(slot.id, o.id)}
                  >
                    {t(o.label)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {batch && (
            <fieldset className="space-y-2">
              <legend>
                {t("Complete the frequency label for outcome 0.")}
              </legend>
              <p className="font-mono">
                {t("Frequency")} = ? / {batch.shots}
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set([0, batch.shots, batch.counts["0"] ?? 0])]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <button
                      className="btn-ghost"
                      key={n}
                      aria-pressed={j.application.frequency === String(n)}
                      onClick={() => apply("frequency", String(n))}
                    >
                      {n}
                    </button>
                  ))}
              </div>
            </fieldset>
          )}
          {pair?.first.settings && (
            <div className="flex flex-wrap items-start gap-4">
              <fieldset>
                <legend>{t("Repair axis")}</legend>
                <div className="flex gap-2">
                  {["X", "Y", "Z"].map((axis) => (
                    <button
                      key={axis}
                      className="btn-ghost"
                      aria-pressed={j.application.axis === axis}
                      onClick={() => apply("axis", axis)}
                    >
                      {axis}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <p>{t("Repair angle")}</p>
                <AngleDial
                  label="Repair angle dial"
                  value={
                    typeof j.application.angle === "number"
                      ? j.application.angle
                      : 0
                  }
                  onChange={(value) => apply("angle", value)}
                />
              </div>
            </div>
          )}
          {repairFeedback && (
            <p role="status" className="text-accent-amber">
              {t(
                "Check the labels against your evidence. Keep what fits and adjust the rest; no new run is needed.",
              )}
            </p>
          )}
        </section>
      )}
      {done && id === "festival" && <MedalReveal id="quantum-explorer" />}
      {done && id !== "festival" && (
        <p className="mt-3 text-accent-teal" role="status">
          ✓ {t("Discovery added to your field notebook")}
        </p>
      )}
    </DialogueFrame>
  );
}
