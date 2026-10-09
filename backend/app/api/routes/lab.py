"""HTTP adapter for the shared player-lab builder."""
from fastapi import APIRouter, Header
from app.core.game_services import lab
from app.quantum.simulators import SimulatorChoice, simulator, display_name
from app.api.quantum_execution import run_quantum
router = APIRouter()

@router.post("/run")
def run(body: dict, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    def work():
        result = lab(simulator(choice), body)
        result["backend"] = display_name(choice)
        return result
    return run_quantum(work, timeout=30, service_errors=True, aer_unavailable=False)
