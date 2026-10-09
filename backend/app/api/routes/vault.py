"""The Ghost Key lesson: a 25-bit parity vault and a real Bernstein-Vazirani run.

The vault's mask `s` never reaches the page: `/device` hands out a signed
token. `/key` is the door (open or not), `/ask` is the "ghost" that knocks
`f(x) = s . x mod 2`, and `/run` executes the player's circuit on 25 data
qubits plus one helper.

A 26-qubit statevector would need 2^26 complex amplitudes (1 GiB), so the run
uses Aer's stabilizer method instead: every gate in Bernstein-Vazirani is a
Clifford (H, X, CNOT), which the stabilizer formalism simulates exactly in
polynomial time. The per-wire phases shown during the run come from tracking
the kickback on each qubit separately, which is O(n) and is checked against
the measured shot.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from app.api.game_token import read_payload, sign_payload
from app.api.quantum_execution import run_quantum
from app.core.game_services import vault as lesson, ServiceError

from app.quantum.simulators import SimulatorChoice, simulator, display_name

router = APIRouter()

BITS = 25
KIND = "vault"
BITSTRING = rf"^[01]{{{BITS}}}$"

Helper = Literal["minus", "plus", "zero"]
Extra = Literal["diffuser", "repeat"]


def to_bits(value: int) -> str:
    """Tumbler i (left to right) is bit i of the integer."""
    return "".join(str((value >> i) & 1) for i in range(BITS))


def from_bits(text: str) -> int:
    return sum(1 << i for i, bit in enumerate(text) if bit == "1")


def make_token(secret: int) -> str:
    return sign_payload({"k": KIND, "s": secret})


def read_token(token: str) -> int:
    data = read_payload(token)
    try:
        secret = int(data["s"])
        if data.get("k") != KIND or not 0 < secret < 2**BITS:
            raise ValueError("secret")
        return secret
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Unknown vault") from None


def parity(secret: int, x: int) -> int:
    return bin(secret & x).count("1") % 2


class DeviceRequest(BaseModel):
    # After a freeze the vault re-keys; the new mask must differ from the old.
    previous: Optional[str] = Field(None, max_length=512)


class KeyRequest(BaseModel):
    token: str = Field(..., max_length=512)
    key: str = Field(..., pattern=BITSTRING)


class AskRequest(BaseModel):
    token: str = Field(..., max_length=512)
    x: str = Field(..., pattern=BITSTRING)


class Circuit(BaseModel):
    prep: Optional[Literal["h"]] = None
    helper: Optional[Helper] = None
    out: Optional[Literal["h"]] = None
    measure: bool = False
    extra: List[Extra] = Field(default_factory=list, max_length=2)


class RunRequest(BaseModel):
    token: str = Field(..., max_length=512)
    circuit: Circuit


@router.post("/device")
def device(req: DeviceRequest):
    return _lesson("device", req.model_dump())


@router.post("/key")
def key(req: KeyRequest):
    return _lesson("key", req.model_dump())


@router.post("/ask")
def ask(req: AskRequest):
    return _lesson("ask", req.model_dump())


def simulate(secret: int):
    return _lesson("run", {"token": make_token(secret), "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True}})


@router.post("/run")
def run(req: RunRequest, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    return run_quantum(lambda: _lesson("run", req.model_dump(), choice))


def _lesson(action, body, choice: SimulatorChoice = "ideal"):
    def read_device(value, kind):
        return read_token(value), 0
    def write_device(kind, secret, seed):
        return make_token(secret)
    backend = None
    if action == "run":
        backend = simulator(choice, vault=True)
    try:
        result = lesson(backend, action, body, read_device=read_device, write_device=write_device)
        if "backend" in result:
            result["backend"] = display_name(choice)
        return result
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
