"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

interface ConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  /** Scene stays narrow; Math needs room for blackboard prose + equations. */
  size?: "sm" | "lg";
  children: React.ReactNode;
}

const WIDTH: Record<"sm" | "lg", string> = {
  sm: "w-[min(100%,22rem)]",
  lg: "w-[min(100%,42rem)] sm:w-[min(100%,48rem)]",
};

export default function ConfigDrawer({
  open,
  onClose,
  title,
  side = "right",
  size = "sm",
  children,
}: ConfigDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close drawer"
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={clsx(
              "fixed inset-y-0 z-50 flex flex-col border-stage-border bg-stage-surface shadow-stage",
              WIDTH[size],
              side === "right" ? "right-0 border-l" : "left-0 border-r",
            )}
            initial={{ x: side === "right" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "100%" : "-100%" }}
            transition={{ type: "tween", duration: 0.22 }}
          >
            <div className="flex items-center justify-between border-b border-stage-border px-4 py-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-accent-teal">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm text-stage-muted hover:text-accent-amber"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
