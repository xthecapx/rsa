"""Caesar cipher encrypt / decrypt / brute-force crack with timing."""

from __future__ import annotations

import time
from typing import Any, Dict, List

from .alphabet import ALPHABET, char_to_message, message_to_char


def _shift_char(char: str, k: int) -> str:
    m = char_to_message(char)
    # 0-based shift on 26 letters
    shifted = (m - 1 + k) % 26
    return ALPHABET[shifted]


def caesar_encrypt(char: str, k: int = 1) -> Dict[str, Any]:
    """Encrypt a single character by shifting k positions."""
    c = char.strip().upper()
    plaintext_value = char_to_message(c)
    ciphertext = _shift_char(c, k)
    ciphertext_value = char_to_message(ciphertext)
    equation = (
        f"(({plaintext_value} - 1 + {k}) mod 26) + 1 = {ciphertext_value}"
    )
    return {
        "plaintext": c,
        "plaintext_value": plaintext_value,
        "shift": k,
        "ciphertext": ciphertext,
        "ciphertext_value": ciphertext_value,
        "equation": equation,
        "trace": [
            {"step": "map", "detail": f"{c} → {plaintext_value}"},
            {"step": "shift", "detail": equation},
            {"step": "result", "detail": f"{ciphertext_value} → {ciphertext}"},
        ],
    }


def caesar_decrypt(char: str, k: int = 1) -> Dict[str, Any]:
    """Decrypt by shifting -k."""
    c = char.strip().upper()
    ciphertext_value = char_to_message(c)
    plaintext = _shift_char(c, -k)
    plaintext_value = char_to_message(plaintext)
    equation = (
        f"(({ciphertext_value} - 1 - {k}) mod 26) + 1 = {plaintext_value}"
    )
    return {
        "ciphertext": c,
        "shift": k,
        "plaintext": plaintext,
        "equation": equation,
        "trace": [
            {"step": "unshift", "detail": f"{equation} → {plaintext}"},
        ],
    }


def caesar_crack(ciphertext: str, expected_plaintext: str | None = None) -> Dict[str, Any]:
    """
    Brute-force all 25 non-identity shifts. Returns table + wall-clock timing.
    If expected_plaintext is given, marks the matching shift as the crack.
    """
    c = ciphertext.strip().upper()
    start = time.perf_counter()
    trials: List[Dict[str, Any]] = []
    found_shift: int | None = None
    for k in range(1, 26):
        candidate = _shift_char(c, -k)
        match = expected_plaintext is not None and candidate == expected_plaintext.strip().upper()
        if match:
            found_shift = k
        trials.append(
            {
                "shift": k,
                "candidate": candidate,
                "match": match,
            }
        )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return {
        "ciphertext": c,
        "trials": trials,
        "found_shift": found_shift,
        "elapsed_ms": elapsed_ms,
        "num_trials": 25,
        "cracked": found_shift is not None or expected_plaintext is None,
    }
