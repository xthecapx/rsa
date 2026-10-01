"use client";

import { useEffect, useRef, useState } from "react";
import { ACT_NUMBERS, getAct } from "@/content";
import type { ActNumber } from "@/content/types";
import { BOUNTY_PAY, CARD_COUNT, CARD_PAY, CERO, CHISPA, CIPHER_BOARD, CIPHER_SIGNS, CIPHER_NORTH_ROAD, CIPHER_NPCS, CIPHER_SOUTH_ROAD, CLIENT, GEAR, JOB_OBJECTIVES, KNOWLEDGE, ROOT,
  gearFor, makeBounty, type CipherNpcId } from "@/content/cipher";
import type { CipherKnowledgeId } from "@/content/knowledge";
import { LANDMARKS, type Landmark } from "@/engine/maps/street";
import { cipherMap } from "@/engine/maps/cipherMap";
import { bus } from "@/engine/bus";
import { useGame } from "@/game/state";
import { useProgress } from "@/game/progress";
import { useTown } from "@/game/town";
import { useTravelPass } from "@/game/travelPass";
import { useWallet } from "@/game/wallet";
import { openRoads } from "@/game/roads";
import { fill } from "@/game/interpolate";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";
import { CryptoBench, DialBench } from "./CryptoBench";
import { DialogueFrame, DialogueLine } from "./DialoguePresentation";
import { LaptopShell } from "./LaptopShell";
import { RsaProgress } from "./RsaProgress";
import type { RestartOption } from "./StartOverControl";
import { SuspicionMeter } from "./SuspicionMeter";
import { useRsaMission, type MissionTalk } from "./useRsaMission";
import { WorldMinimap, type MinimapPlace } from "./WorldMinimap";
import { WorldTownScreen, type TownConfig } from "./WorldTownScreen";

/** The order Root Cap suggests: each neighbor's card comes just before the job that uses it. */
const ROUTE = ["lupe", "act1", "tadeo", "act2", "nina", "paloma", "act3", "dante", "act4"];
const TEACHER_ORDER: CipherNpcId[] = ["lupe", "tadeo", "nina", "paloma", "dante"];
const TEACHERS = TEACHER_ORDER.map((id) => CIPHER_NPCS.find((npc) => npc.id === id)!);
const LANDMARK_IDS = Object.keys(LANDMARKS) as Landmark[];
const NEAR_LABELS: Record<Landmark, string> = { car: "Talk to the RSA client", tap: "Inspect the junction box", ale: "Talk", brayan: "Talk" };
const PLACES: MinimapPlace[] = [
  { id: "car", at: LANDMARKS.car.at, label: "The client", symbol: "C" },
  { id: "rootcap", at: CIPHER_NPCS.find((npc) => npc.id === "rootcap")!.at, label: "Root Cap", symbol: "R" },
  { id: "chispa", at: CIPHER_NPCS.find((npc) => npc.id === "chispa")!.at, label: "Chispa", symbol: "$" },
  { id: "bountyBoard", at: CIPHER_BOARD.at, label: "Bounty board", symbol: "B" },
  ...TEACHERS.map((npc, i) => ({ id: npc.id, at: npc.at, label: npc.title, symbol: String(i + 1) })),
];

/** Credits in the corner, with a short "+30" whenever someone pays. */
function Credits() {
  useLocale((state) => state.locale);
  const credits = useWallet((state) => state.credits);
  const last = useRef(credits);
  const [gain, setGain] = useState<number | null>(null);
  useEffect(() => {
    const diff = credits - last.current;
    last.current = credits;
    if (diff <= 0) return;
    setGain(diff);
    const timer = window.setTimeout(() => setGain(null), 2200);
    return () => window.clearTimeout(timer);
  }, [credits]);
  return <p className="panel bg-stage-bg/95 px-3 py-1 text-xs text-accent-amber" role="status">
    ◈ {credits} {t("credits")}{gain !== null && <span className="ml-2 text-accent-teal">+{gain}</span>}
  </p>;
}

/** Chispa's stall: the gear each job needs, bought with the client's money. */
function Shop({ close }: { close: () => void }) {
  useLocale((state) => state.locale);
  const { credits, gear, buy } = useWallet();
  const [line, setLine] = useState(CHISPA.hello);
  return <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t("Chispa’s gear stall")}
    onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); close(); } }}>
    <DialogueFrame className="max-w-4xl">
      <DialogueLine speaker="chispa" label={t("Chispa")}>{t(line.text)}</DialogueLine>
      <div className="grid min-h-0 gap-2 overflow-y-auto sm:grid-cols-2">
        {GEAR.map((item) => {
          const owned = gear.includes(item.id);
          return <div key={item.id} className={`shop-item ${owned ? "owned" : ""}`}>
            <span className="shop-glyph" aria-hidden="true">{item.glyph}</span>
            <span><strong>{t(item.title)}</strong> <span className="text-xs text-stage-muted">· RSA {t(`Act ${item.act}: ${getAct(item.act).title}`)}</span><br /><span className="text-xs">{t(item.text)}</span></span>
            {owned ? <span className="text-xs text-accent-teal">✓ {t("Owned")}</span>
              : <button className="btn-ghost text-xs" onClick={() => {
                if (buy(item.id)) { gameAudio.playSynth("chime"); setLine(CHISPA.bought); } else { gameAudio.playSfx("error"); setLine(CHISPA.short); }
              }}>{t("Buy")} · ◈ {item.price}</button>}
          </div>;
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-accent-amber">◈ {credits} {t("credits")}</span>
        <button className="btn-ghost text-sm" autoFocus onClick={close}>{t("Keep exploring")}</button>
      </div>
    </DialogueFrame>
  </div>;
}

/** Cero's board: one generated lock at a time, paid every time. */
function Bounty({ close }: { close: () => void }) {
  useLocale((state) => state.locale);
  const bounties = useWallet((state) => state.bounties);
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 100000));
  const [solved, setSolved] = useState(false);
  const step = makeBounty(seed);
  return <LaptopShell open calculator title={`${t("Cero")} · ${t(step.title)}`} status={`${t("Bounties solved")}: ${bounties}`} onClose={close}
    footer={<p>{t(CERO.hello.text)}</p>}>
    <div key={seed} className="space-y-3">
      {step.kind === "dial" ? <DialBench step={step} onSolved={() => setSolved(true)} /> : <CryptoBench step={step} onSolved={() => setSolved(true)} />}
      {solved && <div className="laptop-challenge space-y-2" role="status">
        <p className="text-accent-teal">{fill(t(step.feedback), step.vars ?? {})} {t(CERO.paid.text)}</p>
        <button className="btn-primary" autoFocus onClick={() => {
          useWallet.getState().payBounty(BOUNTY_PAY); gameAudio.playSynth("fanfare");
          setSolved(false); setSeed(seed + 1 + Math.floor(Math.random() * 7));
        }}>{t("Collect and take another")}</button>
        <button className="btn-ghost" onClick={() => { useWallet.getState().payBounty(BOUNTY_PAY); close(); }}>{t("Collect and close")}</button>
      </div>}
    </div>
  </LaptopShell>;
}

export function CipherScreen({ onSouth, onNorth, restartOptions }: {
  /** South road back to Coin Town, north road on to Quantum Town. */
  onSouth: () => void; onNorth: () => void;
  restartOptions: RestartOption[];
}) {
  useLocale((state) => state.locale);
  const completed = useProgress((state) => state.completed);
  const { gear, advanced } = useWallet();
  const badge = !!completed.rsa?.includes("town");
  const pass = useTravelPass((state) => state.active);
  const metThecap = useTown((state) => state.welcomed);
  const game = useGame();
  const [talk, setTalk] = useState<MissionTalk | null>(null);
  const readyRef = useRef(true);
  const actDone = (act: ActNumber) => !!completed.rsa?.includes(String(act));
  const northOpen = openRoads({ pass, badges: { coin: false, foundry: false, hollow: false, cipher: badge }, metThecap, rsaActs: 0 }).cipherNorth;
  const allActs = ACT_NUMBERS.every(actDone);

  const toStall = { label: "Head to Chispa’s stall", action: () => setTalk(null) };
  const mission = useRsaMission({
    where: "cipher", position: () => useTown.getState().cipher.position, readyRef, say: setTalk,
    // The client won't start a job without the gear it needs; replays of a finished job don't ask.
    gate: (act) => actDone(act) || useWallet.getState().gear.includes(gearFor(act).id) ? null
      : { title: "The client", text: gearFor(act).need, choices: [toStall, { label: "Later", action: () => setTalk(null) }] },
  });

  useEffect(() => {
    useWallet.getState().grantFor(ACT_NUMBERS.filter(actDone));
    mission.restore();
    // Once per visit (the town screen has loaded the wallet): old saves own the gear for jobs they finished, and a running job resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leave(go: () => void) { return () => { if (mission.pause()) { readyRef.current = false; go(); } }; }
  function interact(id: string) {
    // The first visit to the car: the client pays an advance and sends you shopping.
    if (id === "car" && !mission.active && !useWallet.getState().advanced) {
      useWallet.getState().advance();
      setTalk({ title: "The client", text: CLIENT.advance.map((line) => line.text).join(" "), parts: CLIENT.advance.map((line) => line.text), choices: [toStall] });
      return;
    }
    if (!mission.interact(id as Landmark)) void bus.send({ type: "lockInput", locked: false });
  }

  const config: TownConfig = {
    world: "cipher", slot: "cipher",
    title: "Cipher Town", subtitle: "Learn the locks · take the client’s jobs",
    greeter: {
      id: "rootcap", title: "Root Cap", meet: "Meet Root Cap by the south gate", thanks: "Thank you, Root",
      welcome: [ROOT.welcome, ROOT.client], guide: ROOT.guide, count: CARD_COUNT,
      waiting: ROOT.actsWaiting, challengeDone: ROOT.actsDone, ready: ROOT.ready, done: ROOT.done,
    },
    teachers: TEACHERS, cards: KNOWLEDGE, npcs: CIPHER_NPCS,
    challenge: {
      door: "car", title: "Breaking RSA", complete: allActs,
      blurb: "", enter: "Talk to the RSA client", resume: "Talk to the RSA client",
      objective: "Talk to the client by the parked car", journal: "Finish the client’s four jobs",
      onEnter: () => {},
      stages: ACT_NUMBERS.map((act) => {
        const item = gearFor(act), ready = actDone(act) || gear.includes(item.id) || !advanced;
        return { id: `act${act}`, complete: actDone(act), target: ready ? "car" : "chispa", objective: !advanced ? JOB_OBJECTIVES[1] : ready ? JOB_OBJECTIVES[act] : item.objective };
      }),
    },
    route: ROUTE,
    badge: { medal: "cipher-town", award: () => useProgress.getState().complete("rsa", "town"), journal: "Earn the Cipher Badge", collect: "Collect your badge from Root Cap" },
    afterBadge: () => null,
    objectiveFor: () => null,
    idle: "The Cipher Badge is yours. The north road leads to Quantum Town; the south road goes back to Coin Town.",
    others: {},
    nearLabels: { bountyBoard: "Read the bounty board", chispa: "Browse Chispa’s gear", cero: "Read the bounty board" },
    gates: { north: northOpen },
    gateNotes: { north: CIPHER_SIGNS.northClosed },
    exits: [
      { test: (at) => at.y === cipherMap.height - 1 && CIPHER_SOUTH_ROAD.includes(at.x), go: leave(onSouth) },
      { test: (at) => at.y === 0 && CIPHER_NORTH_ROAD.includes(at.x), go: leave(onNorth) },
    ],
    journal: {
      title: "Cipher Town journal", intro: "Learn from the neighbors, buy each job’s gear from Chispa, finish the client’s four jobs, then see Root Cap for the Cipher Badge.",
      roads: [{ label: "Take the south road back to Coin Town", open: true }, { label: "Take the north road to Quantum Town", open: northOpen }],
      extra: <section className="panel space-y-2 p-3" aria-label={t("Gear")}>
        <div className="flex items-baseline justify-between gap-2"><h3 className="text-accent-amber">{t("Gear")}</h3><Credits /></div>
        <ul className="space-y-1">{GEAR.map((item) => <li key={item.id}>{gear.includes(item.id) ? "✓ " : "◇ "}{item.glyph} {t(item.title)} · ◈ {item.price}</li>)}</ul>
      </section>,
    },
    onCard: (id) => useWallet.getState().payCard(id as CipherKnowledgeId, CARD_PAY),
    panels: { chispa: (close) => <Shop close={close} />, bountyBoard: (close) => <Bounty close={close} />, cero: (close) => <Bounty close={close} /> },
    hud: <>{mission.active && <div className="pointer-events-none"><SuspicionMeter /></div>}<Credits /></>,
    mission: {
      active: mission.active,
      locked: mission.active && (mission.starting || game.phase !== "exploring" || game.laptopOpen),
      talk, closeTalk: () => setTalk(null),
      handles: (id) => LANDMARK_IDS.includes(id as Landmark),
      interact,
      nearLabel: (id) => NEAR_LABELS[id as Landmark] ?? null,
      track: game.pendingTravel?.at ?? null, objective: game.pendingTravel?.objective ?? null,
      dialog: game.phase !== "exploring",
      onSceneReady: mission.sceneReady,
      layer: mission.layer,
      restartOptions: mission.restartOptions,
      shell: {
        subtitle: `${t("Act")} ${game.act}: ${t(getAct(game.act).title)}`, missionProgress: <RsaProgress act={game.act} showObjective />,
        backLabel: t("Pause mission"), onBack: () => { mission.pause(); }, backDisabled: mission.blocked,
        laptopOpen: game.laptopOpen, laptopReady: game.waitingFor === "workbench",
        onOpenLaptop: () => { if (!talk) useGame.getState().setLaptopOpen(true); },
      },
    },
    restart: { label: "Restart Cipher Town", description: "Forget the five Cipher cards and meet Root Cap again. Your medals, credits, gear and the client’s jobs stay.", restart: () => {} },
    minimap: (props) => <WorldMinimap {...props} map={cipherMap} places={PLACES}
      roads={[{ at: { x: CIPHER_SOUTH_ROAD[1] + 0.5, y: cipherMap.height + 1 }, glyph: "↓", title: "South road to Coin Town" },
        { at: { x: CIPHER_NORTH_ROAD[0] + 1, y: -0.6 }, glyph: "↑", title: "North road to Quantum Town", locked: !northOpen }]}
      ariaLabel="Cipher Town map: C is the client’s car, R is Root Cap, $ is Chispa’s gear stall, B is the bounty board, 1 to 5 are the neighbors with knowledge cards, and the arrows are the south road to Coin Town and the north road to Quantum Town."
      legend={[`C · ${t("The client")}　R · ${t("Root Cap")}　$ · ${t("Chispa")}　B · ${t("Bounty board")}`, TEACHERS.map((npc, i) => `${i + 1} · ${t(npc.title)}`).join("　")]} />,
  };
  return <WorldTownScreen config={config} restartOptions={restartOptions} />;
}
