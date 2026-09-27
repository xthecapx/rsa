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
import { syncSuspicionBubbles } from "@/game/suspicion";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import { GameShell } from "./GameShell";
import { CoinScenario } from "./CoinScenario";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { TownMinimap } from "./TownMinimap";
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
  choices: { label: string; action: () => void }[];
}

/** The world owns navigation; missions own only their story and tools. */
export function TownScreen({ initialAct, initialCoin = false, visitRsa = false }: {
  initialAct?: ActNumber; initialCoin?: boolean; visitRsa?: boolean;
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
  const readyRef = useRef(false);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const events = useRef({ interactTown: (_target: TownTarget) => {}, interactRsa: (_target: Landmark) => {} });
  const conversationRef = useRef<HTMLDivElement>(null);
  activeRef.current = rsaActive;

  const coinComplete = !!completed.coin?.includes("coin");
  const rsaComplete = ACT_NUMBERS.every((act) => completed.rsa?.includes(String(act)));
  const blocked = game.phase === "busy" || !!game.busyLabel || game.operations > 0 || starting;

  function closeConversation() { setConversation(null); }
  function recommendCoin() {
    if (!saveAndPause()) return;
    useTown.getState().patch({ tracked: "coin", welcomed: true }); closeConversation();
  }
  function chooseRsa() {
    if (!saveAndPause()) return;
    useTown.getState().patch({ tracked: "rsa", welcomed: true }); closeConversation();
  }
  function greet() {
    const firstDone = useProgress.getState().completed.coin?.includes("coin");
    setConversation({ title: "Town guide", text: firstDone
      ? "Who Goes First? is the first challenge in Quantum Town. You’ve completed it! You can replay it, or explore secret messages with the RSA client."
      : "Welcome to Quantum Town! I’m the town doctor. Your first challenge is Who Goes First?: help Ale and Brayan build a fair coin for game night. You can also start with RSA if you prefer.",
      choices: [
        { label: "First challenge: Who Goes First?", action: recommendCoin },
        { label: "Start with RSA instead", action: chooseRsa },
        { label: "I’ll explore", action: () => { useTown.getState().patch({ welcomed: true }); closeConversation(); } },
      ] });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.all([useTown.persist.rehydrate(), useProgress.persist.rehydrate()]);
      if (cancelled) return;
      const saved = useTown.getState();
      useGame.setState({ laptopOpen: false, walking: false, near: null, operations: 0, busyLabel: null });
      try { setCoinSaved(localStorage.getItem("quantum-coin-session-v1") !== null); } catch { /* In-memory play remains available. */ }
      if (initialCoin) saved.patch({ location: "coin", position: { ...TOWN_LOCATIONS.coinDoor.stand }, facing: "down", rsaRunning: false });
      else if (initialAct || visitRsa) {
        saved.patch({ location: "town", position: { ...CLIENT_POSITION }, facing: "down", tracked: "rsa", rsaRunning: false, requestedAct: initialAct ?? null });
      } else if (saved.location === "town" && saved.rsaRunning && validCheckpoint(saved.checkpoint) && !["won", "caught"].includes(saved.checkpoint.phase) && !saved.interrupted) {
        restoreRsa(saved.checkpoint); setRsaActive(true); activeRef.current = true;
      }
      if (initialCoin || initialAct || visitRsa) { router.replace("/"); return; }
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
    const target = rsaActive ? game.pendingTravel?.at ?? null : town.tracked === "coin" ? "coinDoor" : town.tracked === "rsa" ? "car" : null;
    void bus.send({ type: "track", target });
  }, [sceneReady, rsaActive, game.pendingTravel?.at, town.tracked]);
  useEffect(() => {
    if (sceneReady) void bus.send({ type: "townProgress", coinComplete, rsaComplete, rsaPaused: !rsaActive && !!town.checkpoint && !["won", "caught"].includes(town.checkpoint.phase) });
  }, [sceneReady, coinComplete, rsaComplete, rsaActive, town.checkpoint?.phase]);
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
  function trackDestination(id: "coin" | "rsa") {
    if (!saveAndPause()) return;
    useTown.getState().patch({ tracked: id }); closeConversation();
  }
  function enterCoin() {
    if (!saveAndPause()) return;
    closeConversation(); readyRef.current = false; setSceneStatus("loading"); setTownNear(null);
    useTown.getState().patch({ location: "coin", position: { ...TOWN_LOCATIONS.coinDoor.stand }, facing: "down" });
  }
  function leaveCoin() {
    readyRef.current = false; setSceneStatus("loading");
    useGame.getState().setWalking(false); useGame.getState().setNear(null);
    useTown.getState().patch({ location: "town", position: { x: TOWN_LOCATIONS.coinDoor.stand.x, y: TOWN_LOCATIONS.coinDoor.stand.y + 1 }, facing: "down", tracked: useProgress.getState().completed.coin?.includes("coin") ? "rsa" : "coin" });
    setCoinSaved(true);
    if (!useTown.getState().welcomed) greet();
  }
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
    try { localStorage.removeItem("quantum-coin-session-v1"); } catch { /* Reset still works for the current visit. */ }
    useProgress.getState().reset("coin"); setCoinSaved(false);
  }
  function restartCoin() {
    if (!saveAndPause()) return;
    clearCoinSave(); enterCoin();
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
    try { localStorage.removeItem("quantum-coin-session-v1"); } catch { /* In-memory reset remains available. */ }
    useProgress.getState().reset(); useGame.getState().resetRun(1); useGame.setState({ completedActs: [] });
    useTown.getState().reset(); setCoinSaved(false);
    setWorldKey((key) => key + 1); greet();
  }
  const restartOptions: RestartOption[] = [
    ...(rsaActive ? [{ label: "Restart this RSA act", description: "Clear this act’s attempt and results. Other completed acts stay saved.", restart: () => void restartRsa(false) }] : []),
    { label: "Restart Who Goes First?", description: "Clear the coin lesson, its puzzles, experiments, and completion. Start inside the house.", restart: restartCoin },
    { label: "Restart RSA from Act 1", description: "Clear RSA progress and begin the first act with the client.", restart: () => void restartRsa(true) },
    { label: "Start the whole game over", description: "Clear both lessons and town progress. Return to the welcome at the southern entrance.", restart: restartGame },
  ];
  const restartControl = <StartOverControl options={restartOptions} disabled={!sceneReady || (rsaActive && blocked)} onOpenChange={setRestartOpen} />;

  function later() {
    closeConversation();
    if (!rsaActive) useTown.getState().patch({ tracked: coinComplete ? "rsa" : "coin" });
  }
  function offerRsa() {
    const saved = useTown.getState();
    const checkpoint = saved.checkpoint;
    const unfinished = validCheckpoint(checkpoint) && checkpoint.phase !== "won" && checkpoint.phase !== "caught";
    const next = ACT_NUMBERS.find((act) => !useProgress.getState().completed.rsa?.includes(String(act))) ?? 1;
    const act = saved.requestedAct ?? (unfinished ? checkpoint.act : next);
    setConversation({ title: "Breaking RSA", text: unfinished ? "Your client is still waiting. Resume the saved mission, or choose another act to start a new attempt." : "Ale and Brayan think their messages are secret. Help me recover them, from simple encodings to RSA. You can start now, or try the beginner coin lesson first.",
      choices: [
        ...(unfinished ? [{ label: "Resume mission", action: () => void resumeRsa() }] : []),
        ...(!unfinished ? [{ label: saved.requestedAct || rsaComplete ? "Start selected act" : "Accept mission", action: () => void beginRsa(act) }] : []),
        ...(unfinished && saved.requestedAct && saved.requestedAct !== checkpoint.act ? [{ label: "Replace saved attempt with selected act", action: () => void beginRsa(act) }] : []),
        { label: "Choose an act to replay", action: () => setConversation({ title: "RSA missions", text: "Choose an act. Starting it replaces your saved RSA attempt; your completed lessons stay saved.", choices: [...ACT_NUMBERS.map((number) => ({ label: `Act ${number}: ${getAct(number).title}`, action: () => void beginRsa(number) })), { label: "Later", action: later }] }) },
        { label: "Later", action: later },
      ] });
  }

  events.current = {
    interactTown: (target) => {
      if (conversation || journalOpen || (rsaActive && blocked)) return;
      const location = TOWN_LOCATIONS[target];
      if (location.kind === "coin") setConversation({ title: "Who Goes First?", text: "Game night · Beginner. Build a coin program, investigate a known seed, and make your first quantum circuit.", choices: [{ label: coinSaved || coinComplete ? "Resume in the house" : "Enter the house", action: enterCoin }, { label: "Later", action: closeConversation }] });
      else if (location.kind === "closed") setConversation({ title: "A future adventure", text: "This house isn’t open yet. A new quantum challenge will arrive here later.", choices: [{ label: "Keep exploring", action: closeConversation }] });
      else if (location.kind === "guide") greet();
      else setConversation({ title: "Quantum Town", text: "Coin house: west of the plaza. RSA client: on the northeastern street. Two more houses will open for future lessons.", choices: [{ label: "Track coin house", action: () => trackDestination("coin") }, { label: "Track RSA client", action: () => trackDestination("rsa") }, { label: "Keep exploring", action: closeConversation }] });
    },
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

  const canInteract = !!townNear || !!game.near;
  const journal = <div className="space-y-4 text-sm">
    <h2 className="text-accent-amber">{t("Quantum Town journal")}</h2>
    {rsaActive && <ObjectiveList />}
    <p className="text-accent-teal">{t("Recommended first challenge: Who Goes First?")}</p>
    <p>{t("Both lessons are available. Start with RSA if you prefer.")}</p>
    <p>{t("Walk to a door or character to start a lesson.")}</p>
    {SCENARIOS.map(({ id, title, difficulty, missions }) => { const done = missions.every((mission) => completed[id]?.includes(mission)); return <div key={id} className="panel space-y-2 p-3">
      <h3>{done ? "★ " : "◇ "}{t(title)}</h3><p className="text-stage-muted">{t(difficulty)} · {t(done ? "Completed" : id === "rsa" && rsaActive ? "Active mission" : id === "coin" && coinSaved ? "Saved lesson" : id === "rsa" && town.checkpoint && !["won", "caught"].includes(town.checkpoint.phase) ? "Saved mission" : "Available")}</p>
      {id === "rsa" && <p className="text-xs text-stage-muted">{(completed.rsa ?? []).filter((mission) => ["1", "2", "3", "4"].includes(mission)).length} / 4 · {t("Acts complete")}</p>}
      <button className="btn-ghost" disabled={rsaActive && blocked} onClick={() => trackDestination(id)}>{t(id === "coin" ? "Track coin house" : "Track RSA client")}</button>
      <p className="text-xs text-stage-muted">{t(town.discovered.includes(id === "coin" ? "coinDoor" : "rsa") || done ? "Visited" : "Not visited yet")}</p>
    </div>; })}
    <p className="text-stage-muted">{t("Two more houses will open for future lessons.")}</p>
    {townStorageUnavailable && <p role="status">{t("Browser storage is unavailable. Progress will last for this visit only.")}</p>}
  </div>;

  return <GameShell key={worldKey} restartControl={restartControl} title={t("Quantum Town")} subtitle={rsaActive ? `${t("Act")} ${game.act}: ${t(getAct(game.act).title)}` : t("Explore · meet neighbors · learn quantum computing")}
    backHref="/" backLabel={t(rsaActive ? "Pause mission" : "Town guide")} onBack={() => { if (rsaActive) saveAndPause(); else greet(); }} backDisabled={rsaActive && blocked}
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
          <p className="text-sm">{t(rsaActive && game.pendingTravel ? game.pendingTravel.objective : town.tracked ? `${town.tracked === "coin" ? "First challenge: Who Goes First?" : "RSA client"}` : "Explore Quantum Town")}</p>
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
        <DialogueFrame className="max-w-4xl"><DialogueLine speaker={conversation.title === "Town guide" ? "guide" : "boss"} label={t(conversation.title)}>{t(conversation.text)}</DialogueLine><div className="flex min-h-0 flex-wrap gap-2 overflow-y-auto">{conversation.choices.map((choice) => <button key={choice.label} className="btn-ghost text-sm" onClick={() => { gameAudio.playSfx("select"); choice.action(); }}>{t(choice.label)}</button>)}</div></DialogueFrame>
      </div>}
      <TouchControls canInteract={canInteract} visible={!inputLocked} />
      {rsaActive && <><LaptopScene key={`${game.act}:${missionGeneration()}`} act={game.act} restartControl={restartControl} /><GameOver key={`result:${missionGeneration()}`} act={game.act} onReturn={() => { saveAndPause(); }} onRetry={() => void beginRsa(game.act)} onNext={(act) => { saveAndPause(); useTown.getState().patch({ requestedAct: act, tracked: "rsa" }); }} /></>}
      {rsaActive && game.error && <div className="textbox absolute inset-x-3 top-16 z-10 px-3 py-2 text-xs text-actor-hacker" role="alert">{t(game.error)}</div>}
    </>}
  </GameShell>;
}
