"""HTTP adapter for the shared player-lab builder."""
from fastapi import APIRouter, Header, HTTPException
from app.core.game_services import lab, ServiceError
from app.quantum.simulators import SimulatorChoice, simulator, display_name
from app.quantum.worker import run_on_worker, QuantumTimeout
router = APIRouter()

@router.post("/run")
def run(body: dict, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    def work():
        result = lab(simulator(choice), body)
        result["backend"] = display_name(choice)
        return result
    try:
        return run_on_worker(work, timeout=30)
    except ServiceError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    except QuantumTimeout as exc:
        raise HTTPException(504, str(exc)) from exc
