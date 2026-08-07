"""Request/response models — always carry full computation traces."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

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


# The simulated circuit grows as 2^(num_control + 2*log2(N)), so these bounds
# are what stops a stray request from building something that exhausts memory
# and takes the process with it. They are far above anything the game asks for.
MAX_NUM_CONTROL = 12
MAX_SHOTS = 8192
MAX_MODULUS = 255


class ShorPlanRequest(BaseModel):
    N: int = Field(15, ge=3, le=MAX_MODULUS)
    a: int = Field(7, ge=2, le=MAX_MODULUS)
    num_control: Optional[int] = Field(None, ge=1, le=MAX_NUM_CONTROL)


class ShorSimulateRequest(BaseModel):
    N: int = Field(15, ge=3, le=MAX_MODULUS)
    a: int = Field(7, ge=2, le=MAX_MODULUS)
    num_control: Optional[int] = Field(None, ge=1, le=MAX_NUM_CONTROL)
    strategy: Literal["permutation", "swap_network"] = "permutation"
    shots: int = Field(1024, ge=1, le=MAX_SHOTS)
    include_statevector: bool = False


class TraceResponse(BaseModel):
    data: Dict[str, Any]
