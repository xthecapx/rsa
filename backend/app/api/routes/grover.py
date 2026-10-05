"""The Grover lesson: a 4-bit PIN lock and a real four-qubit search circuit.

The PIN never reaches the page. `/device` hands out a signed token holding the
PIN and a seed for the order the 16 amplitude bars are shown in, so the bar
position cannot give the answer away either. `/query` is the classical yes/no
lock, and `/run` builds exactly the circuit the player assembled, evolves it
one block at a time and, only for the full three-round search, measures once.
"""

from __future__ import annotations

import random
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.game_token import read_payload, sign_payload
from app.quantum.worker import QuantumTimeout, run_on_worker
from app.core.game_services import grover as lesson, ServiceError

router = APIRouter()

QUBITS = 4
STATES = 2**QUBITS
ROUNDS = 3  # floor(pi/4 * sqrt(16)) rounds of Oracle -> Diffuser

Block = Literal["oracle", "diffuser", "h", "x"]


def make_token(secret: int, seed: int) -> str:
    return sign_payload({"s": secret, "p": seed})


def read_token(token: str) -> tuple[int, int]:
    """Return (secret, shuffle seed) or raise 400 for anything not ours."""
    data = read_payload(token)
    try:
        if "k" in data:
            raise ValueError("another device")
        secret, seed = int(data["s"]), int(data["p"])
        if not 0 <= secret < STATES:
            raise ValueError("secret")
        return secret, seed
    except (ValueError, KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Unknown device") from None


def bar_order(seed: int) -> List[int]:
    """Basis state shown at each bar position, fixed for one device."""
    order = list(range(STATES))
    random.Random(seed).shuffle(order)
    return order


def label(state: int) -> str:
    """Big-endian q3..q0, the same order Qiskit prints measured bits in."""
    return format(state, f"0{QUBITS}b")


class DeviceRequest(BaseModel):
    # The backup cipher after a lucky guess must not reuse the guessed PIN.
    previous: Optional[str] = Field(None, max_length=512)


class QueryRequest(BaseModel):
    token: str = Field(..., max_length=512)
    guess: str = Field(..., pattern=r"^[01]{4}$")


class Circuit(BaseModel):
    init: Optional[Literal["h"]] = None
    loop: List[Block] = Field(default_factory=list, max_length=4)
    repeat: int = Field(1, ge=0, le=5)
    measure: bool = False


class RunRequest(BaseModel):
    token: str = Field(..., max_length=512)
    circuit: Circuit


@router.post("/device")
def device(req: DeviceRequest):
    return _lesson("device", req.model_dump())


@router.post("/query")
def query(req: QueryRequest):
    return _lesson("query", req.model_dump())


def simulate(secret: int, seed: int, circuit: Circuit):
    return _lesson("run", {"token": make_token(secret, seed), "circuit": circuit.model_dump()})


@router.post("/run")
def run(req: RunRequest):
    try:
        return run_on_worker(lambda: _lesson("run", req.model_dump()), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc


def _lesson(action, body):
    def read_device(value, kind):
        return read_token(value)
    def write_device(kind, secret, seed):
        return make_token(secret, seed)
    backend = None
    if action == "run":
        from qiskit_aer import AerSimulator
        backend = AerSimulator()
    try:
        return lesson(backend, action, body, read_device=read_device, write_device=write_device)
    except ServiceError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.detail) from exc
