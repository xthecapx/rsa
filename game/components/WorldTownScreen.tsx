"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { KnowledgeCard, KnowledgeId, Line, TownNpc } from "@/content/knowledge";
import type { MedalId } from "@/content/medals";
import type { Speaker } from "@/content/types";
import type { WorldFacing } from "@/content/town";
import type { WorldName } from "@/engine/createGame";
import { bus } from "@/engine/bus";
import { exploreAround, useTown, type TownSlot } from "@/game/town";
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
import { CryptoBench, DialBench } from "./CryptoBench";
import { DialogBox } from "./DialogBox";
import { RsaProgress } from "./RsaProgress";
import type { MissionTalk } from "./useRsaMission";

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
  /** Tiles seen so far (y * 100 + x); the rest of the map stays dark. */
  explored: number[];
}

/** A story that plays out on the town map itself (Cipher Town's RSA jobs), driven by the town screen's owner. */
export interface WorldMission {
  active: boolean;
  /** The story holds the controls: a line is showing, the laptop is open, or a step is running. */
  locked: boolean;
  talk: MissionTalk | null; closeTalk: () => void;
  /** Ids on the map the mission answers for, e.g. the car and the junction box. */
  handles: (id: string) => boolean;
  interact: (id: string) => void;
  nearLabel: (id: string) => string | null;
  /** While active: where the beacon goes and what the objective says. */
  track: string | null; objective: string | null;
  /** Show the story's text box in place of the objective. */
  dialog: boolean;
  onSceneReady: () => Promise<void>;
  layer: (restartControl: ReactNode) => ReactNode;
  restartOptions: RestartOption[];
  shell: { subtitle?: string; missionProgress?: ReactNode; backLabel?: string; onBack?: () => void; backDisabled?: boolean; laptopOpen: boolean; laptopReady: boolean; onOpenLaptop?: () => void };
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
    /** A challenge in parts (the client's four jobs): the route can name each part, which tracks its target. */
    stages?: { id: string; complete: boolean; target: string; objective: string }[];
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
  /** What a closed gate says when the player walks into it. */
  gateNotes?: Record<string, Line>;
  /** Walking onto one of these tiles leaves town. */
  exits: { test: (at: { x: number; y: number }) => boolean; go: () => void }[];
  journal: { title: string; intro: string; roads: { label: string; open: boolean }[]; extra?: ReactNode };
  /** Called once when a card is first learned here, e.g. to pay for the hand. */
  onCard?: (id: KnowledgeId) => void;
  /** Ids that open a panel of the town's own (a shop, a bounty board) instead of a conversation. */
  panels?: Record<string, (close: () => void) => ReactNode>;
  /** Shown under the minimap, e.g. a credits counter. */
  hud?: ReactNode;
  mission?: WorldMission;
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
  const [panel, setPanel] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const readyRef = useRef(false);
  const events = useRef({ interact: (_id: string) => {}, welcome: () => {}, blocked: (_gate: string) => {}, exits: config.exits, missionReady: async () => {} });
  events.current.exits = config.exits;
  events.current.missionReady = config.mission?.onSceneReady ?? (async () => {});
  const { mission } = config;
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
      const place = town[config.slot];
      town.patch({ [config.slot]: { ...place, position: event.at, facing: event.facing, explored: exploreAround(place.explored, event.at) } });
      const exit = events.current.exits.find((candidate) => candidate.test(event.at));
      if (exit) { readyRef.current = false; gameAudio.playSynth("door"); exit.go(); }
    }
    if (event.type === "worldNear") setNear(event.near);
    if (event.type === "walking") useGame.getState().setWalking(event.walking);
    if (event.type === "worldInteract") events.current.interact(event.target);
    if (event.type === "worldBlocked") events.current.blocked(event.gate);
  }), [config.slot]);

  const onReady = useCallback(async () => {
    const slot = useTown.getState()[config.slot];
    await bus.send({ type: "placePlayer", at: slot.position, facing: slot.facing });
    await events.current.missionReady();
    readyRef.current = true;
    setSceneStatus("ready");
    // The greeter meets the player before they take a step.
    if (!useTown.getState()[config.slot].welcomed) events.current.welcome();
  }, [config.slot]);
  const onError = useCallback(() => setSceneStatus("error"), []);

  const sceneReady = hydrated && sceneStatus === "ready";
  const inputLocked = !!talk || !!activity || journalOpen || restartOpen || !!panel || !!mission?.talk || !!mission?.locked;
  useEffect(() => { if (sceneReady) void bus.send({ type: "lockInput", locked: inputLocked }); }, [sceneReady, inputLocked]);
  const ready = cards.length === cardIds.length && challenge.complete;
  const stageById = (id: string) => challenge.stages?.find((stage) => stage.id === id);
  const next: string | null = !saved.welcomed || (ready && !badge) ? greeter.id : badge ? config.afterBadge()
    : config.route.find((id) => (stageById(id) ? !stageById(id)!.complete : id === challenge.door ? !challenge.complete : !cards.includes(npcById(id)!.knowledge!))) ?? greeter.id;
  const nextStage = next ? stageById(next) : undefined;
  const tracked = mission?.active ? mission.track : nextStage ? nextStage.target : next;
  const alerts = [...teachers.filter((npc) => !cards.includes(npc.knowledge!)).map((npc) => npc.id), ...(next === greeter.id ? [greeter.id] : [])];
  const done = [...(challenge.complete ? [challenge.door] : []), ...teachers.filter((npc) => cards.includes(npc.knowledge!)).map((npc) => npc.id), ...(badge ? [greeter.id] : [])];
  const gateKey = Object.entries(config.gates).map(([id, open]) => `${id}:${open}`).join();
  const markerKey = `${alerts.join()}|${done.join()}|${tracked}|${gateKey}`;
  useEffect(() => {
    if (!sceneReady) return;
    void bus.send({ type: "worldMarkers", alerts, done });
    void bus.send({ type: "worldTrack", target: tracked });
    for (const [id, open] of Object.entries(config.gates)) void bus.send({ type: "worldGate", id, open });
    // markerKey captures alerts, done, the tracked target and the gates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, markerKey]);
  useEffect(() => { talkRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [talk?.index, talk?.title, mission?.talk]);

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
  events.current.blocked = (gate) => { if (config.gateNotes?.[gate]) { gameAudio.playSfx("error"); setBlocked(gate); } };
  useEffect(() => {
    if (!blocked) return;
    const timer = window.setTimeout(() => setBlocked(null), 4000);
    return () => window.clearTimeout(timer);
  }, [blocked]);
  events.current.interact = (id) => {
    if (talk || activity || panel || mission?.talk) return;
    if (mission?.handles(id)) { mission.interact(id); return; }
    gameAudio.playSfx("select");
    if (config.panels?.[id]) setPanel(id);
    else if (id === challenge.door) say(challenge.title, [{ speaker: "system", text: challenge.blurb }],
      [{ label: challenge.complete ? challenge.resume : challenge.enter, action: () => { close(); readyRef.current = false; challenge.onEnter(); } }, { label: "Later", action: close }]);
    else if (id === greeter.id) talkToGreeter();
    else if (config.others[id]) { const other = config.others[id](); say(other.title, other.lines, [{ label: "Keep exploring", action: close }]); }
    else { const npc = npcById(id); if (npc?.knowledge) talkToTeacher(npc); }
  };

  function finishActivity(npc: TownNpc) {
    if (useKnowledge.getState().learn(npc.knowledge!)) config.onCard?.(npc.knowledge!);
    setActivity(null);
    gameAudio.playSynth("fanfare");
    say(npc.title, npc.outro, [{ label: "Keep exploring", action: close }], { card: npc.knowledge });
  }

  const restartControl = <StartOverControl options={[
    { ...config.restart, restart: () => {
      useKnowledge.getState().resetTown(cardIds);
      const town = useTown.getState();
      town.patch({ [config.slot]: { ...town[config.slot], welcomed: false } });
      setTalk(null); setActivity(null); setPanel(null);
      config.restart.restart();
    } },
    ...(mission?.restartOptions ?? []),
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
    {config.journal.extra}
    <section className="panel space-y-2 p-3" aria-label={t("Knowledge cards")}>
      <div className="flex items-baseline justify-between gap-2"><h3 className="text-accent-amber">{t("Knowledge cards")}</h3><span className="text-xs text-stage-muted">{cards.length} / {cardIds.length}</span></div>
      <ul className="knowledge-grid">{cardIds.map((id) => <KnowledgeCardView key={id} card={config.cards[id]} teacher={teacherFor(id)} learned={cards.includes(id)} />)}</ul>
    </section>
    <MedalCase compact />
  </div>;
  const nearNpc = near ? npcById(near) : undefined;
  const nearLabel = near && mission?.nearLabel(near) ? mission.nearLabel(near) : near === challenge.door ? challenge.enter : near && config.nearLabels[near] ? config.nearLabels[near] : nearNpc ? `${t("Talk to")} ${t(nearNpc.title)}` : null;
  const nextNpc = next ? npcById(next) : undefined;
  const objective = mission?.active ? mission.objective
    : nextStage ? nextStage.objective
    : next === greeter.id ? (badge ? null : ready ? config.badge.collect : greeter.meet)
    : next === challenge.door ? challenge.objective
    : nextNpc?.knowledge ? `${t("Next")}: ${t(nextNpc.title)} · ${t(nextNpc.description)}`
    : next ? config.objectiveFor(next) : null;
  const line = talk?.lines[talk.index];

  const missionShell = mission?.active ? mission.shell : null;
  const missionTalk = mission?.talk;
  return <GameShell restartControl={restartControl} title={t(config.title)} subtitle={missionShell?.subtitle ?? t(config.subtitle)}
    missionProgress={missionShell?.missionProgress}
    backHref="/" backLabel={missionShell?.backLabel ?? t(greeter.title)} backDisabled={missionShell?.backDisabled}
    onBack={() => { if (missionShell?.onBack) missionShell.onBack(); else if (!talk && !activity) talkToGreeter(); }}
    sidebar={journal} objectives={journal} onObjectivesOpen={setJournalOpen}
    sceneReady={sceneReady} sceneFailed={sceneStatus === "error"} laptopOpen={!!activity || !!missionShell?.laptopOpen} laptopReady={!!missionShell?.laptopReady}
    onOpenLaptop={() => missionShell?.onOpenLaptop ? missionShell.onOpenLaptop()
      : say("Your laptop", [{ speaker: "system", text: "Neighbors lend you their benches here. Talk to anyone whose name board starts with !." }], [{ label: "Keep exploring", action: close }])}>
    {hydrated && <GameCanvas world={config.world} onReady={onReady} onError={onError} />}
    {sceneReady && <>
      {!talk && !activity && !journalOpen && !restartOpen && !panel && !missionTalk && !missionShell?.laptopOpen && <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
        {config.minimap({ position: saved.position, facing: saved.facing, explored: saved.explored, done, pending: [...alerts, ...(challenge.complete ? [] : [challenge.door])], tracked })}
        {config.hud}
      </div>}
      {!talk && !activity && !journalOpen && !restartOpen && !panel && !missionTalk && !missionShell?.laptopOpen && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 pb-24 lg:pb-4">
        {mission?.active && mission.dialog ? <DialogBox /> : blocked && config.gateNotes?.[blocked] ? <div className="textbox gate-note max-w-lg space-y-1 px-4 py-3 text-center" role="status">
          <p className="text-xs font-bold uppercase tracking-widest text-[#fca5a5]">🔒 {t("Locked")}</p>
          <p className="text-sm">{t(config.gateNotes[blocked].text)}</p>
        </div> : <div className={`textbox max-w-lg space-y-2 px-4 py-3 text-center transition-opacity ${walking ? "opacity-30" : ""}`}>
          <p className="text-sm">{t(objective ?? config.idle)}</p>
          {nearLabel && <p className="text-xs text-accent-amber">{t(nearLabel)}{" · "}{t("Press Space or tap Talk")}</p>}
        </div>}
      </div>}
      {missionTalk && <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t(missionTalk.title)} ref={talkRef}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); mission!.closeTalk(); } }}>
        <DialogueFrame className="max-w-4xl">
          {missionTalk.rsaAct && <div className="shrink-0"><RsaProgress act={missionTalk.rsaAct} /></div>}
          <DialogueLine speaker={missionTalk.speaker ?? "boss"} label={t(missionTalk.title)}>{missionTalk.parts ? missionTalk.parts.map((part) => t(part)).join(" ") : t(missionTalk.text)}</DialogueLine>
          <div className="flex min-h-0 flex-wrap gap-2 overflow-y-auto">{missionTalk.choices.map((choice) => <button key={choice.label} className="btn-ghost text-sm" onClick={() => { gameAudio.playSfx("select"); choice.action(); }}>
            {choice.done ? "✓ " : ""}{t(choice.label)}</button>)}</div>
        </DialogueFrame>
      </div>}
      {panel && config.panels?.[panel]?.(() => setPanel(null))}
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
    {npc && step && activity && <LaptopShell open calculator={npc.steps.some((candidate) => candidate.kind === "crypto")} title={`${t(npc.title)} · ${t(step.title)}`} status={`${t("Step ")}${activity.step + 1}/${npc.steps.length}`}
      onClose={() => setActivity(null)} footer={<p>{t("Close the laptop to stop. The card is yours once every step is done.")}</p>}>
      <div key={`${activity.npc}-${activity.step}`} className="space-y-3">
        {step.kind === "bench" ? <QubitBench step={step} onSolved={solved} />
          : step.kind === "register" ? <RegisterBench step={step} onSolved={solved} />
          : step.kind === "rounds" ? <RoundsDial step={step} onSolved={solved} />
          : step.kind === "crypto" ? <CryptoBench step={step} onSolved={solved} />
          : step.kind === "dial" ? <DialBench step={step} onSolved={solved} />
          : <BenchQuestion step={step} onSolved={solved} />}
        {activity.solved && <div className="laptop-challenge space-y-2" role="status">
          <p className="text-accent-teal">{t(step.feedback)}</p>
          <button className="btn-primary" autoFocus onClick={() => activity.step + 1 < npc.steps.length
            ? setActivity({ npc: activity.npc, step: activity.step + 1, solved: false }) : finishActivity(npc)}>
            {t(activity.step + 1 < npc.steps.length ? "Next step" : "Take the card")}</button>
        </div>}
      </div>
    </LaptopShell>}
    {sceneReady && mission?.layer(restartControl)}
  </GameShell>;
}
