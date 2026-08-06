"""Toy RSA for N=15 and N=21 with step traces, plus RSA-2048 time estimate."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

TOY_MODULI: Dict[int, Dict[str, int]] = {
    15: {"p": 3, "q": 5, "phi": 8, "e": 3, "d": 3},
    21: {"p": 3, "q": 7, "phi": 12, "e": 5, "d": 5},
}


def rsa_keygen(N: int = 15) -> Dict[str, Any]:
    """Return fixed teaching keys for a supported toy modulus."""
    if N not in TOY_MODULI:
        raise ValueError(f"Unsupported toy N={N}. Use one of {list(TOY_MODULI)}")
    params = TOY_MODULI[N]
    return {
        "N": N,
        "p": params["p"],
        "q": params["q"],
        "phi": params["phi"],
        "e": params["e"],
        "d": params["d"],
        "public_key": {"e": params["e"], "N": N},
        "private_key": {"d": params["d"], "N": N},
        "trace": [
            {"step": "choose_primes", "detail": f"p={params['p']}, q={params['q']}"},
            {"step": "modulus", "detail": f"N = p·q = {N}"},
            {
                "step": "totient",
                "detail": f"φ(N) = (p-1)(q-1) = {params['phi']}",
            },
            {
                "step": "public_exponent",
                "detail": f"e = {params['e']} with gcd(e, φ(N)) = 1",
            },
            {
                "step": "private_exponent",
                "detail": f"d = {params['d']} so that e·d ≡ 1 (mod φ(N))",
            },
        ],
    }


def _modexp_trace(base: int, exp: int, mod: int) -> List[Dict[str, Any]]:
    """Binary modular exponentiation steps for the math tier."""
    steps: List[Dict[str, Any]] = []
    result = 1
    b = base % mod
    e = exp
    steps.append({"op": "init", "detail": f"result=1, base={b}, exp={e}, mod={mod}"})
    while e > 0:
        if e & 1:
            prev = result
            result = (result * b) % mod
            steps.append(
                {
                    "op": "multiply",
                    "detail": f"exp odd: ({prev} · {b}) mod {mod} = {result}",
                }
            )
        e >>= 1
        if e > 0:
            prev_b = b
            b = (b * b) % mod
            steps.append(
                {
                    "op": "square",
                    "detail": f"square base: ({prev_b}²) mod {mod} = {b}; exp→{e}",
                }
            )
    return steps


def rsa_encrypt(m: int, e: int, N: int) -> Dict[str, Any]:
    """c = m^e mod N with full trace."""
    if not 0 < m < N:
        raise ValueError(f"Message m={m} must satisfy 0 < m < N={N}")
    if math.gcd(m, N) != 1:
        raise ValueError(f"gcd(m={m}, N={N}) > 1; choose a coprime message for the demo")
    c = pow(m, e, N)
    return {
        "m": m,
        "e": e,
        "N": N,
        "c": c,
        "equation": f"c = {m}^{e} mod {N} = {c}",
        "trace": _modexp_trace(m, e, N),
    }


def rsa_decrypt(c: int, d: int, N: int) -> Dict[str, Any]:
    """m = c^d mod N with full trace."""
    m = pow(c, d, N)
    return {
        "c": c,
        "d": d,
        "N": N,
        "m": m,
        "equation": f"m = {c}^{d} mod {N} = {m}",
        "trace": _modexp_trace(c, d, N),
    }


def rsa_crack_toy(N: int) -> Dict[str, Any]:
    """Instant trial-division factorisation for toy N."""
    if N < 2:
        raise ValueError("N must be ≥ 2")
    factors: List[int] = []
    n = N
    f = 2
    while f * f <= n:
        while n % f == 0:
            factors.append(f)
            n //= f
        f += 1 if f == 2 else 2
    if n > 1:
        factors.append(n)
    unique = sorted(set(factors))
    p = unique[0] if unique else None
    q = unique[1] if len(unique) > 1 else (unique[0] if unique else None)
    phi = (p - 1) * (q - 1) if p and q and p != q else None
    return {
        "N": N,
        "factors": factors,
        "p": p,
        "q": q,
        "phi": phi,
        "method": "trial_division",
        "elapsed_note": "instant on classical hardware for toy N",
        "trace": [
            {"step": "trial_division", "detail": f"factors of {N}: {factors}"},
            {"step": "totient", "detail": f"φ(N) = {phi}" if phi else "n/a"},
        ],
    }


def rsa_projected_crack_time(bits: int = 2048) -> Dict[str, Any]:
    """
    Order-of-magnitude GNFS projected time for RSA-{bits}.

    Uses the L-notation heuristic L_n[1/3, (64/9)^{1/3}] ≈ exp(c (ln N)^{1/3} (ln ln N)^{2/3}).
    Returns a human-readable projection for the talk counter, not a precise forecast.
    """
    # N ≈ 2^{bits}
    ln_n = bits * math.log(2)
    ln_ln_n = math.log(ln_n)
    c = (64 / 9) ** (1 / 3)
    log_ops = c * (ln_n ** (1 / 3)) * (ln_ln_n ** (2 / 3))
    # Compare to a reference: RSA-768 took ~10^20 operations / ~2 calendar years (2009).
    # Scale exponentially in the L-cost ratio for a talk-friendly number.
    ref_bits = 768
    ref_ln = ref_bits * math.log(2)
    ref_log_ops = c * (ref_ln ** (1 / 3)) * (math.log(ref_ln) ** (2 / 3))
    ratio = math.exp(log_ops - ref_log_ops)
    ref_years = 2.0
    projected_years = ref_years * ratio
    return {
        "bits": bits,
        "algorithm": "GNFS",
        "complexity": "L_N[1/3, (64/9)^{1/3}] ≈ exp(O(n^{1/3}))",
        "log_operations_nats": log_ops,
        "projected_years": projected_years,
        "projected_years_scientific": f"{projected_years:.3e}",
        "reference": "Scaled from RSA-768 (~2 years, 2009) by L-cost ratio",
        "shor_comparison": "Shor: O(n³) gate complexity on a fault-tolerant quantum computer",
    }
