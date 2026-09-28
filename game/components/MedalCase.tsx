"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { MEDALS, getMedal, type MedalId } from "@/content/medals";
import { useMedals } from "@/game/medals";
import { gameAudio } from "@/game/audio";
import { t, useLocale } from "@/i18n";

/** Pokémon-badge style case: every lesson leaves a medal, and each medal is a skill kept for later challenges. */
export function MedalCase({ compact = false }: { compact?: boolean }) {
  useLocale((state) => state.locale);
  const earned = useMedals((state) => state.earned);
  const count = MEDALS.filter((medal) => earned[medal.id]).length;
  return <section className="panel space-y-2 p-3" aria-label={t("Medal case")}>
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-accent-amber">{t("Medal case")}</h3>
      <span className="text-xs text-stage-muted">{count} / {MEDALS.length}</span>
    </div>
    <ul className={clsx("medal-grid", compact && "medal-grid-compact")}>
      {MEDALS.map((medal) => {
        const has = !!earned[medal.id];
        return <li key={medal.id} className={clsx("medal", has ? "medal-earned" : "medal-locked")} title={t(has ? medal.ability : medal.hint)}>
          <span aria-hidden="true" className="medal-glyph">{has ? medal.glyph : "?"}</span>
          <span className="medal-title">{t(has ? medal.title : "Unknown medal")}</span>
          {!compact && <span className="medal-skill">{t(has ? medal.skill : medal.hint)}</span>}
          <span className="sr-only"> · {t(has ? "Earned" : "Not earned yet")}</span>
        </li>;
      })}
    </ul>
    {!compact && <p className="text-xs text-stage-muted">{t("Medals are the skills you keep. Replaying a lesson never removes one.")}</p>}
  </section>;
}

/** Ceremony card shown when a lesson ends. Says whether the medal is new or was already in the case. */
export function MedalReveal({ id }: { id: MedalId }) {
  useLocale((state) => state.locale);
  const fresh = useMedals((state) => state.fresh);
  const owned = useMedals((state) => !!state.earned[id]);
  const medal = getMedal(id);
  const isNew = fresh === id;
  useEffect(() => () => { if (useMedals.getState().fresh === id) useMedals.getState().dismiss(); }, [id]);
  // This ceremony is the only win sound: a fanfare for a new medal, a short chime for a repeat.
  const sounded = useRef(false);
  useEffect(() => {
    if (sounded.current || (!owned && !isNew)) return;
    sounded.current = true;
    gameAudio.playSynth(isNew ? "fanfare" : "chime");
  }, [isNew, owned]);
  if (!owned && !isNew) return null;
  return <div className={clsx("medal-reveal", isNew && "medal-reveal-new")} role="status">
    <span className="medal-reveal-label">{t(isNew ? "NEW MEDAL" : "MEDAL ALREADY IN YOUR CASE")}</span>
    <span aria-hidden="true" className="medal-reveal-glyph">{medal.glyph}</span>
    <h3 className="medal-reveal-title">{t(medal.title)}</h3>
    <p className="text-xs text-accent-teal">{t("Skill")}: {t(medal.skill)}</p>
    <p className="text-[11px] leading-relaxed text-stage-muted">{t(medal.description)}</p>
    <p className="medal-reveal-ability">{t(medal.ability)}</p>
  </div>;
}
