import { createJSONStorage } from "zustand/middleware";

// Keep Zustand's persistence API present even in opaque-origin iframes and
// private browsing. Rehydrating again must retain this visit's progress.
const memory = new Map<string, string>();
const failedWrites = new Set<string>();
export let storageUnavailable = false;

export function saveStorage<T>(onUnavailable?: () => void) {
  const unavailable = () => { storageUnavailable = true; onUnavailable?.(); };
  return createJSONStorage<T>(() => ({
    getItem(key) {
      if (failedWrites.has(key)) return memory.get(key) ?? null;
      try {
        const value = window.localStorage.getItem(key);
        if (value === null) memory.delete(key);
        else memory.set(key, value);
        return value;
      } catch {
        unavailable();
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try { window.localStorage.setItem(key, value); failedWrites.delete(key); }
      catch { failedWrites.add(key); unavailable(); }
    },
    removeItem(key) {
      memory.delete(key);
      try { window.localStorage.removeItem(key); failedWrites.delete(key); }
      catch { failedWrites.add(key); unavailable(); }
    },
  }));
}
