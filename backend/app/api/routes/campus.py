"""HTTP adapter for optional campus practice, using the shared circuit service."""
from fastapi import APIRouter, Header
from app.core.game_services import campus
from app.quantum.simulators import SimulatorChoice, simulator, display_name
from app.api.quantum_execution import run_quantum

router = APIRouter()

@router.post("/run")
def run(body: dict, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    def work():
        result = campus(simulator(choice), body)
        result["backend"] = display_name(choice)
        return result
    return run_quantum(work, timeout=30, service_errors=True, aer_unavailable=False)
