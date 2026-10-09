"""HTTP transport for the shared Foundry/Hollow teaching registers."""
from fastapi import APIRouter, Header
from pydantic import BaseModel, Field
from app.core.game_services import register
from app.quantum.simulators import SimulatorChoice, simulator, display_name
from app.api.quantum_execution import run_quantum

router = APIRouter()


class RegisterRequest(BaseModel):
    qubits: int = Field(2, ge=2, le=4)
    start: str = Field(..., max_length=4)
    operations: list[str] = Field(max_length=32)
    shots: int = Field(256, ge=1, le=1024)


@router.post("/circuit")
def circuit(req: RegisterRequest, choice: SimulatorChoice = Header("ideal", alias="X-Quantum-Simulator")):
    def run():
        result = register(simulator(choice), "circuit", req.model_dump())
        result["backend"] = display_name(choice)
        return result
    return run_quantum(run, service_errors=True)
