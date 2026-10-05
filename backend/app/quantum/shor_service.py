"""HTTP Shor adapter: select local Aer; shared core builds and reads circuits."""
from app.core.shor_service import plan_shor, classical_shor
from app.core.shor_service import simulate_shor as shared_simulate
from app.core.game_services import execute


def simulate_shor(N, a, **options):
    from qiskit_aer import AerSimulator
    backend = AerSimulator(method="statevector")

    def executor(circuit, shots):
        counts, memory, compiled, info = execute(backend, circuit, shots)
        return counts, memory, compiled, {**info, "backend": "AerSimulator"}

    return shared_simulate(N, a, executor=executor, **options)
