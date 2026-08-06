"""Tests for classical core math."""

import math

from app.core.alphabet import char_to_message, keyboard_state, message_to_char
from app.core.caesar import caesar_crack, caesar_decrypt, caesar_encrypt
from app.core.rsa import rsa_crack_toy, rsa_decrypt, rsa_encrypt, rsa_keygen


def test_alphabet_roundtrip():
    assert char_to_message("H") == 8
    assert message_to_char(8) == "H"


def test_keyboard_disables_beyond_modulus_and_non_coprime():
    keys = keyboard_state(modulus=15, require_coprime=True)
    by_char = {k["char"]: k for k in keys}
    assert by_char["A"]["enabled"] is True  # 1
    assert by_char["B"]["enabled"] is True  # 2
    assert by_char["C"]["enabled"] is False  # 3 shares factor
    assert by_char["O"]["enabled"] is False  # 15 >= N


def test_caesar_encrypt_decrypt():
    enc = caesar_encrypt("A", 1)
    assert enc["ciphertext"] == "B"
    dec = caesar_decrypt("B", 1)
    assert dec["plaintext"] == "A"


def test_caesar_crack():
    enc = caesar_encrypt("H", 3)
    cracked = caesar_crack(enc["ciphertext"], expected_plaintext="H")
    assert cracked["found_shift"] == 3
    assert cracked["elapsed_ms"] >= 0


def test_rsa_15_roundtrip():
    keys = rsa_keygen(15)
    m = 2  # coprime
    enc = rsa_encrypt(m, keys["e"], keys["N"])
    dec = rsa_decrypt(enc["c"], keys["d"], keys["N"])
    assert dec["m"] == m


def test_rsa_21_roundtrip():
    keys = rsa_keygen(21)
    m = 2
    enc = rsa_encrypt(m, keys["e"], keys["N"])
    dec = rsa_decrypt(enc["c"], keys["d"], keys["N"])
    assert dec["m"] == m


def test_rsa_crack_toy():
    cracked = rsa_crack_toy(15)
    assert set(cracked["factors"]) == {3, 5}
