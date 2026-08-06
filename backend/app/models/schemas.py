"""Request/response models — always carry full computation traces."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CharRequest(BaseModel):
    char: str = Field(..., min_length=1, max_length=1)


class CaesarEncryptRequest(CharRequest):
    shift: int = 1


class CaesarCrackRequest(BaseModel):
    ciphertext: str = Field(..., min_length=1, max_length=1)
    expected_plaintext: Optional[str] = None


class KeyboardRequest(BaseModel):
    modulus: Optional[int] = None
    require_coprime: bool = False


class RsaKeygenRequest(BaseModel):
    N: int = 15


class RsaEncryptRequest(BaseModel):
    m: int
    e: int
    N: int


class RsaDecryptRequest(BaseModel):
    c: int
    d: int
    N: int


class RsaCrackRequest(BaseModel):
    N: int = 15
    bits: int = 2048


class ShorPlanRequest(BaseModel):
    N: int = 15
    a: int = 7
    num_control: Optional[int] = None


class ShorSimulateRequest(BaseModel):
    N: int = 15
    a: int = 7
    num_control: Optional[int] = None
    strategy: str = "permutation"
    shots: int = 1024
    include_statevector: bool = False


class TraceResponse(BaseModel):
    data: Dict[str, Any]
