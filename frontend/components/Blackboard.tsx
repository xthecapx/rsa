"use client";

import { useMemo } from "react";
import katex from "katex";
import clsx from "clsx";
import { buildMathBoard, type MathSection } from "@/lib/mathBoard";
import { useGameStore } from "@/store/game";

interface BlackboardProps {
  className?: string;
  compact?: boolean;
}

function renderKatex(tex: string, displayMode = true) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: "ignore",
    });
  } catch {
    return `<span>${tex}</span>`;
  }
}

function EquationBlock({ tex }: { tex: string }) {
  return (
    <div
      className="blackboard-eq mt-2 overflow-x-auto rounded-lg bg-black/25 px-3 py-3"
      dangerouslySetInnerHTML={{ __html: renderKatex(tex, true) }}
    />
  );
}

function Section({
  section,
  compact,
}: {
  section: MathSection;
  compact?: boolean;
}) {
  return (
    <div className="mt-4 border-t border-stage-border/40 pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <h4 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent-amber">
        {section.title}
      </h4>
      {section.prose && (
        <p
          className={clsx(
            "mt-1.5 font-body leading-relaxed text-blackboard-chalk",
            compact ? "text-sm" : "text-base",
          )}
        >
          {section.prose}
        </p>
      )}
      {section.equations.map((eq) => (
        <EquationBlock key={eq} tex={eq} />
      ))}
    </div>
  );
}

/**
 * Talk blackboard: live substituted encrypt/decrypt equations from game state.
 */
export default function Blackboard({
  className,
  compact = false,
}: BlackboardProps) {
  const act = useGameStore((s) => s.act);
  const tier = useGameStore((s) => s.tier);
  const shift = useGameStore((s) => s.shift);
  const modulus = useGameStore((s) => s.modulus);
  const shorA = useGameStore((s) => s.shorA);
  const selectedChar = useGameStore((s) => s.selectedChar);
  const payload = useGameStore((s) => s.messagePayload);
  const rsaKeys = useGameStore((s) => s.rsaKeys);
  const rsaCipher = useGameStore((s) => s.rsaCipher);

  const content = useMemo(
    () =>
      buildMathBoard({
        act,
        tier,
        shift,
        modulus,
        shorA,
        selectedChar,
        payload,
        rsaKeys,
        rsaCipher,
      }),
    [
      act,
      tier,
      shift,
      modulus,
      shorA,
      selectedChar,
      payload,
      rsaKeys,
      rsaCipher,
    ],
  );

  return (
    <aside
      className={clsx(
        "rounded-xl border border-stage-border",
        "bg-[var(--blackboard-bg)] shadow-inner",
        compact ? "p-3" : "p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent-amber/80" />
        <h3 className="font-display text-xs uppercase tracking-[0.2em] text-accent-teal">
          Blackboard · level {tier}
        </h3>
      </div>

      {content.prose && (
        <p
          className={clsx(
            "mb-1 font-body leading-relaxed text-blackboard-chalk",
            compact ? "text-sm" : "text-base sm:text-lg",
          )}
        >
          {content.prose}
        </p>
      )}

      {content.sections.map((section) => (
        <Section key={section.title} section={section} compact={compact} />
      ))}

      {tier >= 2 && content.theory.length > 0 && (
        <div className="mt-4 border-t border-stage-border/40 pt-3">
          <h4 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent-teal">
            Extra theory
          </h4>
          {content.theory.map((eq) => (
            <EquationBlock key={eq} tex={eq} />
          ))}
        </div>
      )}
    </aside>
  );
}
