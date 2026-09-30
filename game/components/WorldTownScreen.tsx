"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { KnowledgeCard, KnowledgeId, Line, TownNpc } from "@/content/knowledge";
import type { MedalId } from "@/content/medals";
import type { Speaker } from "@/content/types";
import type { WorldFacing } from "@/content/town";
import type { WorldName } from "@/engine/createGame";
import { bus } from "@/engine/bus";
import { useTown, type TownSlot } from "@/game/town";
import { useGame } from "@/game/state";
import { useMedals } from "@/game/medals";
import { useKnowledge } from "@/game/knowledge";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import { GameShell } from "./GameShell";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { LaptopShell } from "./LaptopShell";
import { MedalCase, MedalReveal } from "./MedalCase";
import { BenchQuestion, QubitBench } from "./QubitBench";
import { RegisterBench, RoundsDial } from "./RegisterBench";
import { StartOverControl, type RestartOption } from "./StartOverControl";
import { TouchControls } from "./TouchControls";

const GameCanvas = dynamic(() => import("./GameCanvas").then((mod) => mod.GameCanvas), { ssr: false });

export interface Talk {
  title: string; lines: Line[]; index: number;
  choices: { label: string; action: () => void }[];
  card?: KnowledgeId; medal?: MedalId;
}
interface Activity { npc: string; step: number; solved: boolean }

export interface MinimapProps {
  position: { x: number; y: number }; facing: WorldFacing;
  done: string[]; pending: string[]; tracked: string | null;
}

/** Everything that makes one town different from another; the screen does the rest. */
export interface TownConfig {
  world: WorldName;
  slot: TownSlot;
  title: string; subtitle: string;
  greeter: {
    id: string; title: string;
    /** Journal line for meeting the greeter. */
    meet: string;
    welcome: Line[]; guide: Line; count: string; thanks: string;
    waiting: Line; challengeDone: Line; ready: Line; done: Line;
  };
  /** Neighbors that teach a card, in the order the town suggests. */
  teachers: TownNpc[];
  cards: Record<string, KnowledgeCard>;
  /** Every person on the map, for names and labels. */
  npcs: TownNpc[];
  challenge: {
    door: string; title: string; blurb: string; complete: boolean;
    enter: string; resume: string; objective: string; journal: string;
    onEnter: () => void;
  };
  /** Suggested order: teacher ids and the challenge door. */
  route: string[];
  badge: { medal: MedalId; award: () => void; journal: string; collect: string };
  /** Whom to track once the badge is yours. */
  afterBadge: () => string | null;
  /** Objective text for targets that are not teachers, the greeter or the challenge. */
  objectiveFor: (target: string) => string | null;
  /** Shown when nothing is left to track. */
  idle: string;
  /** Talk to anyone else: wardens, signposts. */
  others: Record<string, () => { title: string; lines: Line[] }>;
  /** Labels for targets that are not people, e.g. "Read the signpost". */
  nearLabels: Record<string, string>;
  gates: Record<string, boolean>;
  /** Walking onto one of these tiles leaves town. */
  exits: { test: (at: { x: number; y: number }) => boolean; go: () => void }[];
  journal: { title: string; intro: string; roads: { label: string; open: boolean }[] };
  restart: RestartOption;
  minimap: (props: MinimapProps) => ReactNode;
}

export function KnowledgeCardView({ card, teacher, learned = true }: { card: KnowledgeCard; teacher?: TownNpc; learned?: boolean }) {
  useLocale((state) => state.locale);
  return <li className={`knowledge-card ${learned ? "learned" : "locked"}`}>
    <span className="knowledge-glyph" aria-hidden="true">{learned ? card.glyph : "?"}</span>
    <strong>{t(learned ? card.title : "Unknown card")}</strong>
    {learned ? <><span>{t(card.text)}</span><span className="knowledge-formula">{card.formula}</span><span className="text-stage-muted">{t(card.hint)}</span></>
      : teacher && <span className="text-stage-muted">{`${t("Ask")} ${t(teacher.title)} · ${t(teacher.description)}`}</span>}
  </li>;
}

/**
 * A small town: neighbors with benches, one challenge door, a greeter who
 * hands out the badge, and roads to the next towns. React owns every
 * conversation; the WorldScene only walks and draws markers.
 */
export function WorldTownScreen({ config, restartOptions }: { config: TownConfig; restartOptions: RestartOption[] }) {
  useLocale((state) => state.locale);
  const saved = useTown((state) => state[config.slot]);
  const walking = useGame((state) => state.walking);
  const allCards = useKnowledge((state) => state.cards);
  const badge = useMedals((state) => !!state.earned[config.badge.medal]);
  const [hydrated, setHydrated] = useState(false);
  const [sceneStatus, setSceneStatus] = useState<"loading" | "ready" | "error">("loading");
  const [near, setNear] = useState<string | null>(null);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const readyRef = useRef(false);
  const events = useRef({ interact: (_id: string) => {}, welcome: () => {}, exits: config.exits });
  events.current.exits = config.exits;
  const talkRef = useRef<HTMLDivElement>(null);
  const { greeter, teachers, challenge } = config;
  const cardIds = teachers.map((npc) => npc.knowledge!);
  const cards = allCards.filter((id) => cardIds.includes(id));
  const npcById = (id: string) => config.npcs.find((npc) => npc.id === id);
  const teacherFor = (id: KnowledgeId) => teachers.find((npc) => npc.knowledge === id);

  useEffect(() => {
    let cancelled = false;
    void useKnowledge.persist.rehydrate()?.then(() => { if (!cancelled) setHydrated(true); });
    useGame.setState({ walking: false, near: null });
    return () => { cancelled = true; readyRef.current = false; };
  }, []);

  useEffect(() => bus.on((event) => {
    if (!readyRef.current) return;
    if (event.type === "position") {
      const town = useTown.getState();
      town.patch({ [config.slot]: { ...town[config.slot], position: event.at, facing: event.facing } });
      const exit = events.current.exits.find((candidate) => candidate.test(event.at));
      if (exit) { readyRef.current = false; gameAudio.playSynth("door"); exit.go(); }
    }
    if (event.type === "worldNear") setNear(event.near);
    if (event.type === "walking") useGame.getState().setWalking(event.walking);
    if (event.type === "worldInteract") events.current.interact(event.target);
  }), [config.slot]);

  const onReady = useCallback(async () => {
    const slot = useTown.getState()[config.slot];
    await bus.send({ type: "placePlayer", at: slot.position, facing: slot.facing });
    readyRef.current = true;
    setSceneStatus("ready");
    // The greeter meets the player before they take a step.
    if (!useTown.getState()[config.slot].welcomed) events.current.welcome();
  }, [config.slot]);
  const onError = useCallback(() => setSceneStatus("error"), []);

  const sceneReady = hydrated && sceneStatus === "ready";
  const inputLocked = !!talk || !!activity || journalOpen || restartOpen;
  useEffect(() => { if (sceneReady) void bus.send({ type: "lockInput", locked: inputLocked }); }, [sceneReady, inputLocked]);
  const ready = cards.length === cardIds.length && challenge.complete;
  const next: string | null = !saved.welcomed || (ready && !badge) ? greeter.id : badge ? config.afterBadge()
    : config.route.find((id) => (id === challenge.door ? !challenge.complete : !cards.includes(npcById(id)!.knowledge!))) ?? greeter.id;
  const alerts = [...teachers.filter((npc) => !cards.includes(npc.knowledge!)).map((npc) => npc.id), ...(next === greeter.id ? [greeter.id] : [])];
  const done = [...(challenge.complete ? [challenge.door] : []), ...teachers.filter((npc) => cards.includes(npc.knowledge!)).map((npc) => npc.id), ...(badge ? [greeter.id] : [])];
  const gateKey = Object.entries(config.gates).map(([id, open]) => `${id}:${open}`).join();
  const markerKey = `${alerts.join()}|${done.join()}|${next}|${gateKey}`;
  useEffect(() => {
    if (!sceneReady) return;
    void bus.send({ type: "worldMarkers", alerts, done });
    void bus.send({ type: "worldTrack", target: next });
    for (const [id, open] of Object.entries(config.gates)) void bus.send({ type: "worldGate", id, open });
    // markerKey captures alerts, done, next and the gates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, markerKey]);
  useEffect(() => { talkRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [talk?.index, talk?.title]);

  const close = () => setTalk(null);
  function say(title: string, lines: Line[], choices: Talk["choices"], extra: Pick<Talk, "card" | "medal"> = {}) {
    setTalk({ title, lines, index: 0, choices, ...extra });
  }
  function talkToGreeter() {
    const town = useTown.getState();
    if (badge) return say(greeter.title, [greeter.done], [{ label: "Keep exploring", action: close }]);
    if (ready) {
      say(greeter.title, [greeter.ready], [{ label: greeter.thanks, action: close }], { medal: config.badge.medal });
      // Award once the reveal is mounted, so it greets the medal as new (as the lessons do).
      window.setTimeout(config.badge.award, 60);
      return;
    }
    if (!town[config.slot].welcomed) {
      town.patch({ [config.slot]: { ...town[config.slot], welcomed: true } });
      return say(greeter.title, [...greeter.welcome, greeter.guide], [{ label: "I’ll start exploring", action: close }]);
    }
    const count = { speaker: greeter.id as Speaker, text: greeter.count.replace("{count}", String(cards.length)) };
    say(greeter.title, [count, challenge.complete ? greeter.challengeDone : greeter.waiting, greeter.guide], [{ label: "Keep exploring", action: close }]);
  }
  function talkToTeacher(npc: TownNpc) {
    const start = () => { close(); setActivity({ npc: npc.id, step: 0, solved: false }); };
    if (cards.includes(npc.knowledge!)) say(npc.title, npc.repeat, [{ label: "Try the activity again", action: start }, { label: "Keep exploring", action: close }], { card: npc.knowledge });
    else say(npc.title, npc.intro, [{ label: "Show me", action: start }, { label: "Later", action: close }]);
  }
  events.current.welcome = talkToGreeter;
  events.current.interact = (id) => {
    if (talk || activity) return;
    gameAudio.playSfx("select");
    if (id === challenge.door) say(challenge.title, [{ speaker: "system", text: challenge.blurb }],
      [{ label: challenge.complete ? challenge.resume : challenge.enter, action: () => { close(); readyRef.current = false; challenge.onEnter(); } }, { label: "Later", action: close }]);
    else if (id === greeter.id) talkToGreeter();
    else if (config.others[id]) { const other = config.others[id](); say(other.title, other.lines, [{ label: "Keep exploring", action: close }]); }
    else { const npc = npcById(id); if (npc?.knowledge) talkToTeacher(npc); }
  };

  function finishActivity(npc: TownNpc) {
    useKnowledge.getState().learn(npc.knowledge!);
    setActivity(null);
    gameAudio.playSynth("fanfare");
    say(npc.title, npc.outro, [{ label: "Keep exploring", action: close }], { card: npc.knowledge });
  }

  const restartControl = <StartOverControl options={[
    { ...config.restart, restart: () => {
      useKnowledge.getState().resetTown(cardIds);
      const town = useTown.getState();
      town.patch({ [config.slot]: { ...town[config.slot], welcomed: false } });
      setTalk(null); setActivity(null);
      config.restart.restart();
    } },
    ...restartOptions,
  ]} disabled={!sceneReady} onOpenChange={setRestartOpen} />;

  const npc = activity ? npcById(activity.npc)! : null;
  const step = npc && activity ? npc.steps[activity.step] : null;
  const solved = () => activity && setActivity({ ...activity, solved: true });
  const journal = <div className="space-y-4 text-sm">
    <h2 className="text-accent-amber">{t(config.journal.title)}</h2>
    <p>{t(config.journal.intro)}</p>
    <ul className="space-y-1">
      <li>{saved.welcomed ? "✓ " : "◇ "}{t(greeter.meet)}</li>
      {teachers.map((teacher) => <li key={teacher.id}>{cards.includes(teacher.knowledge!) ? "✓ " : "◇ "}{t(teacher.title)} · {t(config.cards[teacher.knowledge!].title)}</li>)}
      <li>{challenge.complete ? "✓ " : "◇ "}{t(challenge.journal)}</li>
      <li>{badge ? "★ " : "◇ "}{t(config.badge.journal)}</li>
      {config.journal.roads.map((road) => <li key={road.label}>{road.open ? "◆ " : "◇ "}{t(road.label)}</li>)}
    </ul>
    <section className="panel space-y-2 p-3" aria-label={t("Knowledge cards")}>
      <div className="flex items-baseline justify-between gap-2"><h3 className="text-accent-amber">{t("Knowledge cards")}</h3><span className="text-xs text-stage-muted">{cards.length} / {cardIds.length}</span></div>
      <ul className="knowledge-grid">{cardIds.map((id) => <KnowledgeCardView key={id} card={config.cards[id]} teacher={teacherFor(id)} learned={cards.includes(id)} />)}</ul>
    </section>
    <MedalCase compact />
  </div>;
  const nearNpc = near ? npcById(near) : undefined;
  const nearLabel = near === challenge.door ? challenge.enter : near && config.nearLabels[near] ? config.nearLabels[near] : nearNpc ? `${t("Talk to")} ${t(nearNpc.title)}` : null;
  const nextNpc = next ? npcById(next) : undefined;
  const objective = next === greeter.id ? (badge ? null : ready ? config.badge.collect : greeter.meet)
    : next === challenge.door ? challenge.objective
    : nextNpc?.knowledge ? `${t("Next")}: ${t(nextNpc.title)} · ${t(nextNpc.description)}`
    : next ? config.objectiveFor(next) : null;
  const line = talk?.lines[talk.index];

  return <GameShell restartControl={restartControl} title={t(config.title)} subtitle={t(config.subtitle)}
    backHref="/" backLabel={t(greeter.title)} onBack={() => { if (!talk && !activity) talkToGreeter(); }}
    sidebar={journal} objectives={journal} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={sceneStatus === "error"} laptopOpen={!!activity} laptopReady={false}
    onOpenLaptop={() => say("Your laptop", [{ speaker: "system", text: "Neighbors lend you their benches here. Talk to anyone whose name board starts with !." }], [{ label: "Keep exploring", action: close }])}>
    {hydrated && <GameCanvas world={config.world} onReady={onReady} onError={onError} />}
    {sceneReady && <>
      {!talk && !activity && !journalOpen && !restartOpen && <div className="absolute right-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
        {config.minimap({ position: saved.position, facing: saved.facing, done, pending: [...alerts, ...(challenge.complete ? [] : [challenge.door])], tracked: next })}
      </div>}
      {!talk && !activity && !journalOpen && !restartOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-24 lg:pb-4">
        <div className={`textbox max-w-lg space-y-2 px-4 py-3 text-center transition-opacity ${walking ? "opacity-30" : ""}`}>
          <p className="text-sm">{t(objective ?? config.idle)}</p>
          {nearLabel && <p className="text-xs text-accent-amber">{t(nearLabel)}{" · "}{t("Press Space or tap Talk")}</p>}
        </div>
      </div>}
      {talk && line && <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t(talk.title)} ref={talkRef}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); close(); } }}>
        <DialogueFrame className="max-w-4xl">
          <DialogueLine speaker={line.speaker} label={line.speaker === "system" ? t(talk.title) : undefined}>{t(line.text)}</DialogueLine>
          {talk.index === talk.lines.length - 1 && talk.card && <div className="knowledge-reveal" role="status">
            <span className="text-xs uppercase tracking-widest text-accent-teal">{t(useKnowledge.getState().fresh === talk.card ? "NEW KNOWLEDGE CARD" : "KNOWLEDGE CARD")}</span>
            <ul><KnowledgeCardView card={config.cards[talk.card]} /></ul>
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
        {step.kind === "bench" ? <QubitBench step={step} onSolved={solved} />
          : step.kind === "register" ? <RegisterBench step={step} onSolved={solved} />
          : step.kind === "rounds" ? <RoundsDial step={step} onSolved={solved} />
          : <BenchQuestion step={step} onSolved={solved} />}
        {activity.solved && <div className="laptop-challenge space-y-2" role="status">
          <p className="text-accent-teal">{t(step.feedback)}</p>
          <button className="btn-primary" autoFocus onClick={() => activity.step + 1 < npc.steps.length
            ? setActivity({ npc: activity.npc, step: activity.step + 1, solved: false }) : finishActivity(npc)}>
            {t(activity.step + 1 < npc.steps.length ? "Next step" : "Take the card")}</button>
        </div>}
      </div>
    </LaptopShell>}
  </GameShell>;
}
