"""The coin lesson: repeatable Python randomness and a one-qubit simulation.

No IBM calls or hardware submission. Every simulation prepares a fresh |0>
per shot, optionally applies H, and measures in the computational basis.
"""

import random

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.quantum.worker import QuantumTimeout, run_on_worker

router = APIRouter()


class ClassicalCoinRequest(BaseModel):
    seed: int = Field(42, ge=0, le=2**32 - 1)
    flips: int = Field(6, ge=1, le=100)


class QuantumCoinRequest(BaseModel):
    hadamard: bool = True
    shots: int = Field(1, ge=1, le=1024)


@router.post("/classical")
def classical(req: ClassicalCoinRequest):
    coin = random.Random(req.seed)
    return {
        "seed": req.seed,
        "bits": [coin.randint(0, 1) for _ in range(req.flips)],
        "source": "python_seeded_prng",
    }


def simulate_coin(hadamard: bool, shots: int):
    from qiskit import QuantumCircuit
    from qiskit_aer import AerSimulator

    circuit = QuantumCircuit(1, 1)
    if hadamard:
        circuit.h(0)
    circuit.measure(0, 0)
    result = AerSimulator().run(circuit, shots=shots, memory=True).result()
    bits = [int(bit) for bit in result.get_memory()]
    return {
        "source": "simulator",
        "backend": "AerSimulator",
        "hadamard": hadamard,
        "shots": shots,
        "bits": bits,
        "counts": {"0": bits.count(0), "1": bits.count(1)},
        "probabilities": {"0": 0.5 if hadamard else 1.0, "1": 0.5 if hadamard else 0.0},
    }


@router.post("/simulate")
def simulate(req: QuantumCoinRequest):
    try:
        return run_on_worker(lambda: simulate_coin(req.hadamard, req.shots), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc
