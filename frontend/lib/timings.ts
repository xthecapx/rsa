/** Shared timings for the cable animation (ms). */
export const PACKET_TIMINGS = {
  /** Hold Ale's letter visible before it leaves onto the cable. */
  leaveAle: 1600,
  toHacker: 1900,
  holdTap: 1400,
  toBrayan: 1900,
  /** Beat after crack before the packet continues to Brayan. */
  afterCrack: 900,
} as const;
