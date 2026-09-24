"use client";
import { t, localize, useLocale } from "@/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ACT_NUMBERS, getAct } from "@/content";
import { useProgress } from "@/game/progress";
import { MuteButton } from "@/components/MuteButton";

export default function RsaScenarioPage() {
  useLocale((state) => state.locale);
  const completed = useProgress((s) => s.completed);
  const [ready, setReady] = useState(false);
  useEffect(() => { void Promise.resolve(useProgress.persist.rehydrate()).then(() => setReady(true)); }, []);
  return <main className="scenario-page"><div className="mx-auto max-w-3xl px-6 py-12">
    <div className="flex justify-between"><Link className="text-accent-teal" href="/">{t("← Scenarios")}</Link><MuteButton /></div>
    <p className="coin-eyebrow mt-10">{t("SCENARIO 02 · INTERMEDIATE")}</p><h1 className="mt-4">{t("Breaking RSA")}</h1>
    <p className="mt-5 text-lg text-stage-muted">{t("One street, one cable, one eavesdropper. Intercept Ale and Brayan’s messages as they try harder to keep you out.")}</p>
    <p className="mt-4 text-stage-muted">{t("Four missions take you from readable messages to quantum period finding. New to circuits? ")}<Link href="/scenarios/coin" className="text-accent-teal">{t("Try the quantum coin first.")}</Link></p>
    <ol className="mt-8 space-y-4">{ACT_NUMBERS.map((act) => {
      const script = getAct(act);
      return <li key={act}><Link className="scenario-card block" href={`/scenarios/rsa/play/${act}`}>
        <p className="text-sm text-accent-teal">{t("MISSION ")}{act}{localize(ready && completed.rsa?.includes(String(act)) ? " · ✓ Complete" : "")}</p>
        <h2 className="mt-2">{localize(script.title)}</h2><p className="mt-3 text-stage-muted">{localize(script.brief)}</p>
      </Link></li>;
    })}</ol>
  </div></main>;
}
