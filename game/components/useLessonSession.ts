"use client";
import { useCallback, useEffect, useState } from "react";

/** Lesson-specific validation/migration stays in restore. Loading a save only
 * restores data: this hook never executes entry effects or backend requests.
 * Mount a new owner to change keys (the lesson screens already do this).
 */
export function useLessonSession<T>(options: {
  key: string;
  initial: T;
  restore: (saved: unknown) => T;
  unreadable: () => T;
}) {
  const [config] = useState(options);
  const [session, setSession] = useState(config.initial);
  const [hydrated, setHydrated] = useState(false);
  const [storageNote, setStorageNote] = useState(false);
  const save = useCallback(
    (value: T) => {
      try {
        localStorage.setItem(config.key, JSON.stringify(value));
      } catch {
        setStorageNote(true);
      }
    },
    [config],
  );
  useEffect(() => {
    try {
      setSession(
        config.restore(JSON.parse(localStorage.getItem(config.key) ?? "null")),
      );
    } catch {
      setSession(config.unreadable());
    }
    setHydrated(true);
  }, [config]);
  useEffect(() => {
    if (hydrated) save(session);
  }, [session, hydrated, save]);
  return { session, setSession, hydrated, storageNote, setStorageNote, save };
}
