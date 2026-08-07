import { api } from "@/lib/api";
import type { Effect } from "@/content/types";
import { bus } from "@/engine/bus";
import { useGame } from "./state";
import type { TerminalLine } from "./state";

const LABELS: Record<string, string> = {
  plaintext: "Reading the wire",
  caesarEncrypt: "Ale is encrypting",
  caesarCrack: "Brute-forcing 25 shifts",
  rsaKeygen: "Brayan is generating keys",
  rsaEncrypt: "Ale is encrypting",
  rsaDecrypt: "Decrypting",
  rsaCrack: "Factoring the modulus",
  shorPlan: "Planning the circuit",
  shorSimulate: "Running Shor",
  deriveKey: "Rebuilding the private key",
};

function say(line: TerminalLine): void {
  useGame.getState().pushTerminal(line);
}

export function gcd(a: number, b: number): number {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y) [x, y] = [y, x % y];
  return x;
}

export function modPow(base: number, exponent: number, modulus: number): number {
  let result = 1;
  let b = base % modulus;
  let e = exponent;
  while (e > 0) {
    if (e % 2 === 1) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e = Math.floor(e / 2);
  }
  return result;
}

/**
 * Choose the letter Ale sends under a toy RSA key. Moduli this small have
 * fixed points where m^e mod N == m -- with N=15 and e=3 a quarter of the
 * message space encrypts to itself -- and a ciphertext identical to its
 * plaintext would undercut the whole act. So pick a value that visibly moves.
 */
export function pickRsaPlaintext(N: number, e: number): number {
  const candidates = Array.from({ length: N - 2 }, (_, i) => i + 2).filter(
    (m) => gcd(m, N) === 1 && m <= 26 && modPow(m, e, N) !== m,
  );
  if (!candidates.length) return 2;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Modular inverse via the extended Euclidean algorithm. */
export function modInverse(a: number, m: number): number | null {
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1) return null;
  return ((old_s % m) + m) % m;
}

async function runApi(call: string): Promise<void> {
  const { vars, setVars } = useGame.getState();

  switch (call) {
    case "plaintext": {
      const res = await api.plaintext(vars.letter);
      setVars({ value: res.value });
      for (const step of res.trace) say({ tone: "info", text: step.detail });
      say({
        tone: "bad",
        text: `Readable payload on the wire: "${res.packet.payload}". Demo encoding: m = ${res.value}.`,
      });
      return;
    }

    case "caesarEncrypt": {
      const res = await api.caesar.encrypt(vars.letter, vars.shift);
      setVars({ cipherChar: res.ciphertext, value: res.plaintext_value });
      say({ tone: "info", text: res.equation });
      say({
        tone: "note",
        text: `Ciphertext on the wire: "${res.ciphertext}". The original letter is hidden by the unknown shift k.`,
      });
      return;
    }

    case "caesarCrack": {
      if (!vars.cipherChar) throw new Error("Nothing on the wire to crack yet.");
      const res = await api.caesar.crack(vars.cipherChar, vars.letter);
      setVars({
        crackMs: res.elapsed_ms.toFixed(2),
        shift: res.found_shift ?? vars.shift,
      });
      for (const trial of res.trials) {
        say({
          tone: trial.match ? "good" : "info",
          text: `k=${String(trial.shift).padStart(2, " ")}  ->  ${trial.candidate}${trial.match ? "   <-- plaintext" : ""}`,
        });
      }
      say({
        tone: res.cracked ? "good" : "bad",
        text: res.cracked
          ? `Recovered k=${res.found_shift} after ${res.num_trials} trials in ${res.elapsed_ms.toFixed(2)} ms.`
          : "No shift produced the expected plaintext.",
      });
      return;
    }

    case "rsaKeygen": {
      const res = await api.rsa.keygen(vars.modulus);
      // The message has to be picked against the key, not before it.
      const value = pickRsaPlaintext(res.N, res.e);
      setVars({
        e: res.e,
        d: res.d,
        p: res.p,
        q: res.q,
        value,
        letter: String.fromCharCode(64 + value),
      });
      for (const step of res.trace) say({ tone: "info", text: step.detail });
      say({
        tone: "note",
        text: `Public key (e=${res.e}, N=${res.N}) is visible. The private exponent d stays with Brayan.`,
      });
      return;
    }

    case "rsaEncrypt": {
      if (vars.value === null || vars.e === null) {
        throw new Error("No plaintext or public key yet.");
      }
      const res = await api.rsa.encrypt(vars.value, vars.e, vars.modulus);
      setVars({ cipherNumber: res.c });
      say({ tone: "info", text: res.equation });
      say({ tone: "bad", text: `Ciphertext on the wire: c = ${res.c}` });
      return;
    }

    case "rsaDecrypt": {
      if (vars.cipherNumber === null || vars.d === null) {
        throw new Error("No ciphertext or private key yet.");
      }
      const res = await api.rsa.decrypt(vars.cipherNumber, vars.d, vars.modulus);
      say({ tone: "info", text: res.equation });
      say({ tone: "good", text: `Recovered m = ${res.m}` });
      return;
    }

    case "rsaCrack": {
      const res = await api.rsa.crack(vars.modulus);
      const factors = res.toy.factors.join(" x ");
      setVars({
        factors,
        p: res.toy.p,
        q: res.toy.q,
        projectedYears: res.rsa2048_projection.projected_years_scientific,
      });
      for (const step of res.toy.trace) say({ tone: "info", text: step.detail });
      say({ tone: "good", text: `N = ${factors} by ${res.toy.method}.` });
      say({
        tone: "bad",
        text: `Same attack on RSA-2048 (${res.rsa2048_projection.algorithm}): about ${res.rsa2048_projection.projected_years_scientific} years.`,
      });
      say({ tone: "note", text: res.rsa2048_projection.shor_comparison });
      return;
    }

    case "shorPlan": {
      const res = await api.shor.plan(vars.modulus, vars.base, vars.numControl);
      const skipped = Boolean(res.factor);
      setVars({
        precheckNote: skipped
          ? `gcd(${vars.base}, ${vars.modulus}) is already a factor, no quantum needed`
          : "coprime base, the quantum step is required",
        quantumSlots: res.quantum_required_slots,
      });
      say({
        tone: skipped ? "bad" : "good",
        text: skipped
          ? `Precheck: a=${vars.base} shares a factor with N=${vars.modulus}. Classical gcd solves it, the QPU has nothing to do.`
          : `Precheck: a=${vars.base} is coprime to N=${vars.modulus}. ${res.quantum_required_slots} controlled-multiply slots need real qubits, ${res.identity_skipped} are identities.`,
      });
      return;
    }

    case "shorSimulate": {
      const res = await api.shor.simulate({
        N: vars.modulus,
        a: vars.base,
        num_control: vars.numControl,
        shots: 512,
      });
      applyShorResult(res.shor_result, res.backend ?? "AerSimulator");
      say({
        tone: "info",
        text: `${res.backend} - ${res.num_qubits} qubits, depth ${res.circuit_depth}, ${res.shots} shots.`,
      });
      if (res.success_rate !== undefined) {
        say({
          tone: "note",
          text: `Useful outcomes: ${(res.success_rate * 100).toFixed(1)}% of shots.`,
        });
      }
      return;
    }

    case "deriveKey": {
      const { vars: fresh } = useGame.getState();
      if (fresh.p === null || fresh.q === null || fresh.e === null) {
        throw new Error("Need the factors and the public exponent first.");
      }
      const phi = (fresh.p - 1) * (fresh.q - 1);
      const d = modInverse(fresh.e, phi);
      if (d === null) {
        throw new Error(`e=${fresh.e} has no inverse mod phi=${phi}.`);
      }
      setVars({ d });
      say({
        tone: "good",
        text: `phi(N) = (${fresh.p}-1)(${fresh.q}-1) = ${phi}, so d = e^-1 mod phi = ${d}.`,
      });
      if (fresh.cipherNumber !== null) {
        const res = await api.rsa.decrypt(fresh.cipherNumber, d, fresh.modulus);
        const letter = String.fromCharCode(64 + res.m);
        setVars({ recovered: letter });
        say({ tone: "info", text: res.equation });
        say({ tone: "good", text: `m = ${res.m}, which is the letter "${letter}".` });
      }
      return;
    }

    default:
      throw new Error(`Unknown backend call: ${call}`);
  }
}

/** Shared between the scripted Aer run and the uplink panel. */
export function applyShorResult(
  result:
    | {
        order_guess?: number | null;
        factors?: number[] | null;
        found?: boolean;
      }
    | undefined,
  backendName: string,
): void {
  const { setVars } = useGame.getState();
  setVars({ qpuName: backendName });
  if (!result?.found || !result.factors?.length) {
    say({
      tone: "bad",
      text: `${backendName}: no shot produced a usable period this run. Shor is probabilistic; try again.`,
    });
    return;
  }
  setVars({
    order: result.order_guess ?? null,
    factors: result.factors.join(" x "),
    p: result.factors[0] ?? null,
    q: result.factors[1] ?? null,
  });
  say({
    tone: "good",
    text: `${backendName}: period r = ${result.order_guess}, so N = ${result.factors.join(" x ")}.`,
  });
}

/** Run one effect and wait for it, including the world animation. */
export async function runEffect(effect: Effect): Promise<void> {
  const store = useGame.getState();

  switch (effect.kind) {
    case "api": {
      store.setBusy(effect.label ?? LABELS[effect.call] ?? "Working");
      try {
        await runApi(effect.call);
      } finally {
        useGame.getState().setBusy(null);
      }
      return;
    }
    case "walkTo":
      await bus.send({ type: "walkTo", target: effect.target });
      return;
    case "face":
      await bus.send({ type: "face", target: effect.target });
      return;
    case "packet":
      await bus.send({
        type: "packet",
        style: effect.style,
        from: effect.from,
        to: effect.to,
        intercept: effect.intercept ?? false,
      });
      return;
    case "bubble":
      await bus.send({ type: "bubble", actor: effect.actor, face: effect.face });
      return;
    case "tapGlow":
      await bus.send({ type: "tapGlow", on: effect.on });
      return;
    case "flag":
      store.setFlag(effect.set);
      return;
    case "panel":
      store.setPanel(effect.open);
      return;
    case "terminal":
      say({ tone: "note", text: effect.text });
      return;
    case "wait":
      await new Promise((resolve) => setTimeout(resolve, effect.ms));
      return;
  }
}

export async function runEffects(effects: Effect[] | undefined): Promise<void> {
  for (const effect of effects ?? []) await runEffect(effect);
}
