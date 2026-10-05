"""Qollab runtime policy and bridge; lesson implementation lives in core.

The build copies backend/app/core unchanged. Qollab supplies the simulator.
"""
from core import game_services as shared
from core.game_services import describe, describe_json, execute, token, read_token, integer, ServiceError


def shor(backend, action, body):
    # Browser capabilities are deployment policy; circuit/result logic is shared.
    from vendor.shor import Shor, analyze_counts, build_step_plan, classical_order, classical_precheck, factors_from_order
    from core.shor_service import plan_shor, classical_shor, simulate_shor
    engine = (Shor, analyze_counts, build_step_plan, classical_order, classical_precheck, factors_from_order)
    N = integer(body, "N", 15, 3, 255)
    a = integer(body, "a", 7, 2, 255)
    m = body.get("num_control")
    if m is not None:
        m = integer(body, "num_control", 4, 1, 12)
    if N != 15:
        raise ServiceError(400, "The Qollab Shor experiment supports N=15. Use the web build for other moduli.")
    if action == "plan":
        return plan_shor(N, a, m, engine=engine)
    if action == "classical":
        return classical_shor(N, a, engine=engine)
    if action != "simulate":
        raise ServiceError(404, "Unknown Shor operation")
    shots = integer(body, "shots", 1024, 1, 8192)
    return simulate_shor(N, a, num_control=m, shots=shots, engine=engine,
                         executor=lambda circuit, shots: execute(backend, circuit, shots))


def dispatch(backend, path, body):
    return shared.dispatch(backend, path, body, shor_handler=shor)


def dispatch_json(backend, path, body_json):
    return shared.dispatch_json(backend, path, body_json, shor_handler=shor)
