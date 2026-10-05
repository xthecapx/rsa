import { useEffect, useState, type ComponentType } from "react";

/** Load after mount, keeping the engine's browser-only initialization lazy. */
export default function dynamic<P extends object>(load: () => Promise<ComponentType<P>>, _options?: { ssr: boolean }) {
  return function BrowserComponent(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | null>(null);
    useEffect(() => {
      let alive = true;
      void load().then((component) => { if (alive) setComponent(() => component); });
      return () => { alive = false; };
    }, []);
    return Component ? <Component {...props} /> : null;
  };
}
