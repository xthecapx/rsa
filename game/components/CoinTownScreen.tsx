"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { COIN_TOWN_NORTH_ROAD, COIN_TOWN_NPCS, CARD_COUNT, KNOWLEDGE, KNOWLEDGE_IDS, MAYOR, WARDEN, coinTownNpc,
  type CoinTownNpcId, type KnowledgeId, type Line } from "@/content/coinTown";
import type { MedalId } from "@/content/medals";
import type { Speaker } from "@/content/types";
import { bus } from "@/engine/bus";
import { useTown } from "@/game/town";
import { useGame } from "@/game/state";
import { useProgress } from "@/game/progress";
import { useMedals } from "@/game/medals";
import { useKnowledge } from "@/game/knowledge";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import { GameShell } from "./GameShell";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { LaptopShell } from "./LaptopShell";
import { MedalCase, MedalReveal } from "./MedalCase";
import { BenchQuestion, QubitBench } from "./QubitBench";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { TouchControls } from "./TouchControls";
import { CoinTownMinimap } from "./CoinTownMinimap";

const GameCanvas = dynamic(() => import("./GameCanvas").then((mod) => mod.GameCanvas), { ssr: false });

interface Talk {
  title: string; lines: Line[]; index: number;
  choices: { label: string; action: () => void }[];
  card?: KnowledgeId; medal?: MedalId;
}
interface Activity { npc: CoinTownNpcId; step: number; solved: boolean }

/** The order Mayor Cap suggests: each neighbor builds on the last, the coin house sits in the middle. */
const ROUTE: (CoinTownNpcId | "coinDoor")[] = ["luz", "nico", "coinDoor", "tomas", "marisol", "oscar"];
const TEACHERS = COIN_TOWN_NPCS.filter((npc) => npc.knowledge);

export function KnowledgeCardView({ id, learned = true }: { id: KnowledgeId; learned?: boolean }) {
  useLocale((state) => state.locale);
  const card = KNOWLEDGE[id];
  const teacher = TEACHERS.find((npc) => npc.knowledge === id)!;
  return <li className={`knowledge-card ${learned ? "learned" : "locked"}`}>
    <span className="knowledge-glyph" aria-hidden="true">{learned ? card.glyph : "?"}</span>
    <strong>{t(learned ? card.title : "Unknown card")}</strong>
    {learned ? <><span>{t(card.text)}</span><span className="knowledge-formula">{card.formula}</span><span className="text-stage-muted">{t(card.hint)}</span></>
      : <span className="text-stage-muted">{`${t("Ask")} ${t(teacher.title)} · ${t(teacher.description)}`}</span>}
  </li>;
}

export function CoinTownScreen({ onLeave, onEnterCoin, restartOptions }: {
  onLeave: () => void; onEnterCoin: () => void; restartOptions: RestartOption[];
}) {
  useLocale((state) => state.locale);
  const town = useTown();
  const walking = useGame((state) => state.walking);
  const cards = useKnowledge((state) => state.cards);
  const completed = useProgress((state) => state.completed);
  const badge = useMedals((state) => !!state.earned["coin-town"]);
  const [hydrated, setHydrated] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<string | null>(null);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const readyRef = useRef(false);
  const events = useRef({ interact: (_id: string) => {}, leave: onLeave, welcome: () => {} });
  events.current.leave = onLeave;
  const talkRef = useRef<HTMLDivElement>(null);
  const coinComplete = !!completed.coin?.includes("coin");
  /** Quantum Town is the final town: the badge opens its road. Saves that already played there keep their way in. */
  const northOpen = badge || !!completed.rsa?.length || !!completed.grover?.length || !!completed.vault?.length;

  useEffect(() => {
    let cancelled = false;
    void useKnowledge.persist.rehydrate()?.then(() => { if (!cancelled) setHydrated(true); });
    useGame.setState({ walking: false, near: null });
    return () => { cancelled = true; readyRef.current = false; };
  }, []);

  useEffect(() => bus.on((event) => {
    if (!readyRef.current) return;
    if (event.type === "position") {
      useTown.getState().patch({ coinTown: { ...useTown.getState().coinTown, position: event.at, facing: event.facing } });
      if (event.at.y === 0 && COIN_TOWN_NORTH_ROAD.includes(event.at.x)) { readyRef.current = false; gameAudio.playSynth("door"); events.current.leave(); }
    }
    if (event.type === "worldNear") setNear(event.near);
    if (event.type === "walking") useGame.getState().setWalking(event.walking);
    if (event.type === "worldInteract") events.current.interact(event.target);
  }), []);

  const onReady = useCallback(async () => {
    const saved = useTown.getState().coinTown;
    await bus.send({ type: "placePlayer", at: saved.position, facing: saved.facing });
    readyRef.current = true;
    setSceneStatus("ready");
    // A new game begins here: Mayor Cap greets the player before they take a step.
    if (!useTown.getState().coinTown.welcomed) events.current.welcome();
  }, []);
  const onError = useCallback(() => setSceneStatus("error"), []);

  const sceneReady = hydrated && sceneStatus === "ready";
  const inputLocked = !!talk || !!activity || journalOpen || restartOpen;
  useEffect(() => { if (sceneReady) void bus.send({ type: "lockInput", locked: inputLocked }); }, [sceneReady, inputLocked]);
  const ready = cards.length === KNOWLEDGE_IDS.length && coinComplete;
  const next: string | null = !town.coinTown.welcomed || (ready && !badge) ? "mayor" : badge ? "warden"
    : ROUTE.find((id) => (id === "coinDoor" ? !coinComplete : !cards.includes(coinTownNpc(id).knowledge!))) ?? "mayor";
  const alerts = [...TEACHERS.filter((npc) => !cards.includes(npc.knowledge!)).map((npc) => npc.id as string), ...(next === "mayor" ? ["mayor"] : [])];
  const done = [...(coinComplete ? ["coinDoor"] : []), ...TEACHERS.filter((npc) => cards.includes(npc.knowledge!)).map((npc) => npc.id as string), ...(badge ? ["mayor"] : [])];
  const markerKey = `${alerts.join()}|${done.join()}|${next}|${northOpen}`;
  useEffect(() => {
    if (!sceneReady) return;
    void bus.send({ type: "worldMarkers", alerts, done });
    void bus.send({ type: "worldTrack", target: next });
    void bus.send({ type: "worldGate", id: "north", open: northOpen });
    // markerKey captures alerts, done and next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, markerKey]);
  useEffect(() => { talkRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [talk?.index, talk?.title]);

  const close = () => setTalk(null);
  function say(title: string, lines: Line[], choices: Talk["choices"], extra: Pick<Talk, "card" | "medal"> = {}) {
    setTalk({ title, lines, index: 0, choices, ...extra });
  }
  function talkToMayor() {
    const saved = useTown.getState();
    if (badge) return say("Mayor Cap", [MAYOR.done], [{ label: "Keep exploring", action: close }]);
    if (ready) {
      say("Mayor Cap", [MAYOR.ready], [{ label: "Thank you, Mayor", action: close }], { medal: "coin-town" });
      // Award once the reveal is mounted, so it greets the medal as new (as the lessons do).
      window.setTimeout(() => useProgress.getState().complete("coin", "town"), 60);
      return;
    }
    if (!saved.coinTown.welcomed) {
      saved.patch({ coinTown: { ...saved.coinTown, welcomed: true } });
      return say("Mayor Cap", [MAYOR.welcome, MAYOR.guide], [{ label: "I’ll start exploring", action: close }]);
    }
    const count = { speaker: "mayor" as Speaker, text: CARD_COUNT.replace("{count}", String(useKnowledge.getState().cards.length)) };
    say("Mayor Cap", [count, coinComplete ? MAYOR.coinDone : MAYOR.coinWaiting, MAYOR.guide], [{ label: "Keep exploring", action: close }]);
  }
  function talkToTeacher(id: CoinTownNpcId) {
    const npc = coinTownNpc(id);
    const start = () => { close(); setActivity({ npc: id, step: 0, solved: false }); };
    if (cards.includes(npc.knowledge!)) say(npc.title, npc.repeat, [{ label: "Try the activity again", action: start }, { label: "Keep exploring", action: close }], { card: npc.knowledge });
    else say(npc.title, npc.intro, [{ label: "Show me", action: start }, { label: "Later", action: close }]);
  }
  events.current.welcome = talkToMayor;
  events.current.interact = (id) => {
    if (talk || activity) return;
    gameAudio.playSfx("select");
    if (id === "coinDoor") say("Who Goes First?", [{ speaker: "system", text: "Game night · Beginner. Build a coin program, investigate a known seed, and make your first quantum circuit." }],
      [{ label: coinComplete ? "Resume in the house" : "Enter the house", action: () => { close(); readyRef.current = false; onEnterCoin(); } }, { label: "Later", action: close }]);
    else if (id === "mayor") talkToMayor();
    else if (id === "warden") say("Beto", [northOpen ? WARDEN.open : WARDEN.closed], [{ label: "Keep exploring", action: close }]);
    else talkToTeacher(id as CoinTownNpcId);
  };

  function finishActivity(npcId: CoinTownNpcId) {
    const npc = coinTownNpc(npcId);
    useKnowledge.getState().learn(npc.knowledge!);
    setActivity(null);
    gameAudio.playSynth("fanfare");
    say(npc.title, npc.outro, [{ label: "Keep exploring", action: close }], { card: npc.knowledge });
  }

  const restartControl = <StartOverControl options={[
    { label: "Restart Coin Town", description: "Forget the five knowledge cards and meet Mayor Cap again. Your medals and the coin lesson stay.", restart: () => {
      useKnowledge.getState().reset();
      useTown.getState().patch({ coinTown: { ...useTown.getState().coinTown, welcomed: false } });
      setTalk(null); setActivity(null);
    } },
    ...restartOptions,
  ]} disabled={!sceneReady} onOpenChange={setRestartOpen} />;

  const npc = activity ? coinTownNpc(activity.npc) : null;
  const step = npc && activity ? npc.steps[activity.step] : null;
  const journal = <div className="space-y-4 text-sm">
    <h2 className="text-accent-amber">{t("Coin Town journal")}</h2>
    <p>{t("Learn from the neighbors, settle the coin toss, then see Mayor Cap for the town badge.")}</p>
    <ul className="space-y-1">
      <li>{town.coinTown.welcomed ? "✓ " : "◇ "}{t("Meet Mayor Cap by the entrance")}</li>
      {TEACHERS.map((teacher) => <li key={teacher.id}>{cards.includes(teacher.knowledge!) ? "✓ " : "◇ "}{t(teacher.title)} · {t(KNOWLEDGE[teacher.knowledge!].title)}</li>)}
      <li>{coinComplete ? "✓ " : "◇ "}{t("Settle game night in the coin house")}</li>
      <li>{badge ? "★ " : "◇ "}{t("Earn the Coin Town badge")}</li>
      <li>{northOpen ? "◆ " : "◇ "}{t("Take the north road to Quantum Town")}</li>
    </ul>
    <section className="panel space-y-2 p-3" aria-label={t("Knowledge cards")}>
      <div className="flex items-baseline justify-between gap-2"><h3 className="text-accent-amber">{t("Knowledge cards")}</h3><span className="text-xs text-stage-muted">{cards.length} / {KNOWLEDGE_IDS.length}</span></div>
      <ul className="knowledge-grid">{KNOWLEDGE_IDS.map((id) => <KnowledgeCardView key={id} id={id} learned={cards.includes(id)} />)}</ul>
    </section>
    <MedalCase compact />
  </div>;
  const nearLabel = near === "coinDoor" ? "Enter the coin house" : near ? `${t("Talk to")} ${t(coinTownNpc(near as CoinTownNpcId).title)}` : null;
  const objective = next === "warden" ? "Take the north road to Quantum Town" : next === "mayor" ? (badge ? null : ready ? "Collect your badge from Mayor Cap" : "Meet Mayor Cap by the entrance")
    : next === "coinDoor" ? "Settle game night in the coin house" : next ? `${t("Next")}: ${t(coinTownNpc(next as CoinTownNpcId).title)} · ${t(coinTownNpc(next as CoinTownNpcId).description)}` : null;
  const line = talk?.lines[talk.index];

  return <GameShell restartControl={restartControl} title={t("Coin Town")} subtitle={t("Learn from the neighbors · settle game night")}
    backHref="/" backLabel={t("Mayor Cap")} onBack={() => { if (!talk && !activity) talkToMayor(); }}
    sidebar={journal} objectives={journal} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={sceneStatus === "error"} laptopOpen={!!activity} laptopReady={false}
    onOpenLaptop={() => say("Your laptop", [{ speaker: "system", text: "Neighbors lend you their benches here. Talk to anyone whose name board starts with !." }], [{ label: "Keep exploring", action: close }])}>
    {hydrated && <GameCanvas world="coinTown" onReady={onReady} onError={onError} />}
    {sceneReady && <>
      {!talk && !activity && !journalOpen && !restartOpen && <div className="absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
        <CoinTownMinimap position={town.coinTown.position} facing={town.coinTown.facing} done={done} pending={[...alerts, ...(coinComplete ? [] : ["coinDoor"])]} tracked={next} />
      </div>}
      {!talk && !activity && !journalOpen && !restartOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-24 lg:pb-4">
        <div className={`textbox max-w-lg space-y-2 px-4 py-3 text-center transition-opacity ${walking ? "opacity-30" : ""}`}>
          <p className="text-sm">{t(objective ?? "Coin Town is yours. The north road leads to Quantum Town.")}</p>
          {nearLabel && <p className="text-xs text-accent-amber">{t(nearLabel)}{" · "}{t("Press Space or tap Talk")}</p>}
        </div>
      </div>}
      {talk && line && <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t(talk.title)} ref={talkRef}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); close(); } }}>
        <DialogueFrame className="max-w-4xl">
          <DialogueLine speaker={line.speaker} label={line.speaker === "system" ? t(talk.title) : undefined}>{t(line.text)}</DialogueLine>
          {talk.index === talk.lines.length - 1 && talk.card && <div className="knowledge-reveal" role="status">
            <span className="text-xs uppercase tracking-widest text-accent-teal">{t(useKnowledge.getState().fresh === talk.card ? "NEW KNOWLEDGE CARD" : "KNOWLEDGE CARD")}</span>
            <ul><KnowledgeCardView id={talk.card} /></ul>
          </div>}
          {talk.index === talk.lines.length - 1 && talk.medal && <MedalReveal id={talk.medal} />}
          <div className="flex min-h-0 flex-wrap gap-2 overflow-y-auto">
            {talk.index < talk.lines.length - 1
              ? <button className="btn-ghost text-sm" onClick={() => setTalk({ ...talk, index: talk.index + 1 })}>{t("Next")}</button>
              : talk.choices.map((choice) => <button key={choice.label} className="btn-ghost text-sm" onClick={() => { gameAudio.playSfx("select"); if (talk.card) useKnowledge.getState().dismiss(); choice.action(); }}>{t(choice.label)}</button>)}
          </div>
        </DialogueFrame>
      </div>}
      <TouchControls canInteract={!!near} visible={!inputLocked} />
    </>}
    {npc && step && activity && <LaptopShell open title={`${t(npc.title)} · ${t(step.title)}`} status={`${t("Step ")}${activity.step + 1}/${npc.steps.length}`}
      onClose={() => setActivity(null)} footer={<p>{t("Close the laptop to stop. The card is yours once every step is done.")}</p>}>
      <div key={`${activity.npc}-${activity.step}`} className="space-y-3">
        {step.kind === "bench" ? <QubitBench step={step} onSolved={() => setActivity({ ...activity, solved: true })} />
          : <BenchQuestion step={step} onSolved={() => setActivity({ ...activity, solved: true })} />}
        {activity.solved && <div className="laptop-challenge space-y-2" role="status">
          <p className="text-accent-teal">{t(step.feedback)}</p>
          <button className="btn-primary" autoFocus onClick={() => activity.step + 1 < npc.steps.length
            ? setActivity({ npc: activity.npc, step: activity.step + 1, solved: false }) : finishActivity(activity.npc)}>
            {t(activity.step + 1 < npc.steps.length ? "Next step" : "Take the card")}</button>
        </div>}
      </div>
    </LaptopShell>}
  </GameShell>;
}

