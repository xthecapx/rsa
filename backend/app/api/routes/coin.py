"""The coin lesson: repeatable Python randomness and a one-qubit simulation.

No IBM calls or hardware submission. Every simulation prepares a fresh |0>
per shot, optionally applies H, and measures in the computational basis.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from app.quantum.worker import QuantumTimeout, run_on_worker
from app.core.game_services import coin

from app.quantum.simulators import SimulatorChoice, simulator, display_name

router = APIRouter()


class ClassicalCoinRequest(BaseModel):
    seed: int = Field(42, ge=0, le=2**32 - 1)
    flips: int = Field(6, ge=1, le=100)


class QuantumCoinRequest(BaseModel):
    hadamard: bool = True
    shots: int = Field(1, ge=1, le=1024)


class BenchCircuitRequest(BaseModel):
    starts: list[Literal["0", "1", "+", "-"]] = Field(min_length=1, max_length=4)
    gates: list[Literal["X", "Z", "H"]] = Field(max_length=8)
    shots: int = Field(256, ge=1, le=1024)


@router.post("/classical")
def classical(req: ClassicalCoinRequest):
    return coin(None, "classical", req.model_dump())


def simulate_coin(hadamard: bool, shots: int, choice: SimulatorChoice = "ideal"):
    return _coin("simulate", {"hadamard": hadamard, "shots": shots}, choice)


def _coin(action, body, choice: SimulatorChoice = "ideal"):
    result = coin(simulator(choice), action, body)
    result["backend"] = display_name(choice)
    return result


@router.post("/simulate")
def simulate(req: QuantumCoinRequest, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    try:
        return run_on_worker(lambda: simulate_coin(req.hadamard, req.shots, choice), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc


def simulate_bench(starts, gates, shots, choice: SimulatorChoice = "ideal"):
    return _coin("circuit", {"starts": starts, "gates": gates, "shots": shots}, choice)


@router.post("/circuit")
def circuit(req: BenchCircuitRequest, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    try:
        return run_on_worker(lambda: simulate_bench(req.starts, req.gates, req.shots, choice), timeout=15)
    except QuantumTimeout as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="Qiskit Aer is unavailable") from exc
