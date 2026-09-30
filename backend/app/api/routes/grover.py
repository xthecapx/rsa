"""The Grover lesson: a 4-bit PIN lock and a real four-qubit search circuit.

The PIN never reaches the page. `/device` hands out a signed token holding the
PIN and a seed for the order the 16 amplitude bars are shown in, so the bar
position cannot give the answer away either. `/query` is the classical yes/no
lock, and `/run` builds exactly the circuit the player assembled, evolves it
one block at a time and, only for the full three-round search, measures once.
"""

from __future__ import annotations

import math
import random
import secrets
from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.game_token import read_payload, sign_payload
from app.quantum.worker import QuantumTimeout, run_on_worker

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
    avoid = read_token(req.previous)[0] if req.previous else None
    secret = secrets.randbelow(STATES)
    while secret == avoid:
        secret = secrets.randbelow(STATES)
    return {"token": make_token(secret, secrets.randbits(32))}


@router.post("/query")
def query(req: QueryRequest):
    secret, _ = read_token(req.token)
    return {"match": req.guess == label(secret)}


def _block(name: str, secret: int):
    from qiskit import QuantumCircuit

    qc = QuantumCircuit(QUBITS)
    if name == "h":
        qc.h(range(QUBITS))
    elif name == "x":
        qc.x(range(QUBITS))
    elif name == "oracle":
        # Phase oracle: flip the sign of |secret> only.
        zeros = [q for q in range(QUBITS) if not (secret >> q) & 1]
        if zeros:
            qc.x(zeros)
        qc.h(QUBITS - 1)
        qc.mcx(list(range(QUBITS - 1)), QUBITS - 1)
        qc.h(QUBITS - 1)
        if zeros:
            qc.x(zeros)
    elif name == "diffuser":
        # Inversion about the mean, 2|s><s| - I. The textbook gates give its
        # negative; the global phase keeps signed amplitudes readable.
        qc.h(range(QUBITS))
        qc.x(range(QUBITS))
        qc.h(QUBITS - 1)
        qc.mcx(list(range(QUBITS - 1)), QUBITS - 1)
        qc.h(QUBITS - 1)
        qc.x(range(QUBITS))
        qc.h(range(QUBITS))
        qc.global_phase += math.pi
    return qc


def is_search(circuit: Circuit) -> bool:
    return circuit.init == "h" and circuit.loop == ["oracle", "diffuser"]


def simulate(secret: int, seed: int, circuit: Circuit):
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
    from qiskit_aer import AerSimulator

    order = bar_order(seed)
    state = Statevector.from_label("0" * QUBITS)
    full = QuantumCircuit(QUBITS)

    def snapshot(round_: int, block: str):
        amps = state.data
        return {
            "round": round_,
            "block": block,
            "amplitudes": [round(float(amps[i].real), 6) for i in order],
        }

    steps = [snapshot(0, "start")]
    if circuit.init == "h":
        gate = _block("h", secret)
        state = state.evolve(gate)
        full.compose(gate, inplace=True)
        steps.append(snapshot(0, "h"))
    for round_ in range(1, circuit.repeat + 1):
        for name in circuit.loop:
            gate = _block(name, secret)
            state = state.evolve(gate)
            full.compose(gate, inplace=True)
            steps.append(snapshot(round_, name))

    result = {"steps": steps, "measured": None, "labels": None}
    if circuit.measure:
        full.measure_all()
        shot = AerSimulator().run(full, shots=1, memory=True).result().get_memory()[0]
        result["measured"] = shot
        result["labels"] = [label(i) for i in order]
    return result


@router.post("/run")
def run(req: RunRequest):
    secret, seed = read_token(req.token)
    circuit = req.circuit
    if circuit.measure and not is_search(circuit):
        raise HTTPException(status_code=409, detail={"reason": "circuit"})
    if circuit.measure and circuit.repeat != ROUNDS:
        raise HTTPException(status_code=409, detail={"reason": "rounds"})
    try:
        return run_on_worker(lambda: simulate(secret, seed, circuit), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc
