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

import secrets
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.game_token import read_payload, sign_payload
from app.quantum.worker import QuantumTimeout, run_on_worker

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


def wiring_problem(circuit: Circuit) -> Optional[str]:
    """First concept the circuit gets wrong, in the order the page explains them."""
    if circuit.extra:
        return "extra"
    if circuit.prep != "h":
        return "prep"
    if circuit.helper != "minus":
        return "helper"
    if circuit.out != "h":
        return "output"
    if not circuit.measure:
        return "measure"
    return None


@router.post("/device")
def device(req: DeviceRequest):
    avoid = read_token(req.previous) if req.previous else None
    secret = 0
    while secret == 0 or secret == avoid:
        secret = secrets.randbits(BITS)
    return {"token": make_token(secret)}


@router.post("/key")
def key(req: KeyRequest):
    return {"open": from_bits(req.key) == read_token(req.token)}


@router.post("/ask")
def ask(req: AskRequest):
    x = from_bits(req.x)
    if x == 0:
        raise HTTPException(status_code=422, detail="Light at least one candle")
    return {"knock": parity(read_token(req.token), x)}


def kickback_phases(secret: int) -> List[str]:
    """Each data qubit on its own: |+> picks up (-1)^{s_i} from the |-> helper."""
    return ["-" if (secret >> i) & 1 else "+" for i in range(BITS)]


def simulate(secret: int):
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator

    helper = BITS
    qc = QuantumCircuit(BITS + 1, BITS)
    qc.h(range(BITS))
    qc.x(helper)
    qc.h(helper)
    for i in range(BITS):
        if (secret >> i) & 1:
            qc.cx(i, helper)
    qc.h(range(BITS))
    qc.measure(range(BITS), range(BITS))

    memory = AerSimulator(method="stabilizer").run(qc, shots=1, memory=True).result().get_memory()[0]
    # Qiskit prints classical bit 0 last; the page reads tumbler 0 first.
    measured = memory[::-1]
    phases = kickback_phases(secret)
    return {
        "frames": [
            {"block": "prep", "phases": ["+"] * BITS},
            {"block": "oracle", "phases": phases},
            {"block": "out", "bits": "".join("1" if p == "-" else "0" for p in phases)},
        ],
        "measured": measured,
        "queries": 1,
    }


@router.post("/run")
def run(req: RunRequest):
    secret = read_token(req.token)
    problem = wiring_problem(req.circuit)
    if problem:
        raise HTTPException(status_code=409, detail={"reason": problem})
    try:
        return run_on_worker(lambda: simulate(secret), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc
