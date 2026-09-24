"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SCENARIOS } from "@/content/scenarios";
import { useProgress } from "@/game/progress";
import { MuteButton } from "@/components/MuteButton";
import { gameAudio } from "@/game/audio";

export default function ScenarioPage() {
  useLocale((state) => state.locale);
  const completed = useProgress((s) => s.completed);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void gameAudio.playMusic("title");
    void Promise.resolve(useProgress.persist.rehydrate()).then(() => setReady(true));
  }, []);
  return <main className="scenario-page">
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
      <div className="flex items-center justify-between"><p className="coin-eyebrow">{t("LEARN BY PLAYING")}</p><MuteButton /></div>
      <h1 className="mt-5">{t("Quantum Playground")}</h1>
      <p className="mt-5 max-w-2xl text-xl text-stage-muted">{t("Small experiments. Real questions. Your first steps into quantum computing.")}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="btn-primary" href={ready && completed.coin?.includes("coin") ? "/scenarios/rsa" : "/scenarios/coin"}>
          {localize(ready && completed.coin?.includes("coin") ? "Continue to Breaking RSA →" : "Start with a quantum coin →")}
        </Link>
        <span className="self-center text-sm text-stage-muted">{t("No quantum experience needed")}</span>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {SCENARIOS.map((scenario) => {
          const count = ready ? (completed[scenario.id]?.length ?? 0) : 0;
          return <Link key={scenario.id} href={scenario.href} className="scenario-card" onClick={() => gameAudio.playSfx("select")}>
            <div className="flex items-center justify-between"><span className="scenario-number">{localize(scenario.number)}</span><span className="coin-badge">{localize(scenario.difficulty)}</span></div>
            <div className={`scenario-art ${scenario.id}`} aria-hidden>{scenario.id === "coin" ? <><span className="coin-token">{t("H")}<small>0</small></span><span className="text-stage-muted">{t("— H —")}</span><span className="coin-token tails">{t("T")}<small>1</small></span></> : <><span>15</span><span className="text-stage-muted">→</span><span>3 × 5</span></>}</div>
            <p className="coin-eyebrow">{localize(scenario.setting)}</p><h2 className="mt-3">{localize(scenario.title)}</h2>
            <p className="mt-4 text-stage-muted">{localize(scenario.description)}</p>
            <p className="mt-5 text-sm text-accent-teal">{localize(scenario.lessons)}</p>
            <div className="mt-6 flex items-center justify-between border-t border-stage-border pt-4 text-sm"><span>{localize(count === scenario.missions.length ? "✓ Completed" : count ? `${count}/${scenario.missions.length} missions complete` : "Ready to play")}</span><span>{t("Explore →")}</span></div>
          </Link>;
        })}
      </div>
      <p className="mt-10 text-sm text-stage-muted">{t("Pick your own path. Both scenarios are available from the start. Progress is saved in this browser.")}</p>
      <p className="mt-4 text-xs text-stage-muted">{t("Character art and audio by ")}<a href="https://kenney.nl" className="text-accent-teal">{t("Kenney")}</a>{t(" (CC0).")}</p>
    </div>
  </main>;
}
