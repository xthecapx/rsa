"""Plaintext and Caesar endpoints."""

from fastapi import APIRouter

from app.core import (
    caesar_crack,
    caesar_decrypt,
    caesar_encrypt,
)
from app.models.schemas import (
    CaesarCrackRequest,
    CaesarEncryptRequest,
    CharRequest,
    KeyboardRequest,
)

from app.core.game_services import plaintext as shared_plaintext, keyboard as shared_keyboard

router = APIRouter()


@router.post("/plaintext")
def plaintext(req: CharRequest):
    return shared_plaintext(req.char)


@router.post("/keyboard")
def keyboard(req: KeyboardRequest):
    return shared_keyboard(req.modulus, req.require_coprime)


@router.post("/caesar/encrypt")
def encrypt(req: CaesarEncryptRequest):
    return caesar_encrypt(req.char, req.shift)


@router.post("/caesar/decrypt")
def decrypt(req: CaesarEncryptRequest):
    return caesar_decrypt(req.char, req.shift)


@router.post("/caesar/crack")
def crack(req: CaesarCrackRequest):
    return caesar_crack(req.ciphertext, req.expected_plaintext)
