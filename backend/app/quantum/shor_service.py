"""HTTP Shor adapter: select local Aer; shared core builds and reads circuits."""
from app.core.shor_service import plan_shor, classical_shor
from app.core.shor_service import simulate_shor as shared_simulate
from app.core.game_services import execute


def simulate_shor(N, a, *, choice="ideal", **options):
    from app.quantum.simulators import simulator, display_name
    backend = simulator(choice)

    def executor(circuit, shots):
        counts, memory, compiled, info = execute(backend, circuit, shots)
        return counts, memory, compiled, {**info, "backend": display_name(choice)}

    return shared_simulate(N, a, executor=executor, **options)
