"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SCENARIOS } from "@/content/scenarios";
import { ACT_NUMBERS, getAct } from "@/content";
import type { ActNumber } from "@/content/types";
import { CLIENT_POSITION, TOWN_LOCATIONS, type TownTarget } from "@/content/town";
import { bus, type Landmark } from "@/engine/bus";
import { useGame } from "@/game/state";
import { captureRsa, restoreRsa, townStorageUnavailable, useTown, validCheckpoint } from "@/game/town";
import { invalidateMission, missionGeneration } from "@/game/runtime";
import { interactAt, startAct } from "@/game/dialog";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { MedalCase } from "./MedalCase";
import { syncSuspicionBubbles } from "@/game/suspicion";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import { GameShell } from "./GameShell";
import { CoinScenario } from "./CoinScenario";
import { CoinTownScreen } from "./CoinTownScreen";
import { COIN_TOWN_DOOR, COIN_TOWN_FROM_NORTH, QUANTUM_SOUTH_GATE, QUANTUM_SOUTH_ROW } from "@/content/coinTown";
import { useKnowledge } from "@/game/knowledge";
import { GroverScenario } from "./GroverScenario";
import { VaultScenario } from "./VaultScenario";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { TownMinimap } from "./TownMinimap";
import { RsaProgress } from "./RsaProgress";
import { SceneLoading } from "./SceneLoading";
import { DialogBox } from "./DialogBox";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { GameOver } from "./GameOver";
import { LaptopScene } from "./LaptopScene";
import { ObjectiveList } from "./ObjectiveList";
import { SuspicionMeter } from "./SuspicionMeter";
import { TouchControls } from "./TouchControls";

const GameCanvas = dynamic(() => import("./GameCanvas").then((mod) => mod.GameCanvas), { ssr: false });
interface TownConversation {
  title: string; text: string;
  /** Sentences translated one by one, for text composed from progress. */
  parts?: string[];
  rsaAct?: ActNumber;
  choices: { label: string; act?: ActNumber; done?: boolean; action: () => void }[];
}
type Challenge = "coin" | "rsa" | "grover" | "vault";
const CHALLENGES: Challenge[] = ["coin", "rsa", "grover", "vault"];
const COIN_SAVE = "quantum-coin-session-v1";
const GROVER_SAVE = "quantum-grover-session-v1";
const VAULT_SAVE = "quantum-vault-session-v1";
const CHALLENGE_TITLES: Record<Challenge, string> = { coin: "Who Goes First?", rsa: "Breaking RSA", grover: "Echo Chamber", vault: "Operation Ghost Key" };
const TRACK_TARGETS: Record<Challenge, TownTarget | "car"> = { coin: "southPath", rsa: "car", grover: "groverDoor", vault: "vaultDoor" };
const TRACK_LABELS: Record<Challenge, string> = { coin: "Track the south road", rsa: "Track RSA client", grover: "Track Thecap’s workshop", vault: "Track Casa Ofelia" };
const VISIT_KEYS: Record<Challenge, string> = { coin: "coinDoor", rsa: "rsa", grover: "groverDoor", vault: "vaultDoor" };
/** Thecap's greeting is composed from progress: first meeting, all done, or "so far" + "next". */
const GREETING_FIRST = "Welcome to Quantum Town! I’m Professor Thecap, the town doctor and, on weekends, the town tinkerer. My cousin Cap, the mayor down in Coin Town, wrote that you were coming. Good: three bigger problems need a quantum hand here. Someone is listening to Ale and Brayan’s messages on the street. An old drone core has locked itself in my workshop. And Doña Ofelia swears her house is haunted. Each challenge uses what the last one taught you.";
const GREETING_ALL = "Coin, codes, a disarmed core and a ghost laid to rest. You’ve seen both kinds of quantum speed-up. Replay anything you like; your medals stay.";
const GREETING_COUNT = ["", "One challenge down, three to go.", "Two challenges down, two to go.", "Three down, one to go."];
const GREETING_SKIPPED = "You jumped ahead. Bold! The earlier lessons still teach what the later ones assume.";
const GREETING_NEXT: Record<Challenge, string> = {
  coin: "Coin Town is down the south road. The neighbors there teach what a qubit can do, and Ale and Brayan’s game night is waiting.",
  rsa: "Next, the street: someone is intercepting Ale and Brayan’s messages.",
  grover: "Next, my workshop: an old drone core, sixteen PINs, three tries, no hints.",
  vault: "Doña Ofelia came by. Her house has been knocking every night since we silenced that drone; her husband built it. She thinks it’s his ghost. I think it’s his vault. Take my laptop.",
};
const GREETING_VAULT_EARLY = "Ofelia’s haunted house? Bold. My workshop teaches the trick you’ll try first there, and why it isn’t enough.";

/** The world owns navigation; missions own only their story and tools. */
export function TownScreen({ initialAct, initialCoin = false, initialGrover = false, initialVault = false, visitRsa = false }: {
  initialAct?: ActNumber; initialCoin?: boolean; initialGrover?: boolean; initialVault?: boolean; visitRsa?: boolean;
}) {
  useLocale((state) => state.locale);
  const router = useRouter();
  const town = useTown();
  const game = useGame();
  const completed = useProgress((state) => state.completed);
  const [hydrated, setHydrated] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "error">("loading");
  const [rsaActive, setRsaActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [conversation, setConversation] = useState<TownConversation | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [worldKey, setWorldKey] = useState(0);
  const [townNear, setTownNear] = useState<TownTarget | null>(null);
  const [coinSaved, setCoinSaved] = useState(false);
  const [groverSaved, setGroverSaved] = useState(false);
  const [vaultSaved, setVaultSaved] = useState(false);
  const readyRef = useRef(false);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const events = useRef({ interactTown: (_target: TownTarget) => {}, interactRsa: (_target: Landmark) => {}, travelSouth: () => {} });
  const conversationRef = useRef<HTMLDivElement>(null);
  activeRef.current = rsaActive;

  const coinComplete = !!completed.coin?.includes("coin");
  const rsaComplete = ACT_NUMBERS.every((act) => completed.rsa?.includes(String(act)));
  const groverComplete = !!completed.grover?.includes("grover");
  const vaultComplete = !!completed.vault?.includes("vault");
  const blocked = game.phase === "busy" || !!game.busyLabel || game.operations > 0 || starting;

  function closeConversation() { setConversation(null); }
  function doneChallenges(): Record<Challenge, boolean> {
    const done = useProgress.getState().completed;
    return { coin: !!done.coin?.includes("coin"), rsa: ACT_NUMBERS.every((act) => done.rsa?.includes(String(act))), grover: !!done.grover?.includes("grover"), vault: !!done.vault?.includes("vault") };
  }
  /** Challenges are recommended in order, but all of them are open. */
  function nextChallenge(): Challenge | null {
    const done = doneChallenges();
    return CHALLENGES.find((id) => !done[id]) ?? null;
  }
  function chooseChallenge(id: Challenge) {
    if (!saveAndPause()) return;
    useTown.getState().patch({ tracked: id, welcomed: true }); closeConversation();
  }
  function greetingParts(done: Record<Challenge, boolean>): string[] {
    const count = CHALLENGES.filter((id) => done[id]).length;
    const next = CHALLENGES.find((id) => !done[id]);
    if (!next) return [GREETING_ALL];
    if (!useTown.getState().welcomed || count === 0) return [GREETING_FIRST];
    const skipped = CHALLENGES.slice(CHALLENGES.indexOf(next) + 1).some((id) => done[id]);
    if (done.vault && !done.grover && next === "grover") return [GREETING_COUNT[count], GREETING_SKIPPED, GREETING_NEXT.grover];
    return [GREETING_COUNT[count], ...(skipped ? [GREETING_SKIPPED] : []), GREETING_NEXT[next]];
  }
  function greet() {
    const done = doneChallenges();
    const parts = greetingParts(done);
    setConversation({ title: "Professor Thecap", text: parts.join(" "), parts,
      choices: [
        { label: "1 · Who Goes First? (Beginner)", done: done.coin, action: () => chooseChallenge("coin") },
        { label: "2 · Breaking RSA (Intermediate)", done: done.rsa, action: () => chooseChallenge("rsa") },
        { label: "3 · Echo Chamber (Advanced)", done: done.grover, action: () => chooseChallenge("grover") },
        { label: "4 · Operation Ghost Key (Expert)", done: done.vault, action: () => chooseChallenge("vault") },
        { label: "I’ll explore", action: () => { useTown.getState().patch({ welcomed: true }); closeConversation(); } },
      ] });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([useTown.persist.rehydrate(), useProgress.persist.rehydrate(), useMedals.persist.rehydrate(), useKnowledge.persist.rehydrate()]);
      if (cancelled) return;
      const saved = useTown.getState();
      useGame.setState({ laptopOpen: false, walking: false, near: null, operations: 0, busyLabel: null });
      try { setCoinSaved(localStorage.getItem(COIN_SAVE) !== null); setGroverSaved(localStorage.getItem(GROVER_SAVE) !== null); setVaultSaved(localStorage.getItem(VAULT_SAVE) !== null); } catch { /* In-memory play remains available. */ }
      if (initialCoin) saved.patch({ location: "coin", coinTown: { ...saved.coinTown, position: { x: COIN_TOWN_DOOR.stand.x, y: COIN_TOWN_DOOR.stand.y + 1 }, facing: "down" }, rsaRunning: false });
      else if (initialGrover) saved.patch({ location: "grover", position: { ...TOWN_LOCATIONS.groverDoor.stand }, facing: "down", rsaRunning: false });
      else if (initialVault) saved.patch({ location: "vault", position: { ...TOWN_LOCATIONS.vaultDoor.stand }, facing: "down", rsaRunning: false });
      else if (initialAct || visitRsa) {
        saved.patch({ location: "town", position: { ...CLIENT_POSITION }, facing: "down", tracked: "rsa", rsaRunning: false, requestedAct: initialAct ?? null });
      } else if (saved.location === "town" && saved.rsaRunning && validCheckpoint(saved.checkpoint) && !["won", "caught"].includes(saved.checkpoint.phase) && !saved.interrupted) {
        restoreRsa(saved.checkpoint); setRsaActive(true); activeRef.current = true;
      }
      if (initialCoin || initialGrover || initialVault || initialAct || visitRsa) { router.replace("/"); return; }
      if (!saved.welcomed && saved.location === "town") greet();
      else if (saved.interrupted && saved.location === "town") setConversation({ title: "Progress saved", text: "The last operation was interrupted. Your last safe checkpoint is saved. Talk to the client to resume; an unfinished operation will only run again when you choose it.", choices: [{ label: "Keep exploring", action: closeConversation }] });
      setHydrated(true);
      void gameAudio.playMusic("play");
    })();
    return () => { cancelled = true; readyRef.current = false; invalidateMission(); };
    // Entry hints apply once; changes in world state must not reboot the world.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => bus.on((event) => {
    if (!readyRef.current) return;
    if (event.type === "position") {
      useTown.getState().patch({ position: event.at, facing: event.facing });
      useTown.getState().explore(event.at);
      // The only tiles on the bottom row are the southern entrance.
      if (event.at.y === QUANTUM_SOUTH_ROW) events.current.travelSouth();
    }
    if (event.type === "townMoved") { setTownNear(event.near); if (event.near) useTown.getState().discover(event.near); }
    if (event.type === "moved") { useGame.getState().setNear(event.near); if (event.near === "car") useTown.getState().discover("rsa"); }
    if (event.type === "walking") useGame.getState().setWalking(event.walking);
    if (event.type === "townInteract") events.current.interactTown(event.target);
    if (event.type === "interact") events.current.interactRsa(event.target);
  }), []);

  useEffect(() => useGame.subscribe((state) => {
    if (!activeRef.current || startingRef.current) return;
    const saved = useTown.getState();
    if (state.phase === "busy" || state.operations > 0 || state.busyLabel) {
      if (!saved.interrupted) saved.patch({ interrupted: true });
      return;
    }
    const checkpoint = captureRsa();
    if (validCheckpoint(checkpoint)) saved.patch({ checkpoint, interrupted: false });
    if (state.phase === "won") useProgress.getState().complete("rsa", String(state.act));
  }), []);

  const onReady = useCallback(async () => {
    const token = missionGeneration();
    const saved = useTown.getState();
    await bus.send({ type: "placePlayer", at: saved.position, facing: saved.facing });
    if (token !== missionGeneration()) return;
    await bus.send({ type: "tapGlow", on: activeRef.current && !!useGame.getState().flags.listenerActive });
    if (activeRef.current) await syncSuspicionBubbles();
    if (token !== missionGeneration()) return;
    readyRef.current = true;
    useTown.getState().explore(useTown.getState().position);
    setSceneStatus("ready");
  }, []);
  const onError = useCallback(() => setSceneStatus("error"), []);

  const sceneReady = hydrated && sceneStatus === "ready" && town.location === "town";
  const inputLocked = !!conversation || journalOpen || restartOpen || (rsaActive && (starting || game.phase !== "exploring" || game.laptopOpen));
  useEffect(() => {
    if (!sceneReady) return;
    void bus.send({ type: "lockInput", locked: inputLocked });
  }, [sceneReady, inputLocked]);
  useEffect(() => {
    if (!sceneReady) return;
    const target = rsaActive ? game.pendingTravel?.at ?? null : town.tracked ? TRACK_TARGETS[town.tracked] : null;
    void bus.send({ type: "track", target });
  }, [sceneReady, rsaActive, game.pendingTravel?.at, town.tracked]);
  useEffect(() => {
    if (sceneReady) void bus.send({ type: "townProgress", coinComplete, rsaComplete, groverComplete, vaultComplete, rsaPaused: !rsaActive && !!town.checkpoint && !["won", "caught"].includes(town.checkpoint.phase) });
  }, [sceneReady, coinComplete, rsaComplete, groverComplete, vaultComplete, rsaActive, town.checkpoint?.phase]);
  useEffect(() => {
    conversationRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [conversation]);

  function saveAndPause() {
    if (activeRef.current && (startingRef.current || useGame.getState().phase === "busy" || useGame.getState().operations > 0 || !!useGame.getState().busyLabel)) return false;
    if (rsaActive) {
      useTown.getState().patch({ checkpoint: captureRsa(), rsaPosition: { ...useTown.getState().position }, rsaRunning: false, interrupted: false });
      useGame.getState().setLaptopOpen(false);
      activeRef.current = false; setRsaActive(false);
      void bus.send({ type: "tapGlow", on: false });
      for (const actor of ["ale", "brayan", "hacker"] as const) void bus.send({ type: "bubble", actor, face: "none" });
    }
    return true;
  }
  function trackDestination(id: Challenge) {
    if (!saveAndPause()) return;
    useTown.getState().patch({ tracked: id }); closeConversation();
  }
  function enterCoin() {
    if (!saveAndPause()) return;
    gameAudio.playSynth("door");
    closeConversation(); readyRef.current = false; setSceneStatus("loading"); setTownNear(null);
    useTown.getState().patch({ location: "coin" });
  }
  /** Quantum Town's southern entrance is the road back down to Coin Town, where the game begins. */
  function enterCoinTown() {
    if (!saveAndPause()) return;
    gameAudio.playSynth("door");
    closeConversation(); readyRef.current = false; setSceneStatus("loading"); setTownNear(null);
    useGame.getState().setWalking(false); useGame.getState().setNear(null);
    const saved = useTown.getState();
    saved.patch({ location: "coinTown", position: { ...QUANTUM_SOUTH_GATE }, facing: "up", coinTown: { ...saved.coinTown, position: { ...COIN_TOWN_FROM_NORTH }, facing: "down" } });
  }
  function leaveCoinTown() {
    readyRef.current = false; setSceneStatus("loading");
    useGame.getState().setWalking(false); useGame.getState().setNear(null);
    useTown.getState().patch({ location: "town", position: { ...QUANTUM_SOUTH_GATE }, facing: "up", tracked: nextChallenge() });
    // Arriving for the first time: Professor Thecap takes it from his cousin.
    if (!useTown.getState().welcomed) greet();
  }
  function leaveCoin() {
    gameAudio.playSynth("door");
    readyRef.current = false; setSceneStatus("loading");
    useGame.getState().setWalking(false); useGame.getState().setNear(null);
    const saved = useTown.getState();
    saved.patch({ location: "coinTown", coinTown: { ...saved.coinTown, position: { x: COIN_TOWN_DOOR.stand.x, y: COIN_TOWN_DOOR.stand.y + 1 }, facing: "down" } });
    setCoinSaved(true);
  }
  function enterGrover() {
    if (!saveAndPause()) return;
    gameAudio.playSynth("door");
    closeConversation(); readyRef.current = false; setSceneStatus("loading"); setTownNear(null);
    useTown.getState().patch({ location: "grover", position: { ...TOWN_LOCATIONS.groverDoor.stand }, facing: "down" });
  }
  function enterVault() {
    if (!saveAndPause()) return;
    gameAudio.playSynth("door");
    closeConversation(); readyRef.current = false; setSceneStatus("loading"); setTownNear(null);
    useTown.getState().patch({ location: "vault", position: { ...TOWN_LOCATIONS.vaultDoor.stand }, facing: "down" });
  }
  function leaveHouse(door: "groverDoor" | "vaultDoor") {
    gameAudio.playSynth("door");
    readyRef.current = false; setSceneStatus("loading");
    useGame.getState().setWalking(false); useGame.getState().setNear(null);
    const stand = TOWN_LOCATIONS[door].stand;
    useTown.getState().patch({ location: "town", position: { x: stand.x, y: stand.y + 1 }, facing: "down", tracked: nextChallenge() });
    if (door === "groverDoor") setGroverSaved(true); else setVaultSaved(true);
    if (!useTown.getState().welcomed) greet();
  }
  const leaveGrover = () => leaveHouse("groverDoor");
  const leaveVault = () => leaveHouse("vaultDoor");
  async function beginRsa(act: ActNumber) {
    if (startingRef.current || ((useGame.getState().phase === "busy" || useGame.getState().operations > 0 || !!useGame.getState().busyLabel) && activeRef.current)) return;
    closeConversation(); startingRef.current = true; setStarting(true); activeRef.current = true; setRsaActive(true);
    useTown.getState().patch({ requestedAct: null, rsaRunning: true, interrupted: true, tracked: "rsa", checkpoint: null });
    try {
      const work = startAct(act);
      const token = missionGeneration();
      await work;
      if (!readyRef.current || token !== missionGeneration()) return;
      useTown.getState().patch({ checkpoint: captureRsa(), rsaPosition: { ...useTown.getState().position }, interrupted: false });
    } finally { startingRef.current = false; setStarting(false); }
  }
  async function resumeRsa() {
    const saved = useTown.getState();
    if (!validCheckpoint(saved.checkpoint)) return;
    invalidateMission(); restoreRsa(saved.checkpoint);
    closeConversation(); activeRef.current = true; setRsaActive(true);
    saved.patch({ requestedAct: null, rsaRunning: true, interrupted: false, tracked: "rsa" });
    if (saved.rsaPosition) await bus.send({ type: "placePlayer", at: saved.rsaPosition, facing: "up" });
    await bus.send({ type: "tapGlow", on: !!saved.checkpoint.flags.listenerActive });
    await syncSuspicionBubbles();
  }
  function clearCoinSave() {
    try { localStorage.removeItem(COIN_SAVE); } catch { /* Reset still works for the current visit. */ }
    useProgress.getState().reset("coin"); setCoinSaved(false);
  }
  function restartCoin() {
    if (!saveAndPause()) return;
    clearCoinSave(); enterCoin();
  }
  function restartGrover() {
    if (!saveAndPause()) return;
    try { localStorage.removeItem(GROVER_SAVE); } catch { /* Reset still works for the current visit. */ }
    useProgress.getState().reset("grover"); setGroverSaved(false);
    enterGrover();
  }
  function restartVault() {
    if (!saveAndPause()) return;
    try { localStorage.removeItem(VAULT_SAVE); } catch { /* Reset still works for the current visit. */ }
    useProgress.getState().reset("vault"); setVaultSaved(false);
    enterVault();
  }
  async function restartRsa(fromBeginning: boolean) {
    if (activeRef.current && blocked) return;
    const act = fromBeginning ? 1 : useGame.getState().act;
    await bus.send({ type: "placePlayer", at: CLIENT_POSITION, facing: "down" });
    activeRef.current = false;
    useGame.setState((state) => ({ completedActs: fromBeginning ? [] : state.completedActs.filter((number) => number !== act) }));
    useProgress.getState().reset("rsa", fromBeginning ? undefined : String(act));
    useTown.getState().patch({ checkpoint: null, rsaPosition: null, requestedAct: null, interrupted: false });
    await beginRsa(act);
  }
  function restartGame() {
    if (activeRef.current && (startingRef.current || useGame.getState().phase === "busy" || useGame.getState().operations > 0 || !!useGame.getState().busyLabel)) return;
    activeRef.current = false; invalidateMission();
    setRsaActive(false); setStarting(false); startingRef.current = false;
    readyRef.current = false; setSceneStatus("loading");
    setJournalOpen(false); setRestartOpen(false); setTownNear(null);
    try { localStorage.removeItem(COIN_SAVE); localStorage.removeItem(GROVER_SAVE); localStorage.removeItem(VAULT_SAVE); } catch { /* In-memory reset remains available. */ }
    useProgress.getState().reset(); useMedals.getState().reset(); useKnowledge.getState().reset(); useGame.getState().resetRun(1); useGame.setState({ completedActs: [] });
    useTown.getState().reset(); setCoinSaved(false); setGroverSaved(false); setVaultSaved(false);
    setWorldKey((key) => key + 1);
  }
  const restartOptions: RestartOption[] = [
    ...(rsaActive ? [{ label: "Restart this RSA act", description: "Clear this act’s attempt and results. Other completed acts and your medals stay saved.", restart: () => void restartRsa(false) }] : []),
    { label: "Restart Who Goes First?", description: "Clear the coin lesson, its puzzles, experiments, and completion. Start inside the house.", restart: restartCoin },
    { label: "Restart RSA from Act 1", description: "Clear RSA progress and begin the first act with the client.", restart: () => void restartRsa(true) },
    { label: "Restart Echo Chamber", description: "Clear the workshop lesson, its circuit, runs, and completion. Start inside the workshop.", restart: restartGrover },
    { label: "Restart Operation Ghost Key", description: "Clear the vault lesson: a new mask, fresh candles, empty circuits, and no completion. Start inside Casa Ofelia.", restart: restartVault },
    { label: "Start the whole game over", description: "Clear every lesson, your medal case, and town progress. Return to Mayor Cap’s welcome in Coin Town.", restart: restartGame },
  ];
  const restartControl = <StartOverControl options={restartOptions} disabled={!sceneReady || (rsaActive && blocked)} onOpenChange={setRestartOpen} />;

  function later() {
    closeConversation();
    if (!rsaActive) useTown.getState().patch({ tracked: nextChallenge() });
  }
  function offerRsa() {
    const saved = useTown.getState();
    const checkpoint = saved.checkpoint;
    const unfinished = validCheckpoint(checkpoint) && checkpoint.phase !== "won" && checkpoint.phase !== "caught";
    const next = ACT_NUMBERS.find((act) => !useProgress.getState().completed.rsa?.includes(String(act))) ?? 1;
    const act = saved.requestedAct ?? (unfinished ? checkpoint.act : next);
    const allDone = ACT_NUMBERS.every((number) => useProgress.getState().completed.rsa?.includes(String(number)));
    setConversation({ title: "Breaking RSA", rsaAct: unfinished ? checkpoint.act : act, text: unfinished ? "Your client is still waiting. Resume the saved mission, or choose another act to start a new attempt." : allDone ? "You recovered every message, from plaintext to RSA. The four medals are yours to keep. Replay any act to sharpen a skill; nothing is lost." : "Ale and Brayan think their messages are secret. Help me recover them, from simple encodings to RSA. You can start now, or try the beginner coin lesson first.",
      choices: [
        ...(unfinished ? [{ label: "Resume", act: checkpoint.act, action: () => void resumeRsa() }] : []),
        ...(!unfinished && !allDone ? [{ label: "Start", act, action: () => void beginRsa(act) }] : []),
        ...(unfinished && saved.requestedAct && saved.requestedAct !== checkpoint.act ? [{ label: "Replace saved attempt with selected act", action: () => void beginRsa(act) }] : []),
        { label: "Choose an act to replay", action: () => setConversation({ title: "RSA missions", rsaAct: act, text: "Choose an act. Starting it replaces your saved RSA attempt; your completed lessons stay saved.", choices: [...ACT_NUMBERS.map((number) => ({ label: `Act ${number}: ${getAct(number).title}`, action: () => void beginRsa(number) })), { label: "Later", action: later }] }) },
        { label: "Later", action: later },
      ] });
  }

  events.current = {
    interactTown: (target) => {
      if (conversation || journalOpen || (rsaActive && blocked)) return;
      const location = TOWN_LOCATIONS[target];
      if (location.kind === "coin") setConversation({ title: "Who Goes First?", text: "Nobody’s home. A note on the door: “Game night moved to Coin Town. Take the south road. — Ale & Brayan”", choices: [{ label: "Walk north to Coin Town", action: enterCoinTown }, { label: "Later", action: closeConversation }] });
      else if (location.kind === "path") enterCoinTown();
      else if (location.kind === "grover") setConversation({ title: "Echo Chamber", text: "Emergency · Advanced. An old drone core has locked itself with a 4-bit PIN and three tries. Build Grover’s search on the quantum core and disarm it.", choices: [{ label: groverSaved || groverComplete ? "Resume in the workshop" : "Enter the workshop", action: enterGrover }, { label: "Later", action: closeConversation }] });
      else if (location.kind === "vault") {
        const early = !doneChallenges().grover && !vaultComplete;
        setConversation({ title: "Operation Ghost Key", text: "Haunted house · Expert. Doña Ofelia’s house knocks at night. She needs her late husband’s vault opened: 25 bits, three questions.", parts: ["Haunted house · Expert. Doña Ofelia’s house knocks at night. She needs her late husband’s vault opened: 25 bits, three questions.", ...(early ? [GREETING_VAULT_EARLY] : [])],
          choices: [{ label: vaultSaved || vaultComplete ? "Resume in Casa Ofelia" : "Knock and go in", action: enterVault }, { label: "Later", action: closeConversation }] });
      }
      else if (location.kind === "guide") greet();
      else setConversation({ title: "Quantum Town", text: "Coin Town: down the south road. RSA client: on the northeastern street. Thecap’s workshop: the north-west house. Casa Ofelia: the old house north of the plaza.", choices: [...CHALLENGES.map((id) => ({ label: TRACK_LABELS[id], action: () => trackDestination(id) })), { label: "Keep exploring", action: closeConversation }] });
    },
    travelSouth: () => { if (!conversation && !journalOpen && !(rsaActive && blocked)) enterCoinTown(); },
    interactRsa: (target) => {
      if (conversation || journalOpen || blocked && rsaActive) return;
      if (rsaActive && game.phase === "exploring" && game.pendingTravel?.at === target) { void interactAt(target); return; }
      if (target === "car") {
        if (rsaActive) setConversation({ title: "Your client", text: "Finish your current objective, or pause the mission and explore town.", choices: [{ label: "Keep working", action: closeConversation }, { label: "Pause mission", action: () => { saveAndPause(); closeConversation(); } }] });
        else offerRsa();
      } else {
        setConversation({ title: target === "tap" ? "Junction box" : target === "ale" ? "Ale" : "Brayan", text: rsaActive ? "Your next objective is marked. Follow it to continue the mission." : "The client by the parked car has a mission about the messages on this wire. Talk to them to get started.", choices: [{ label: "Keep exploring", action: closeConversation }] });
      }
    },
  };

  if (!hydrated) return <main className="relative h-dvh bg-stage-bg"><SceneLoading /></main>;
  if (town.location === "coin") return <CoinScenario onExit={leaveCoin} onRestartGame={restartGame} />;
  if (town.location === "coinTown") return <CoinTownScreen key={worldKey} onLeave={leaveCoinTown} onEnterCoin={enterCoin}
    restartOptions={[{ label: "Restart Who Goes First?", description: "Clear the coin lesson, its puzzles, experiments, and completion. Start inside the house.", restart: restartCoin },
      { label: "Start the whole game over", description: "Clear every lesson, your medal case, and town progress. Return to Mayor Cap’s welcome in Coin Town.", restart: restartGame }]} />;
  if (town.location === "grover") return <GroverScenario onExit={leaveGrover} onRestartGame={restartGame} />;
  if (town.location === "vault") return <VaultScenario onExit={leaveVault} onRestartGame={restartGame} />;

  const canInteract = !!townNear || !!game.near;
  const journal = <div className="space-y-4 text-sm">
    <h2 className="text-accent-amber">{t("Quantum Town journal")}</h2>
    {rsaActive && <ObjectiveList />}
    {(() => { const next = nextChallenge(); return <p className="text-accent-teal">{next ? `${t("Recommended next challenge:")} ${t(CHALLENGE_TITLES[next])}` : t("Every challenge is complete. Replay any of them; your medals stay.")}</p>; })()}
    <p>{t("All four challenges are open. Play them in any order.")}</p>
    <p>{t("Walk to a door or character to start a lesson.")}</p>
    {SCENARIOS.map(({ id, title, difficulty, missions }) => { const done = missions.every((mission) => completed[id]?.includes(mission)); return <div key={id} className="panel space-y-2 p-3">
      <h3>{done ? "★ " : "◇ "}{t(title)}</h3><p className="text-stage-muted">{t(difficulty)} · {t(done ? "Completed" : id === "rsa" && rsaActive ? "Active mission" : (id === "coin" && coinSaved) || (id === "grover" && groverSaved) || (id === "vault" && vaultSaved) ? "Saved lesson" : id === "rsa" && town.checkpoint && !["won", "caught"].includes(town.checkpoint.phase) ? "Saved mission" : "Available")}</p>
      {id === "rsa" && <p className="text-xs text-stage-muted">{(completed.rsa ?? []).filter((mission) => ["1", "2", "3", "4"].includes(mission)).length} / 4 · {t("Acts complete")}</p>}
      <button className="btn-ghost" disabled={rsaActive && blocked} onClick={() => trackDestination(id)}>{t(TRACK_LABELS[id])}</button>
      <p className="text-xs text-stage-muted">{t(town.discovered.includes(VISIT_KEYS[id]) || done ? "Visited" : "Not visited yet")}</p>
    </div>; })}
    <MedalCase />
    {townStorageUnavailable && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
  </div>;

  return <GameShell key={worldKey} restartControl={restartControl} title={t("Quantum Town")} subtitle={rsaActive ? `${t("Act")} ${game.act}: ${t(getAct(game.act).title)}` : t("Explore · meet neighbors · learn quantum computing")}
    missionProgress={rsaActive ? <RsaProgress act={game.act} showObjective /> : undefined}
    backHref="/" backLabel={t(rsaActive ? "Pause mission" : "Professor Thecap")} onBack={() => { if (rsaActive) saveAndPause(); else greet(); }} backDisabled={rsaActive && blocked}
    sidebar={journal} objectives={journal} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={sceneStatus === "error"}
    laptopOpen={rsaActive && game.laptopOpen} laptopReady={rsaActive && game.waitingFor === "workbench"}
    onOpenLaptop={() => { if (rsaActive && !conversation) useGame.getState().setLaptopOpen(true); else if (!rsaActive) setConversation({ title: "Your laptop", text: "Your laptop tools unlock during a mission. Visit the coin house or talk to the RSA client to begin.", choices: [{ label: "Keep exploring", action: closeConversation }] }); }}>
    <GameCanvas onReady={onReady} onError={onError} />
    {sceneReady && <>
      {!game.laptopOpen && !conversation && !journalOpen && !restartOpen && <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
        <TownMinimap />
        {rsaActive && <div className="pointer-events-none"><SuspicionMeter /></div>}
      </div>}
      {!conversation && !journalOpen && !restartOpen && !(rsaActive && game.laptopOpen) && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-24 lg:pb-4">
        {rsaActive && game.phase !== "exploring" ? <DialogBox /> : <div className={`textbox max-w-lg space-y-2 px-4 py-3 text-center transition-opacity ${game.walking ? "opacity-30" : ""}`}>
          <p className="text-sm">{t(rsaActive && game.pendingTravel ? game.pendingTravel.objective : town.tracked ? town.tracked === "coin" ? "First challenge: Who Goes First?" : town.tracked === "rsa" ? "RSA client" : town.tracked === "grover" ? "Thecap’s workshop" : "Casa Ofelia" : "Explore Quantum Town")}</p>
          {canInteract && <p className="text-xs text-accent-amber">{t(townNear ? TOWN_LOCATIONS[townNear].prompt : game.near === "car" ? "Talk to the RSA client" : game.near === "tap" ? "Inspect the junction box" : "Talk")}{" · "}{t("Press Space or tap Talk")}</p>}
        </div>}
      </div>}
      {conversation && <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t(conversation.title)} ref={conversationRef} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape" && town.welcomed) { event.preventDefault(); closeConversation(); }
        if (event.key === "Tab") {
          const buttons = Array.from(conversationRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <DialogueFrame className="max-w-4xl">{conversation.rsaAct && <div className="shrink-0"><RsaProgress act={conversation.rsaAct} /></div>}<DialogueLine speaker={conversation.title === "Professor Thecap" ? "guide" : conversation.title === "Operation Ghost Key" ? "ofelia" : "boss"} label={t(conversation.title)}>{conversation.parts ? conversation.parts.map((part) => t(part)).join(" ") : t(conversation.text)}</DialogueLine><div className="flex min-h-0 flex-wrap gap-2 overflow-y-auto">{conversation.choices.map((choice) => <button key={choice.label} className="btn-ghost text-sm" onClick={() => { gameAudio.playSfx("select"); choice.action(); }}>{choice.done ? "✓ " : ""}{t(choice.label)}{choice.act && `: ${t(`Act ${choice.act}: ${getAct(choice.act).title}`)}`}</button>)}</div></DialogueFrame>
      </div>}
      <TouchControls canInteract={canInteract} visible={!inputLocked} />
      {rsaActive && <><LaptopScene key={`${game.act}:${missionGeneration()}`} act={game.act} restartControl={restartControl} /><GameOver key={`result:${missionGeneration()}`} act={game.act} onReturn={() => { saveAndPause(); }} onRetry={() => void beginRsa(game.act)} onNext={(act) => void beginRsa(act)} /></>}
      {rsaActive && game.error && <div className="textbox absolute inset-x-3 top-16 z-10 px-3 py-2 text-xs text-actor-hacker" role="alert">{t(game.error)}</div>}
    </>}
  </GameShell>;
}
