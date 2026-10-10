"use client";

import { useRef, useState } from "react";
import {
  PuzzleDragDrop,
  PuzzlePiece,
  PuzzleSlot,
  type PuzzleControls,
} from "./PuzzleDragDrop";
import type {
  CryptoAid,
  CryptoStep,
  DialStep,
  KnowledgeCard,
} from "@/content/knowledge";
import { caesar, letterNumber, numberLetter, slotsSolved } from "@/game/crypto";
import { gameAudio } from "@/game/audio";
import { fill } from "@/game/interpolate";
import { calcInput } from "@/game/calc";
import { useCalculator } from "./Calculator";
import { CipherPracticeFlow } from "./CipherPracticeFlow";
import { CircuitActions } from "./CircuitActions";
import { t, useLocale } from "@/i18n";

const ALPHABET = Array.from({ length: 26 }, (_, i) => numberLetter(i + 1));

/** The picture beside the slots, so the math the player needs is on screen. */
function Aid({ aid }: { aid: CryptoAid }) {
  if (aid.kind === "table")
    return (
      <div className="crypto-table" aria-label={t("The A1Z26 table")}>
        {ALPHABET.map((letter) => (
          <span key={letter}>
            <b>{letter}</b>
            {letterNumber(letter)}
          </span>
        ))}
      </div>
    );
  if (aid.kind === "wheel")
    return (
      <div
        className="crypto-table"
        aria-label={`${t("Caesar wheel")} · +${aid.key}`}
      >
        {ALPHABET.map((letter) => (
          <span key={letter}>
            <b>{letter}</b>
            {caesar(letter, aid.key)}
          </span>
        ))}
      </div>
    );
  if (aid.kind === "clock")
    return (
      <div
        className="crypto-clock"
        aria-label={`${t("Clock face")} · mod ${aid.n}`}
      >
        {Array.from({ length: aid.n }, (_, i) => {
          const angle = (i / aid.n) * 2 * Math.PI;
          return (
            <span
              key={i}
              style={{
                left: `${50 + 40 * Math.sin(angle)}%`,
                top: `${50 - 40 * Math.cos(angle)}%`,
              }}
            >
              {i}
            </span>
          );
        })}
        <em>mod {aid.n}</em>
      </div>
    );
  return (
    <p className="crypto-powers" aria-label={t("Powers")}>
      {Array.from({ length: aid.upTo + 1 }, (_, x) => (
        <span key={x}>
          {aid.base}
          <sup>{x}</sup> = {aid.base ** x}
        </span>
      ))}
      <span className="text-stage-muted">mod {aid.n}</span>
    </p>
  );
}

/**
 * Cipher Town's bench: drag number and letter tiles into the slots. Tiles
 * never run out, so the same answer can go in two slots. Checking marks each
 * wrong slot and leaves the right ones in place.
 */
export function CryptoBench({
  step,
  onSolved,
  onEdited,
  reference,
}: {
  step: CryptoStep;
  onSolved: () => void;
  onEdited?: () => void;
  reference?: KnowledgeCard;
}) {
  useLocale((state) => state.locale);
  const [placed, setPlaced] = useState<(string | null)[]>(() =>
    step.slots.map(() => null),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);
  const puzzle = useRef<PuzzleControls>(null);

  function place(index: number, tile = selected) {
    setChecked(false);
    setDone(false);
    onEdited?.();
    if (!tile) {
      if (placed[index])
        setPlaced(placed.map((value, i) => (i === index ? null : value)));
      return;
    }
    setPlaced(placed.map((value, i) => (i === index ? tile : value)));
    setSelected(null);
  }
  function check() {
    setChecked(true);
    if (slotsSolved(step.slots, placed)) {
      setDone(true);
      gameAudio.playSynth("chime");
      onSolved();
    } else gameAudio.playSfx("error");
  }
  const wrong = checked
    ? step.slots.filter((slot, i) => placed[i] !== slot.answer).length
    : 0;

  return (
    <CipherPracticeFlow solved={done}>
      {(view) => (
        <>
          {view === "math" && (
            <CryptoReference step={step} reference={reference} />
          )}
          {view === "results" && (
            <section
              className="measurement-result space-y-2"
              aria-label={t("Checked answers")}
            >
              <p className="text-accent-teal">{t("Checked answers")}</p>
              {step.slots.map((slot, i) => (
                <p key={i} className="font-mono">
                  {slot.ask} → {placed[i]}
                </p>
              ))}
              <p>
                {t(
                  "These are classical calculations, not quantum measurements.",
                )}
              </p>
            </section>
          )}
          {view === "practice" && (
            <PuzzleDragDrop
              wholeBlockDrag
              controlsRef={puzzle}
              labels={Object.fromEntries(step.tray.map((tile) => [tile, tile]))}
              targets={Object.fromEntries(
                step.slots.map((slot, i) => [`slot-${i}`, slot.ask]),
              )}
              onPlace={(slot, tile) => place(Number(slot.slice(5)), tile)}
              renderPreview={(tile) => (
                <span className="crypto-tile">{tile}</span>
              )}
            >
              <div className="coin-challenge space-y-3">
                <p>{fill(t(step.text), step.vars ?? {})}</p>
                {step.aid && (
                  <details>
                    <summary>{t("Open the reference")}</summary>
                    <Aid aid={step.aid} />
                  </details>
                )}
                <div className="coin-block-tray" aria-label={t("Tiles")}>
                  {step.tray.map((tile) => (
                    <PuzzlePiece
                      key={tile}
                      id={tile}
                      label={tile}
                      className="coin-operation-tool"
                      selected={selected === tile}
                      onSelect={() =>
                        setSelected(selected === tile ? null : tile)
                      }
                    >
                      <span className="crypto-tile">{tile}</span>
                    </PuzzlePiece>
                  ))}
                </div>
                <div
                  className={`circuit-workspace cipher-tile-workspace ${done ? "" : "has-actions"}`}
                >
                  <div
                    className="crypto-slots"
                    role="group"
                    aria-label={t("Slots")}
                  >
                    {step.slots.map((slot, i) => (
                      <div key={i} className="crypto-row">
                        <span className="crypto-ask">
                          {slot.ask}
                          {calcInput(slot.ask) !== null && (
                            <button
                              type="button"
                              className="crypto-calc"
                              aria-label={`${t("Work it out in the calculator")}: ${slot.ask}`}
                              title={t("Work it out in the calculator")}
                              onClick={() => {
                                gameAudio.playSfx("select");
                                useCalculator
                                  .getState()
                                  .load(calcInput(slot.ask)!);
                              }}
                            >
                              🧮
                            </button>
                          )}
                        </span>
                        <span aria-hidden="true">→</span>
                        <PuzzleSlot
                          id={`slot-${i}`}
                          onSelect={() => place(i)}
                          label={`${slot.ask}: ${placed[i] ?? t("Empty")}`}
                          className={`crypto-slot ${placed[i] ? "filled" : ""} ${checked && placed[i] !== slot.answer ? "wrong" : ""} ${checked && placed[i] === slot.answer ? "right" : ""}`}
                        >
                          {placed[i] ?? "?"}
                        </PuzzleSlot>
                      </div>
                    ))}
                  </div>
                  {!done && (
                    <CircuitActions
                      controlsLabel="Tile controls"
                      clearLabel="Clear tiles"
                      onClear={() => {
                        puzzle.current?.resetInteraction();
                        setPlaced(step.slots.map(() => null));
                        setSelected(null);
                        setChecked(false);
                        onEdited?.();
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-stage-muted">
                  {t("Tap a placed tile with nothing selected to remove it.")}
                </p>
                {!done && (
                  <button
                    className="btn-primary"
                    onClick={check}
                    disabled={placed.some((value) => value === null)}
                  >
                    {t("Check")}
                  </button>
                )}
                {wrong > 0 && (
                  <p role="status" className="text-actor-hacker">
                    {t(
                      "Some tiles don’t fit yet. The red slots need another look.",
                    )}
                  </p>
                )}
              </div>
            </PuzzleDragDrop>
          )}
        </>
      )}
    </CipherPracticeFlow>
  );
}

/** Turn the wheel back one letter at a time until the ciphertext reads as a word. */
export function DialBench({
  step,
  onSolved,
  reference,
}: {
  step: DialStep;
  onSolved: () => void;
  reference?: KnowledgeCard;
}) {
  useLocale((state) => state.locale);
  const [shift, setShift] = useState(0);
  const [done, setDone] = useState(false);
  const plain = caesar(step.cipher, -shift);
  function turn(by: number) {
    if (done) return;
    const next = (shift + by + 26) % 26;
    setShift(next);
    gameAudio.playSfx("select");
    if (next === step.key) {
      setDone(true);
      gameAudio.playSynth("chime");
      onSolved();
    }
  }
  return (
    <CipherPracticeFlow solved={done}>
      {(view) => (
        <>
          {view === "math" && (
            <CryptoReference step={step} reference={reference} />
          )}
          {view !== "math" && (
            <div
              className={`coin-challenge space-y-3 ${view === "results" ? "measurement-result" : ""}`}
            >
              <p>{fill(t(step.text), step.vars ?? {})}</p>
              <div className="crypto-dial" aria-live="polite">
                <p>
                  <span className="text-stage-muted">{t("Ciphertext")}</span>{" "}
                  <b className="crypto-word">{step.cipher}</b>
                </p>
                <p>
                  <span className="text-stage-muted">{t("Shift back by")}</span>{" "}
                  <b>{shift}</b>
                </p>
                <p>
                  <span className="text-stage-muted">{t("Reads")}</span>{" "}
                  <b className={`crypto-word ${done ? "right" : ""}`}>
                    {plain}
                  </b>
                </p>
              </div>
              {view === "practice" && (
                <div className="flex gap-2">
                  <button
                    className="btn-ghost"
                    onClick={() => turn(-1)}
                    disabled={done}
                    aria-label={t("Turn the wheel back")}
                  >
                    ◀
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => turn(1)}
                    disabled={done}
                    aria-label={t("Turn the wheel forward")}
                  >
                    ▶
                  </button>
                </div>
              )}
              <p className="text-xs text-stage-muted">
                {t(
                  "Each turn tries one key. A Caesar wheel only has 25 that change anything.",
                )}
              </p>
            </div>
          )}
        </>
      )}
    </CipherPracticeFlow>
  );
}

function CryptoReference({
  step,
  reference,
}: {
  step: CryptoStep | DialStep;
  reference?: KnowledgeCard;
}) {
  return (
    <section className="campus-control-card space-y-3">
      <p className="text-accent-teal">{t("Classical tools")}</p>
      {reference && (
        <>
          <h3>{t(reference.title)}</h3>
          <p>{t(reference.text)}</p>
          <p className="font-mono text-accent-amber">{t(reference.formula)}</p>
        </>
      )}
      <p>{fill(t(step.text), step.vars ?? {})}</p>
      {step.kind === "crypto" && step.aid && <Aid aid={step.aid} />}
      <p className="text-sm text-stage-muted">
        {t("These are classical calculations, not quantum measurements.")}
      </p>
    </section>
  );
}
