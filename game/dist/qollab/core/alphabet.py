"""Single-character alphabet mapping A→1 … Z→26 with modulus-aware validity."""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def char_to_message(char: str) -> int:
    """Map an uppercase letter to 1..26."""
    c = char.strip().upper()
    if len(c) != 1 or c not in ALPHABET:
        raise ValueError(f"Expected a single A-Z letter, got {char!r}")
    return ALPHABET.index(c) + 1


def message_to_char(m: int) -> str:
    """Map 1..26 back to a letter."""
    if not 1 <= m <= 26:
        raise ValueError(f"Message {m} out of A-Z range")
    return ALPHABET[m - 1]


def keyboard_state(
    *,
    modulus: Optional[int] = None,
    require_coprime: bool = False,
) -> List[Dict[str, Any]]:
    """
    Per-key UI state for the single-character keyboard.

    Keys with m >= modulus are disabled (modulus too small).
    When require_coprime (RSA/Shor), keys with gcd(m, N) > 1 are disabled.
    """
    keys: List[Dict[str, Any]] = []
    for i, letter in enumerate(ALPHABET, start=1):
        enabled = True
        reason: Optional[str] = None
        if modulus is not None and i >= modulus:
            enabled = False
            reason = f"Message {i} ≥ modulus N={modulus}; pick a smaller letter."
        elif require_coprime and modulus is not None and math.gcd(i, modulus) > 1:
            enabled = False
            reason = f"gcd({i}, {modulus}) > 1; message must be coprime to N for a clean RSA example."
        keys.append(
            {
                "char": letter,
                "value": i,
                "enabled": enabled,
                "disabled_reason": reason,
            }
        )
    return keys
