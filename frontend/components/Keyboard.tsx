"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type KeyState } from "@/lib/api";
import { useGameStore } from "@/store/game";

interface KeyboardProps {
  modulus?: number;
  requireCoprime?: boolean;
  onSelect?: (char: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function Keyboard({
  modulus,
  requireCoprime = false,
  onSelect,
  disabled = false,
  compact = false,
}: KeyboardProps) {
  const selectedChar = useGameStore((s) => s.selectedChar);
  const setSelectedChar = useGameStore((s) => s.setSelectedChar);
  const [keys, setKeys] = useState<KeyState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .keyboard({ modulus, require_coprime: requireCoprime })
      .then((res) => {
        if (!cancelled) setKeys(res.keys);
      })
      .catch(() => {
        if (!cancelled) {
          setKeys(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((char, i) => ({
              char,
              value: i + 1,
              enabled: true,
              disabled_reason: null,
            })),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modulus, requireCoprime]);

  const handleSelect = (char: string, enabled: boolean) => {
    if (!enabled || disabled) return;
    setSelectedChar(char);
    onSelect?.(char);
  };

  return (
    <div className={clsx("panel", compact ? "px-2 py-2" : "p-3")}>
      <div className="mb-1.5">
        <h3 className="font-display text-[10px] uppercase tracking-[0.15em] text-stage-muted">
          Message
        </h3>
      </div>

      {loading ? (
        <p className="text-xs text-stage-muted">Loading keys…</p>
      ) : (
        <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1">
          {keys.map((key) => (
            <button
              key={key.char}
              type="button"
              title={
                key.enabled
                  ? `${key.char} → ${key.value}`
                  : key.disabled_reason ?? "Disabled"
              }
              disabled={!key.enabled || disabled}
              onClick={() => handleSelect(key.char, key.enabled)}
              className={clsx(
                "rounded border font-mono transition",
                compact ? "px-0 py-1 text-xs" : "px-1 py-1.5 text-sm",
                selectedChar === key.char && key.enabled
                  ? "border-accent-amber bg-accent-amber/20 text-accent-amber shadow-glow"
                  : key.enabled
                    ? "border-stage-border bg-stage-bg/50 hover:border-accent-teal hover:text-accent-teal"
                    : "cursor-not-allowed border-stage-border/40 bg-stage-bg/20 text-stage-muted/40 line-through",
              )}
            >
              {key.char}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
