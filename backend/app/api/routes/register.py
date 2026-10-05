"""HTTP transport for the shared Foundry/Hollow teaching registers."""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from app.core.game_services import register, ServiceError
from app.quantum.simulators import SimulatorChoice, simulator, display_name
from app.quantum.worker import run_on_worker, QuantumTimeout

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
    try:
        return run_on_worker(run, timeout=15)
    except ServiceError as exc:
        raise HTTPException(exc.status, exc.detail) from exc
    except QuantumTimeout as exc:
        raise HTTPException(504, str(exc)) from exc
    except ImportError as exc:
        raise HTTPException(503, "Qiskit Aer is unavailable") from exc
