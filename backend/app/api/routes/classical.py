"""Plaintext and Caesar endpoints."""

from fastapi import APIRouter

from app.core import (
    caesar_crack,
    caesar_decrypt,
    caesar_encrypt,
    char_to_message,
    keyboard_state,
)
from app.models.schemas import (
    CaesarCrackRequest,
    CaesarEncryptRequest,
    CharRequest,
    KeyboardRequest,
)

router = APIRouter()


@router.post("/plaintext")
def plaintext(req: CharRequest):
    c = req.char.strip().upper()
    return {
        "char": c,
        "value": char_to_message(c),
        "encrypted": False,
        "packet": {"payload": c, "readable_by_hacker": True},
        "trace": [{"step": "send", "detail": f"Ale sends '{c}' in the clear"}],
    }


@router.post("/keyboard")
def keyboard(req: KeyboardRequest):
    return {
        "keys": keyboard_state(
            modulus=req.modulus, require_coprime=req.require_coprime
        )
    }


@router.post("/caesar/encrypt")
def encrypt(req: CaesarEncryptRequest):
    return caesar_encrypt(req.char, req.shift)


@router.post("/caesar/decrypt")
def decrypt(req: CaesarEncryptRequest):
    return caesar_decrypt(req.char, req.shift)


@router.post("/caesar/crack")
def crack(req: CaesarCrackRequest):
    return caesar_crack(req.ciphertext, req.expected_plaintext)
