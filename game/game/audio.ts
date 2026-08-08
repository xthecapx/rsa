import { create } from "zustand";

/** Kenney CC0 clips under public/assets/kenney/audio/. */
export const AUDIO = {
  music: {
    title: "/assets/kenney/audio/music/mission-plausible.ogg",
    play: "/assets/kenney/audio/music/infinite-descent.ogg",
  },
  jingles: {
    intro: "/assets/kenney/audio/jingles/intro.ogg",
    win: "/assets/kenney/audio/jingles/win.ogg",
    lose: "/assets/kenney/audio/jingles/lose.ogg",
  },
  sfx: {
    click: "/assets/kenney/audio/sfx/click.ogg",
    switch: "/assets/kenney/audio/sfx/switch.ogg",
    rollover: "/assets/kenney/audio/sfx/rollover.ogg",
    confirm: "/assets/kenney/audio/sfx/confirm.ogg",
    error: "/assets/kenney/audio/sfx/error.ogg",
    select: "/assets/kenney/audio/sfx/select.ogg",
    computer: "/assets/kenney/audio/sfx/computer.ogg",
  },
} as const;

export type MusicTrack = keyof typeof AUDIO.music;
export type JingleId = keyof typeof AUDIO.jingles;
export type SfxId = keyof typeof AUDIO.sfx;

const MUTE_KEY = "mitm-audio-muted";
const BGM_VOLUME = 0.35;
const JINGLE_VOLUME = 0.55;
const SFX_VOLUME = 0.5;

type AudioState = {
  unlocked: boolean;
  muted: boolean;
  ready: boolean;
  track: MusicTrack | null;
  setUnlocked: (unlocked: boolean) => void;
  setMuted: (muted: boolean) => void;
  setReady: (ready: boolean) => void;
  setTrack: (track: MusicTrack | null) => void;
};

export const useAudio = create<AudioState>((set) => ({
  unlocked: false,
  muted: false,
  ready: false,
  track: null,
  setUnlocked: (unlocked) => set({ unlocked }),
  setMuted: (muted) => set({ muted }),
  setReady: (ready) => set({ ready }),
  setTrack: (track) => set({ track }),
}));

function readMutedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMutedPreference(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode may block storage; mute still works in-memory.
  }
}

class GameAudioController {
  private bgm: HTMLAudioElement | null = null;
  private jingle: HTMLAudioElement | null = null;
  private sfxCache = new Map<string, HTMLAudioElement>();
  private preloadPromise: Promise<void> | null = null;
  private desiredTrack: MusicTrack | null = null;

  preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;

    useAudio.getState().setMuted(readMutedPreference());

    const urls = [
      ...Object.values(AUDIO.music),
      ...Object.values(AUDIO.jingles),
      ...Object.values(AUDIO.sfx),
    ];

    this.preloadPromise = Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const audio = new Audio();
            audio.preload = "auto";
            const done = () => resolve();
            audio.addEventListener("canplaythrough", done, { once: true });
            audio.addEventListener("error", done, { once: true });
            audio.src = url;
            // Kick the load; some browsers need this for canplaythrough.
            void audio.load();
            this.sfxCache.set(url, audio);
          }),
      ),
    ).then(() => {
      useAudio.getState().setReady(true);
    });

    return this.preloadPromise;
  }

  /** First user gesture: unlock playback and start title music. */
  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (useAudio.getState().unlocked) {
      await this.playMusic(this.desiredTrack ?? "title");
      return;
    }

    const muted = readMutedPreference();
    useAudio.getState().setMuted(muted);
    useAudio.getState().setUnlocked(true);

    this.playSfx("confirm");

    // Play a short intro sting, then settle into looping title BGM.
    if (!muted) {
      await this.playJingle("intro");
    }
    await this.playMusic(this.desiredTrack ?? "title");
  }

  setMuted(muted: boolean): void {
    writeMutedPreference(muted);
    useAudio.getState().setMuted(muted);
    if (this.bgm) this.bgm.muted = muted;
    if (this.jingle) this.jingle.muted = muted;
    if (!muted && useAudio.getState().unlocked && this.desiredTrack) {
      void this.playMusic(this.desiredTrack);
    }
    if (muted && this.bgm) {
      this.bgm.pause();
    }
  }

  toggleMute(): void {
    this.setMuted(!useAudio.getState().muted);
    this.playSfx("switch");
  }

  async playMusic(track: MusicTrack): Promise<void> {
    this.desiredTrack = track;
    useAudio.getState().setTrack(track);
    if (!useAudio.getState().unlocked) return;

    const url = AUDIO.music[track];
    const muted = useAudio.getState().muted;

    if (this.bgm && this.bgm.dataset.track === track) {
      this.bgm.muted = muted;
      if (!muted && this.bgm.paused) {
        try {
          await this.bgm.play();
        } catch {
          // Autoplay may still be blocked until another gesture.
        }
      }
      return;
    }

    this.bgm?.pause();
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = BGM_VOLUME;
    audio.muted = muted;
    audio.dataset.track = track;
    this.bgm = audio;

    if (muted) return;
    try {
      await audio.play();
    } catch {
      // Wait for the next explicit unlock / unmute.
    }
  }

  async playJingle(id: JingleId): Promise<void> {
    if (!useAudio.getState().unlocked) return;
    const muted = useAudio.getState().muted;
    const url = AUDIO.jingles[id];

    this.jingle?.pause();
    const audio = new Audio(url);
    audio.volume = JINGLE_VOLUME;
    audio.muted = muted;
    this.jingle = audio;

    // Duck BGM under the sting.
    if (this.bgm && !this.bgm.paused) {
      this.bgm.volume = BGM_VOLUME * 0.25;
    }

    try {
      if (!muted) await audio.play();
    } catch {
      return;
    }

    await new Promise<void>((resolve) => {
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => resolve(), { once: true });
    });

    if (this.bgm) this.bgm.volume = BGM_VOLUME;
  }

  playSfx(id: SfxId): void {
    if (!useAudio.getState().unlocked || useAudio.getState().muted) return;
    const url = AUDIO.sfx[id];
    const cached = this.sfxCache.get(url);
    const audio = (cached?.cloneNode(true) as HTMLAudioElement | undefined) ?? new Audio(url);
    audio.volume = SFX_VOLUME;
    void audio.play().catch(() => {
      // Ignore gesture / decode races.
    });
  }
}

export const gameAudio = new GameAudioController();
