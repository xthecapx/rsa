export interface GameViewport {
  width: number;
  height: number;
  top: number;
  left: number;
}

/** CSS pixels actually visible above browser chrome and the on-screen keyboard. */
export function viewport(): GameViewport {
  if (typeof window === "undefined") return { width: 0, height: 0, top: 0, left: 0 };
  const visual = window.visualViewport;
  const root = document.documentElement || document.body;
  return {
    width: visual?.width || window.innerWidth || root.clientWidth,
    height: visual?.height || window.innerHeight || root.clientHeight,
    top: visual?.offsetTop ?? 0,
    left: visual?.offsetLeft ?? 0,
  };
}

/** One subscription for React overlays and the container measured by Excalibur. */
export function trackViewport(): () => void {
  const root = document.documentElement;
  const visual = window.visualViewport;
  let frame = 0;
  const sync = () => {
    frame = 0;
    const size = viewport();
    root.style.setProperty("--game-viewport-width", `${size.width}px`);
    root.style.setProperty("--game-viewport-height", `${size.height}px`);
    root.style.setProperty("--game-viewport-top", `${size.top}px`);
    root.style.setProperty("--game-viewport-left", `${size.left}px`);
    root.dataset.compactViewport = String(size.height <= 550);
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(sync); };
  sync();
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  visual?.addEventListener("resize", schedule);
  visual?.addEventListener("scroll", schedule);
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.removeEventListener("pageshow", schedule);
    visual?.removeEventListener("resize", schedule);
    visual?.removeEventListener("scroll", schedule);
    for (const key of ["width", "height", "top", "left"]) root.style.removeProperty(`--game-viewport-${key}`);
    delete root.dataset.compactViewport;
  };
}
