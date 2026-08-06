"use client";

import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGameStore,
  type PacketState,
  type RsaShareState,
} from "@/store/game";

/**
 * Actors sit in three equal columns, so their centres are at 1/6, 1/2 and 5/6.
 * The cable and the flying letter use the same percentages to stay aligned.
 */
const POS = { ale: 16.667, hacker: 50, brayan: 83.333 } as const;

/**
 * Cable geometry (rem), shared by the tube, the tap junction and the letter so
 * they all sit on the same axis.
 */
const CABLE_TOP = 1.25;
const CABLE_HEIGHT = 2.1;
const CABLE_MID = CABLE_TOP + CABLE_HEIGHT / 2;
const BAND_HEIGHT = CABLE_TOP + CABLE_HEIGHT + 1.25;

function packetX(state: PacketState): number {
  if (state === "sending") return POS.ale;
  if (state === "intercepted" || state === "cracked") return POS.hacker;
  if (state === "delivered") return POS.brayan;
  return POS.ale;
}

/** Public key travels Brayan → Hacker → Ale (opposite of the message). */
function pubKeyX(state: RsaShareState): number {
  if (state === "sending") return POS.brayan;
  if (state === "intercepted") return POS.hacker;
  if (state === "delivered") return POS.ale;
  return POS.brayan;
}

function ActorFace({
  letter,
  name,
  color,
  highlight,
  role,
}: {
  letter: string;
  name: string;
  color: string;
  highlight?: boolean;
  role: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={clsx(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 font-display text-base font-bold transition sm:h-11 sm:w-11",
          color,
          highlight
            ? "border-accent-amber bg-accent-amber/20 shadow-glow"
            : "border-current bg-stage-surface/90",
        )}
      >
        {letter}
      </div>
      <span className="mt-1 font-display text-xs font-semibold leading-none">
        {name}
      </span>
      <span className="mt-0.5 text-[10px] leading-none text-stage-muted">
        {role}
      </span>
    </div>
  );
}

/** Letter chip: used both for the flying packet and the copies actors keep. */
function LetterChip({
  letter,
  tone,
  label,
}: {
  letter: string;
  tone: "ale" | "hacker" | "brayan" | "amber";
  label?: string;
}) {
  const tones = {
    ale: "border-actor-ale bg-actor-ale/15 text-actor-ale",
    hacker: "border-actor-hacker bg-actor-hacker/20 text-actor-hacker",
    brayan: "border-actor-brayan bg-actor-brayan/15 text-actor-brayan",
    amber: "border-accent-amber bg-accent-amber/15 text-accent-amber",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex flex-col items-center"
    >
      <div
        className={clsx(
          "flex h-8 min-w-8 items-center justify-center rounded-md border-2 px-1.5 font-mono text-sm font-bold shadow-glow",
          tones[tone],
        )}
      >
        {letter}
      </div>
      {label && (
        <span className="mt-1 text-[9px] font-semibold uppercase leading-none tracking-wider text-stage-muted">
          {label}
        </span>
      )}
    </motion.div>
  );
}

/** Public / private key chip for the RSA story. */
function KeyChip({
  kind,
  e,
  d,
  N,
  owner,
}: {
  kind: "public" | "private";
  e?: number;
  d?: number;
  N: number;
  /** Whose key this is (RSA: both PK copies are Brayan's public key). */
  owner?: string;
}) {
  const isPub = kind === "public";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className={clsx(
        "flex items-center gap-1.5 rounded-md border px-1.5 py-1",
        isPub
          ? "border-accent-teal/70 bg-accent-teal/10 text-accent-teal"
          : "border-accent-amber/70 bg-accent-amber/10 text-accent-amber",
      )}
    >
      <span
        className={clsx(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-[9px] font-bold",
          isPub
            ? "border-accent-teal/60 bg-accent-teal/20"
            : "border-accent-amber/60 bg-accent-amber/20",
        )}
        aria-hidden
      >
        {isPub ? "PK" : "SK"}
      </span>
      <span className="font-mono text-[9px] leading-tight sm:text-[10px]">
        <span className="block font-bold uppercase tracking-wider">
          {isPub ? "public" : "private"}
          {owner ? ` · ${owner}` : ""}
        </span>
        <span className="text-stage-muted">
          {isPub ? `e=${e}, N=${N}` : `d=${d}, N=${N}`}
        </span>
      </span>
    </motion.div>
  );
}

export default function Stage() {
  const act = useGameStore((s) => s.act);
  const packetState = useGameStore((s) => s.packetState);
  const messagePayload = useGameStore((s) => s.messagePayload);
  const selectedChar = useGameStore((s) => s.selectedChar);
  const rsaKeys = useGameStore((s) => s.rsaKeys);
  const rsaPubOnAle = useGameStore((s) => s.rsaPubOnAle);
  const rsaPubOnHacker = useGameStore((s) => s.rsaPubOnHacker);
  const rsaShareState = useGameStore((s) => s.rsaShareState);

  const payloadText =
    messagePayload &&
    (messagePayload.encrypted && messagePayload.ciphertext
      ? messagePayload.ciphertext
      : messagePayload.char);

  const atTap = packetState === "intercepted" || packetState === "cracked";
  const atBrayan = packetState === "delivered";
  const atAle = packetState === "sending";
  const cracked = packetState === "cracked";
  const sharing =
    act === 3 && rsaShareState != null && rsaShareState !== "idle";
  const showRsa = act === 3 && !!rsaKeys;

  /** Ale holds the letter only while it is still hers. */
  const aleLetter = atAle && messagePayload ? messagePayload.char : null;
  /** Hacker keeps a copy from the tap onward (plaintext once cracked). */
  const hackerLetter =
    (atTap || atBrayan) && messagePayload
      ? messagePayload.readableByHacker
        ? messagePayload.char
        : (messagePayload.ciphertext ?? "?")
      : null;
  /** Brayan holds plaintext once the packet arrives. */
  const brayanLetter =
    atBrayan && messagePayload ? messagePayload.char : null;

  /** Message packet on the cable (hidden while publishing the public key). */
  const showPacket =
    !!messagePayload && packetState !== "idle" && !sharing;
  /** Public-key packet travels Brayan → Ale. */
  const showPubPacket = sharing && !!rsaKeys;

  const tapLive =
    atTap ||
    !!hackerLetter ||
    rsaShareState === "intercepted" ||
    rsaPubOnHacker;

  const chipSlot =
    showRsa && rsaPubOnHacker && hackerLetter
      ? "h-[7.25rem]"
      : showRsa && (!rsaPubOnAle || rsaPubOnHacker)
        ? "h-[6.5rem]"
        : showRsa
          ? "h-[5.5rem]"
          : "h-[3.1rem]";

  const banner = (() => {
    if (act !== 3) {
      return messagePayload?.encrypted
        ? "Ciphertext on the cable · Hacker taps the middle"
        : "One cable · Hacker taps the middle";
    }
    if (sharing) {
      return "Publishing public key · Hacker can copy PK · private key stays with Brayan";
    }
    if (rsaPubOnAle && messagePayload) {
      return "Hacker has PK + ciphertext · only Brayan has the private key";
    }
    if (rsaPubOnAle) {
      return "Keys shared · Ale has PK · Brayan keeps SK · ready to encrypt";
    }
    return "Brayan generates keys · then publishes the public key on the cable";
  })();

  return (
    <section className="panel relative flex shrink-0 flex-col overflow-hidden px-3 py-2 sm:px-4 sm:py-3">
      <p className="mb-2 text-center text-[10px] uppercase tracking-[0.18em] text-stage-muted">
        {banner}
      </p>

      <div className="mx-auto w-full max-w-3xl">
        {/* Actors + keys/letters each one holds. Normal flow: nothing overlaps. */}
        <div className="grid grid-cols-3 items-start">
          <div className="flex flex-col items-center">
            <ActorFace
              letter="A"
              name="Ale"
              color="text-actor-ale"
              highlight={atAle || rsaShareState === "delivered"}
              role="Sender"
            />
            <div
              className={clsx(
                "mt-1.5 flex flex-col items-center justify-start gap-1",
                chipSlot,
              )}
            >
              <AnimatePresence mode="wait">
                {showRsa && rsaKeys && rsaPubOnAle && (
                  <KeyChip
                    key="ale-pk"
                    kind="public"
                    e={rsaKeys.e}
                    N={rsaKeys.N}
                    owner="Brayan's"
                  />
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {aleLetter && (
                  <LetterChip
                    key={`ale-${aleLetter}`}
                    letter={aleLetter}
                    tone="ale"
                    label={act === 3 ? "encrypts" : "sends"}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <ActorFace
              letter="H"
              name="Hacker"
              color="text-actor-hacker"
              highlight={tapLive}
              role="Tap"
            />
            <div
              className={clsx(
                "mt-1.5 flex flex-col items-center justify-start gap-1",
                chipSlot,
              )}
            >
              <AnimatePresence mode="wait">
                {showRsa && rsaKeys && rsaPubOnHacker ? (
                  <KeyChip
                    key="hack-pk"
                    kind="public"
                    e={rsaKeys.e}
                    N={rsaKeys.N}
                    owner="Brayan's"
                  />
                ) : showRsa ? (
                  <motion.span
                    key="hack-nokey"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded border border-stage-border/50 px-1.5 py-1 font-mono text-[9px] text-stage-muted"
                  >
                    no key yet
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {hackerLetter && (
                  <LetterChip
                    key={`hack-${hackerLetter}`}
                    letter={hackerLetter}
                    tone="hacker"
                    label={
                      messagePayload?.readableByHacker ? "reads" : "sees c"
                    }
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <ActorFace
              letter="B"
              name="Brayan"
              color="text-actor-brayan"
              highlight={
                atBrayan ||
                rsaShareState === "sending" ||
                (!!rsaKeys && !rsaPubOnAle && !sharing)
              }
              role="Receiver"
            />
            <div
              className={clsx(
                "mt-1.5 flex flex-col items-center justify-start gap-1",
                chipSlot,
              )}
            >
              {showRsa && rsaKeys && (
                <>
                  <KeyChip
                    kind="private"
                    d={rsaKeys.d}
                    N={rsaKeys.N}
                    owner="Brayan only"
                  />
                  {!rsaPubOnAle && (
                    <KeyChip
                      kind="public"
                      e={rsaKeys.e}
                      N={rsaKeys.N}
                      owner="Brayan's"
                    />
                  )}
                </>
              )}
              <AnimatePresence mode="wait">
                {brayanLetter && (
                  <LetterChip
                    key={`brayan-${brayanLetter}`}
                    letter={brayanLetter}
                    tone="brayan"
                    label={act === 3 ? "decrypts" : "gets"}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Cable band: tap stem, tube, junction and the traveling letter. */}
        <div className="relative" style={{ height: `${BAND_HEIGHT}rem` }}>
          <div
            className={clsx(
              "absolute left-1/2 top-0 w-0.5 -translate-x-1/2 rounded-full",
              tapLive
                ? "bg-actor-hacker shadow-[0_0_8px_rgba(251,113,133,0.8)]"
                : "bg-actor-hacker/60",
            )}
            style={{ height: `${CABLE_TOP}rem` }}
          />

          {/* The tube the letter travels inside */}
          <div
            className="absolute overflow-hidden rounded-full border border-stage-border/60 bg-gradient-to-r from-actor-ale/25 via-stage-border/25 to-actor-brayan/25"
            style={{
              top: `${CABLE_TOP}rem`,
              height: `${CABLE_HEIGHT}rem`,
              left: `${POS.ale}%`,
              right: `${100 - POS.brayan}%`,
            }}
            aria-hidden
          >
            {/* Bright core line down the middle of the tube */}
            <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-actor-ale via-stage-border to-actor-brayan" />
          </div>

          <div
            className={clsx(
              "absolute left-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              tapLive
                ? "border-actor-hacker bg-actor-hacker shadow-[0_0_10px_rgba(251,113,133,0.9)]"
                : "border-actor-hacker/80 bg-stage-bg",
            )}
            style={{ top: `${CABLE_MID}rem` }}
          />

          <div
            className="absolute inset-x-0 text-center text-[9px] uppercase tracking-[0.2em] text-stage-muted"
            style={{ top: `${CABLE_TOP + CABLE_HEIGHT + 0.25}rem` }}
          >
            public cable
          </div>

          {/*
            Centering lives in framer's x/y, not Tailwind translate classes:
            animating `scale` makes framer write an inline transform that would
            otherwise clobber them.
          */}
          <AnimatePresence>
            {showPubPacket && rsaKeys && rsaShareState && (
              <motion.div
                key={`pk-${rsaKeys.N}-${rsaKeys.e}`}
                className="absolute z-20"
                style={{ top: `${CABLE_MID}rem` }}
                initial={{
                  left: `${POS.brayan}%`,
                  x: "-50%",
                  y: "-50%",
                  opacity: 0,
                  scale: 0.85,
                }}
                animate={{
                  left: `${pubKeyX(rsaShareState)}%`,
                  x: "-50%",
                  y: "-50%",
                  opacity: rsaShareState === "intercepted" ? 0.55 : 1,
                  scale: 1,
                }}
                exit={{ x: "-50%", y: "-50%", opacity: 0, scale: 0.8 }}
                transition={{ duration: 1.85, ease: [0.4, 0, 0.2, 1] }}
              >
                <div
                  className="flex items-center gap-1 rounded-md border-2 border-accent-teal bg-stage-bg px-2 font-mono text-xs font-bold text-accent-teal shadow-glow"
                  style={{ height: `${CABLE_HEIGHT - 0.4}rem` }}
                >
                  <span className="rounded border border-accent-teal/50 px-1 text-[9px]">
                    PK
                  </span>
                  e={rsaKeys.e},N={rsaKeys.N}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPacket && payloadText && (
              <motion.div
                key={`${messagePayload!.char}-fly`}
                className="absolute z-20"
                style={{ top: `${CABLE_MID}rem` }}
                initial={{
                  left: `${POS.ale}%`,
                  x: "-50%",
                  y: "-50%",
                  opacity: 0,
                  scale: 0.85,
                }}
                animate={{
                  left: `${packetX(packetState)}%`,
                  x: "-50%",
                  y: "-50%",
                  opacity: atTap || atBrayan ? 0.45 : 1,
                  scale: 1,
                }}
                exit={{ x: "-50%", y: "-50%", opacity: 0, scale: 0.8 }}
                transition={{ duration: 1.85, ease: [0.4, 0, 0.2, 1] }}
              >
                <div
                  className={clsx(
                    "flex items-center justify-center rounded-md border-2 bg-stage-bg font-mono text-sm font-bold shadow-glow",
                    atTap
                      ? "border-actor-hacker text-actor-hacker"
                      : "border-accent-amber text-accent-amber",
                  )}
                  style={{
                    height: `${CABLE_HEIGHT - 0.4}rem`,
                    minWidth: `${CABLE_HEIGHT - 0.4}rem`,
                    paddingInline: "0.4rem",
                  }}
                >
                  {payloadText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex min-h-[1.75rem] items-center justify-center">
        <AnimatePresence mode="wait">
          {sharing && rsaShareState === "sending" && (
            <motion.p
              key="share-send"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-actor-brayan sm:text-sm"
            >
              Brayan publishes the <strong className="text-accent-teal">public key</strong>{" "}
              on the cable · private key stays home
            </motion.p>
          )}
          {sharing && rsaShareState === "intercepted" && (
            <motion.p
              key="share-tap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-actor-hacker sm:text-sm"
            >
              Hacker copies the <strong className="text-accent-teal">public key</strong>{" "}
              — still missing the private key
            </motion.p>
          )}
          {sharing && rsaShareState === "delivered" && (
            <motion.p
              key="share-ale"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-actor-ale sm:text-sm"
            >
              Ale received the <strong className="text-accent-teal">public key</strong>{" "}
              — ready to encrypt
            </motion.p>
          )}
          {cracked && hackerLetter && (
            <motion.p
              key="crack-msg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-actor-hacker sm:text-sm"
            >
              Hacker cracked it — reads{" "}
              <strong className="font-mono text-accent-amber">{hackerLetter}</strong>
              {" · "}packet still going to Brayan…
            </motion.p>
          )}
          {atTap && !cracked && !sharing && hackerLetter && (
            <motion.p
              key="tap-msg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-actor-hacker sm:text-sm"
            >
              {messagePayload?.readableByHacker ? (
                <>
                  Hacker copies{" "}
                  <strong className="font-mono text-accent-amber">
                    {hackerLetter}
                  </strong>{" "}
                  from the tap
                </>
              ) : act === 3 ? (
                <>
                  Hacker has PK + c=
                  <strong className="font-mono text-accent-amber">
                    {hackerLetter}
                  </strong>{" "}
                  — still no private key
                </>
              ) : (
                <>
                  Hacker sees ciphertext{" "}
                  <strong className="font-mono text-accent-amber">
                    {hackerLetter}
                  </strong>{" "}
                  — running crack…
                </>
              )}
            </motion.p>
          )}
          {atBrayan && !sharing && brayanLetter && hackerLetter && (
            <motion.p
              key="done-msg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs sm:text-sm"
            >
              <span className="text-actor-brayan">
                Brayan decrypts →{" "}
                <strong className="font-mono">{brayanLetter}</strong>
              </span>
              <span className="text-stage-muted"> · </span>
              <span className="text-actor-hacker">
                Hacker{" "}
                {messagePayload?.readableByHacker ? (
                  <>
                    also has{" "}
                    <strong className="font-mono">{hackerLetter}</strong>
                  </>
                ) : (
                  <>
                    only has PK + c=
                    <strong className="font-mono">{hackerLetter}</strong>
                  </>
                )}
              </span>
            </motion.p>
          )}
          {!messagePayload && !sharing && selectedChar && (
            <p className="text-xs text-stage-muted">
              Ready to send{" "}
              <strong className="font-mono text-accent-amber">{selectedChar}</strong>
            </p>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
