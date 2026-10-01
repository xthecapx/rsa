"use client";

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { ACT_NUMBERS, getAct } from "@/content";
import type { ActNumber, Speaker } from "@/content/types";
import { CLIENT_POSITION } from "@/content/town";
import { bus, type Landmark } from "@/engine/bus";
import { useGame } from "@/game/state";
import { captureRsa, restoreRsa, useTown, validCheckpoint } from "@/game/town";
import { invalidateMission, missionGeneration } from "@/game/runtime";
import { interactAt, startAct } from "@/game/dialog";
import { useProgress } from "@/game/progress";
import { useWallet } from "@/game/wallet";
import { syncSuspicionBubbles } from "@/game/suspicion";
import { t } from "@/i18n";
import type { RestartOption } from "./StartOverControl";
import { GameOver } from "./GameOver";
import { LaptopScene } from "./LaptopScene";

/** A conversation the mission opens: the client's offers, or a pause. */
export interface MissionTalk {
  title: string; text: string;
  /** Who speaks; the client unless said otherwise. */
  speaker?: Speaker;
  /** Sentences translated one by one, for text composed from progress. */
  parts?: string[];
  rsaAct?: ActNumber;
  choices: { label: string; act?: ActNumber; done?: boolean; action: () => void }[];
}

const isBusy = () => { const state = useGame.getState(); return state.phase === "busy" || state.operations > 0 || !!state.busyLabel; };

/**
 * The RSA mission on Ale and Brayan's street: starting, pausing, resuming and
 * restarting an act, saving a checkpoint whenever the story settles, and the
 * laptop and result screens. Cipher Town is the mission's home and Quantum
 * Town keeps a replay street; both maps put the street on the same tiles, so
 * one checkpoint resumes in either.
 */
export function useRsaMission({ where, position, readyRef, say, gate, onLater }: {
  where: "town" | "cipher";
  /** Where the player stands in this town's own save slot. */
  position: () => { x: number; y: number };
  /** False while the scene is loading or the player is leaving. */
  readyRef: MutableRefObject<boolean>;
  say: (talk: MissionTalk | null) => void;
  /** A town can hold a job back, e.g. until its gear is bought. */
  gate?: (act: ActNumber) => MissionTalk | null;
  onLater?: () => void;
}) {
  const game = useGame();
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  activeRef.current = active;
  const blocked = game.phase === "busy" || !!game.busyLabel || game.operations > 0 || starting;

  useEffect(() => useGame.subscribe((state) => {
    if (!activeRef.current || startingRef.current) return;
    const saved = useTown.getState();
    if (state.phase === "busy" || state.operations > 0 || state.busyLabel) {
      if (!saved.interrupted) saved.patch({ interrupted: true });
      return;
    }
    const checkpoint = captureRsa();
    if (validCheckpoint(checkpoint)) saved.patch({ checkpoint, interrupted: false });
    if (state.phase === "won") {
      useProgress.getState().complete("rsa", String(state.act));
      // The client pays for each job once; replays don't pay again.
      useWallet.getState().payAct(state.act);
    }
  }), []);

  function activate(on: boolean) { activeRef.current = on; setActive(on); }

  /** Save the checkpoint and step out of the mission; false while the story is mid-step. */
  function pause(): boolean {
    if (activeRef.current && (startingRef.current || isBusy())) return false;
    if (activeRef.current) {
      useTown.getState().patch({ checkpoint: captureRsa(), rsaPosition: { ...position() }, rsaRunning: false, interrupted: false });
      useGame.getState().setLaptopOpen(false);
      activate(false);
      void bus.send({ type: "tapGlow", on: false });
      for (const actor of ["ale", "brayan", "hacker"] as const) void bus.send({ type: "bubble", actor, face: "none" });
    }
    return true;
  }
  async function begin(act: ActNumber) {
    if (startingRef.current || (isBusy() && activeRef.current)) return;
    const held = gate?.(act);
    // Held back (e.g. the next act's gear isn't bought): close the result screen, then let the town say why.
    if (held) { pause(); say(held); return; }
    say(null); startingRef.current = true; setStarting(true); activate(true);
    useTown.getState().patch({ requestedAct: null, rsaRunning: true, rsaFrom: where, interrupted: true, tracked: "rsa", checkpoint: null });
    try {
      const work = startAct(act);
      const token = missionGeneration();
      await work;
      if (!readyRef.current || token !== missionGeneration()) return;
      useTown.getState().patch({ checkpoint: captureRsa(), rsaPosition: { ...position() }, interrupted: false });
    } finally { startingRef.current = false; setStarting(false); }
  }
  async function resume() {
    const saved = useTown.getState();
    if (!validCheckpoint(saved.checkpoint)) return;
    invalidateMission(); restoreRsa(saved.checkpoint);
    say(null); activate(true);
    saved.patch({ requestedAct: null, rsaRunning: true, rsaFrom: where, interrupted: false, tracked: "rsa" });
    if (saved.rsaPosition) await bus.send({ type: "placePlayer", at: saved.rsaPosition, facing: "up" });
    await bus.send({ type: "tapGlow", on: !!saved.checkpoint.flags.listenerActive });
    await syncSuspicionBubbles();
  }
  /** Pick a running mission back up after a reload, in the town it was started in. */
  function restore(): boolean {
    const saved = useTown.getState();
    if (!saved.rsaRunning || saved.rsaFrom !== where || !validCheckpoint(saved.checkpoint) || ["won", "caught"].includes(saved.checkpoint.phase) || saved.interrupted) return false;
    restoreRsa(saved.checkpoint); activate(true);
    return true;
  }
  /** Once the scene is up: relight the tap and the suspicion bubbles for a restored mission. */
  async function sceneReady() {
    await bus.send({ type: "tapGlow", on: activeRef.current && !!useGame.getState().flags.listenerActive });
    if (activeRef.current) await syncSuspicionBubbles();
  }
  async function restart(fromBeginning: boolean) {
    if (activeRef.current && blocked) return;
    const act = fromBeginning ? 1 : useGame.getState().act;
    await bus.send({ type: "placePlayer", at: CLIENT_POSITION, facing: "down" });
    activeRef.current = false;
    useGame.setState((state) => ({ completedActs: fromBeginning ? [] : state.completedActs.filter((number) => number !== act) }));
    // Only the acts restart; the Cipher Badge's record stays.
    for (const number of fromBeginning ? ACT_NUMBERS : [act]) useProgress.getState().reset("rsa", String(number));
    useTown.getState().patch({ checkpoint: null, rsaPosition: null, requestedAct: null, interrupted: false });
    await begin(act);
  }
  /** Forget the mission without saving, for "Start the whole game over". */
  function stop() {
    activate(false); invalidateMission();
    setStarting(false); startingRef.current = false;
  }

  function later() { say(null); onLater?.(); }
  function offer() {
    const saved = useTown.getState();
    const checkpoint = saved.checkpoint;
    const unfinished = validCheckpoint(checkpoint) && checkpoint.phase !== "won" && checkpoint.phase !== "caught";
    const next = ACT_NUMBERS.find((act) => !useProgress.getState().completed.rsa?.includes(String(act))) ?? 1;
    const act = saved.requestedAct ?? (unfinished ? checkpoint.act : next);
    const allDone = ACT_NUMBERS.every((number) => useProgress.getState().completed.rsa?.includes(String(number)));
    say({ title: "Breaking RSA", rsaAct: unfinished ? checkpoint.act : act, text: unfinished ? "Your client is still waiting. Resume the saved mission, or choose another act to start a new attempt." : allDone ? "You recovered every message, from plaintext to RSA. The four medals are yours to keep. Replay any act to sharpen a skill; nothing is lost." : "Ale and Brayan think their messages are secret. Help me recover them, from simple encodings to RSA. You can start now, or try the beginner coin lesson first.",
      choices: [
        ...(unfinished ? [{ label: "Resume", act: checkpoint.act, action: () => void resume() }] : []),
        ...(!unfinished && !allDone ? [{ label: "Start", act, action: () => void begin(act) }] : []),
        ...(unfinished && saved.requestedAct && saved.requestedAct !== checkpoint.act ? [{ label: "Replace saved attempt with selected act", action: () => void begin(act) }] : []),
        { label: "Choose an act to replay", action: () => say({ title: "RSA missions", rsaAct: act, text: "Choose an act. Starting it replaces your saved RSA attempt; your completed lessons stay saved.", choices: [...ACT_NUMBERS.map((number) => ({ label: `Act ${number}: ${getAct(number).title}`, action: () => void begin(number) })), { label: "Later", action: later }] }) },
        { label: "Later", action: later },
      ] });
  }
  /** The player pressed Space by the car, the junction box, Ale or Brayan. */
  function interact(target: Landmark): boolean {
    if (blocked && activeRef.current) return false;
    if (activeRef.current && game.phase === "exploring" && game.pendingTravel?.at === target) { void interactAt(target); return true; }
    if (target === "car") {
      if (activeRef.current) say({ title: "Your client", text: "Finish your current objective, or pause the mission and explore town.", choices: [{ label: "Keep working", action: () => say(null) }, { label: "Pause mission", action: () => { pause(); say(null); } }] });
      else offer();
    } else {
      say({ title: target === "tap" ? "Junction box" : target === "ale" ? "Ale" : "Brayan", text: activeRef.current ? "Your next objective is marked. Follow it to continue the mission." : "The client by the parked car has a mission about the messages on this wire. Talk to them to get started.", choices: [{ label: "Keep exploring", action: () => say(null) }] });
    }
    return true;
  }

  const restartOptions: RestartOption[] = [
    ...(active ? [{ label: "Restart this RSA act", description: "Clear this act’s attempt and results. Other completed acts and your medals stay saved.", restart: () => void restart(false) }] : []),
    { label: "Restart RSA from Act 1", description: "Clear RSA progress and begin the first act with the client.", restart: () => void restart(true) },
  ];
  /** The laptop, the result screen and backend errors, while an act runs. */
  const layer = (restartControl: ReactNode) => active && <>
    <LaptopScene key={`${game.act}:${missionGeneration()}`} act={game.act} restartControl={restartControl} />
    <GameOver key={`result:${missionGeneration()}`} act={game.act} onReturn={() => { pause(); }} onRetry={() => void begin(game.act)} onNext={(act) => void begin(act)} />
    {game.error && <div className="textbox absolute inset-x-3 top-16 z-10 px-3 py-2 text-xs text-actor-hacker" role="alert">{t(game.error)}</div>}
  </>;

  return { active, activeRef, starting, startingRef, blocked, pause, begin, resume, restore, sceneReady, restart, stop, offer, interact, restartOptions, layer };
}
