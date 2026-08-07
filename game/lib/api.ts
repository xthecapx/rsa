/**
 * Thin client over the FastAPI backend. Mirrors frontend/lib/api.ts; the game
 * runs on its own port and reaches the backend through the /api/* rewrite.
 */

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `POST ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `GET ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// --- Shared types ---

export interface TraceStep {
  step?: string;
  op?: string;
  detail: string;
}

export interface PlaintextResponse {
  char: string;
  value: number;
  encrypted: boolean;
  packet: { payload: string; readable_by_hacker: boolean };
  trace: TraceStep[];
}

export interface KeyboardResponse {
  keys: {
    char: string;
    value: number;
    enabled: boolean;
    disabled_reason?: string | null;
  }[];
}

export interface CaesarEncryptResponse {
  plaintext: string;
  plaintext_value: number;
  shift: number;
  ciphertext: string;
  ciphertext_value: number;
  equation: string;
  trace: TraceStep[];
}

export interface CaesarCrackResponse {
  ciphertext: string;
  trials: { shift: number; candidate: string; match: boolean }[];
  found_shift: number | null;
  elapsed_ms: number;
  num_trials: number;
  cracked: boolean;
}

export interface RsaKeygenResponse {
  N: number;
  p: number;
  q: number;
  phi: number;
  e: number;
  d: number;
  public_key: { e: number; N: number };
  private_key: { d: number; N: number };
  trace: TraceStep[];
}

export interface RsaEncryptResponse {
  m: number;
  e: number;
  N: number;
  c: number;
  equation: string;
  trace: TraceStep[];
}

export interface RsaDecryptResponse {
  c: number;
  d: number;
  N: number;
  m: number;
  equation: string;
  trace: TraceStep[];
}

export interface RsaCrackResponse {
  toy: {
    N: number;
    factors: number[];
    p: number | null;
    q: number | null;
    phi: number | null;
    method: string;
    elapsed_note: string;
    trace: TraceStep[];
  };
  rsa2048_projection: {
    bits: number;
    algorithm: string;
    complexity: string;
    projected_years: number;
    projected_years_scientific: string;
    shor_comparison: string;
  };
}

export interface ShorStepPlanEntry {
  slot: number;
  b: number;
  status: string;
  reason?: string;
}

export interface ShorPlanResponse {
  N: number;
  a: number;
  num_control: number;
  precheck: Record<string, unknown>;
  step_plan: ShorStepPlanEntry[];
  identity_skipped: number;
  quantum_required_slots: number;
  factor?: number;
  factors?: number[];
  classical_order?: number;
  factors_from_classical_order?: {
    factors?: number[] | null;
    nontrivial?: boolean;
    r?: number;
  };
  classical_order_error?: string;
  shor_plan?: Record<string, unknown>;
}

export interface ShorSuccessfulOutcome {
  bitstring: string;
  count: number;
  probability?: number;
  phase?: number;
  fraction?: string;
  order_guess?: number;
  order_matches_true?: boolean;
  factoring?: {
    a?: number;
    N?: number;
    r?: number;
    factors?: number[] | null;
    nontrivial?: boolean;
    even_order?: boolean;
    /** "success", "odd_order", and so on. */
    reason?: string;
  };
}

/**
 * The per-measurement interpretation. Both /api/shor/simulate and every IBM
 * job carry this under `analysis`, in the same shape, which is why the results
 * table can render either without caring where the counts came from.
 */
export interface ShorAnalysis {
  shots?: number;
  num_control?: number;
  true_order?: number | null;
  outcomes?: ShorSuccessfulOutcome[];
  best?: ShorSuccessfulOutcome | null;
}

export interface ShorSimulateResponse {
  precheck: Record<string, unknown>;
  plan?: Record<string, unknown>;
  backend?: string;
  engine?: string;
  method?: string;
  strategy?: string;
  num_control?: number;
  num_target?: number;
  num_qubits?: number;
  true_order?: number;
  shots?: number;
  counts?: Record<string, number>;
  analysis?: ShorAnalysis;
  successful_outcomes?: ShorSuccessfulOutcome[];
  success_shots?: number;
  success_rate?: number;
  order_hit_shots?: number;
  order_hit_rate?: number;
  jobs_run?: number;
  shor_result?: {
    order_guess?: number | null;
    factors?: number[] | null;
    bitstring?: string;
    phase?: number;
    fraction?: string;
    found?: boolean;
    order_matches_true?: boolean;
    true_order?: number | null;
  };
  expected_distribution?: Record<string, number>;
  circuit_text?: string;
  circuit_depth?: number;
  strategy_note?: string;
  circuit_built?: boolean;
  factor?: number;
  factors?: number[];
}

export interface IbmBatchSummary {
  batch_id: string;
  label?: string;
  console_url?: string;
}

export interface IbmJob {
  job_id: string;
  status: string;
  counts: Record<string, number>;
  analysis?: ShorAnalysis;
  error?: string | null;
  console_url?: string;
  num_control?: number;
}

export interface IbmBatchDetail {
  batch_id: string;
  label?: string;
  console_url?: string;
  backend_name?: string;
  usage_time?: number;
  num_control?: number;
  N?: number;
  a?: number;
  jobs: IbmJob[];
  references?: {
    ideal?: Record<string, number>;
    aer_noiseless?: Record<string, number>;
    true_order?: number;
  };
  /** True when this is the on-disk demo batch, used without IBM credentials. */
  cached?: boolean;
  /** True when the backend answered from its own cache rather than calling IBM. */
  from_cache?: boolean;
  /** True when IBM was unreachable and the backend served an older copy. */
  stale?: boolean;
  age_seconds?: number;
  note?: string;
}

// --- API helpers ---

export const api = {
  health: () => get<{ status: string }>("/api/health"),

  plaintext: (char: string) =>
    post<PlaintextResponse>("/api/plaintext", { char }),

  /** The whole A=1 .. Z=26 table, as the backend defines it. */
  keyboard: () => post<KeyboardResponse>("/api/keyboard", {}),

  caesar: {
    encrypt: (char: string, shift = 1) =>
      post<CaesarEncryptResponse>("/api/caesar/encrypt", { char, shift }),
    decrypt: (char: string, shift = 1) =>
      post<CaesarEncryptResponse>("/api/caesar/decrypt", { char, shift }),
    crack: (ciphertext: string, expected_plaintext?: string) =>
      post<CaesarCrackResponse>("/api/caesar/crack", {
        ciphertext,
        expected_plaintext,
      }),
  },

  rsa: {
    keygen: (N: number) => post<RsaKeygenResponse>("/api/rsa/keygen", { N }),
    encrypt: (m: number, e: number, N: number) =>
      post<RsaEncryptResponse>("/api/rsa/encrypt", { m, e, N }),
    decrypt: (c: number, d: number, N: number) =>
      post<RsaDecryptResponse>("/api/rsa/decrypt", { c, d, N }),
    crack: (N: number, bits = 2048) =>
      post<RsaCrackResponse>("/api/rsa/crack", { N, bits }),
  },

  shor: {
    plan: (N: number, a: number, num_control?: number) =>
      post<ShorPlanResponse>("/api/shor/plan", { N, a, num_control }),
    simulate: (opts: {
      N: number;
      a: number;
      num_control?: number;
      strategy?: string;
      shots?: number;
    }) => post<ShorSimulateResponse>("/api/shor/simulate", opts),
  },

  ibm: {
    batches: () => get<{ batches: IbmBatchSummary[] }>("/api/ibm/batches"),
    batch: (id: string) => get<IbmBatchDetail>(`/api/ibm/batch/${id}`),
    cached: () => get<IbmBatchDetail>("/api/ibm/cached"),
  },
};
