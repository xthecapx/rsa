"""Stateless signed tokens for lesson devices (Grover PIN lock, BV vault).

A token is `base64(json).base64(hmac)`: the secret travels with the page but the
page can neither read it back comfortably nor change it, and any Cloud Run
instance can check it without shared state.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json

from fastapi import HTTPException

from app.config import get_settings


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(body: str) -> str:
    key = get_settings().game_token_key.encode()
    return _b64(hmac.new(key, body.encode(), hashlib.sha256).digest())


def sign_payload(payload: dict) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def read_payload(token: str) -> dict:
    """Return the signed payload or raise 400 for anything not ours."""
    try:
        body, signature = token.split(".", 1)
        if not hmac.compare_digest(signature, _sign(body)):
            raise ValueError("signature")
        data = json.loads(_unb64(body))
        if not isinstance(data, dict):
            raise ValueError("payload")
        return data
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Unknown device") from None
