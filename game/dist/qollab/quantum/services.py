"""Qollab runtime policy and bridge; lesson implementation lives in core.

The build copies backend/app/core unchanged. Qollab supplies the selected simulator or physical QPU.
"""
import json
from functools import partial
from weakref import WeakKeyDictionary
from core import game_services as shared
from core.game_services import describe as describe_backend, execute, token, read_token, integer, ServiceError


# A remote provider has one submission per Qollab code run. Practice never
# consumes it; only a final challenge can reach the injected remote backend.
_used = WeakKeyDictionary()
_practice = None
RESTART_MESSAGE = "This game session has already used its remote job. Finish collecting your badge, keep your checkpoint code, then restart the game before another final challenge."


def describe(backend):
    info = describe_backend(backend)
    info["remote_final_only"] = "ionq" in type(backend).__module__.lower() or info["kind"] == "hardware"
    return info


def describe_json(backend):
    return json.dumps(describe(backend))


def final_challenge(path, body):
    return (path == "/api/coin/simulate" and body.get("finalChallenge") is True
            or path == "/api/grover/run" and body.get("circuit", {}).get("measure") is True
            or path in ("/api/vault/run", "/api/shor/simulate"))


def route_executor(backend, path, body, progress=None):
    info = describe(backend)
    remote = info["remote_final_only"] and final_challenge(path, body)
    def routed(_backend, circuit, shots, **kwargs):
        global _practice
        if info["remote_final_only"] and not remote:
            if _practice is None:
                from qiskit.providers.basic_provider import BasicSimulator
                _practice = BasicSimulator()
            return execute(_practice, circuit, shots, **kwargs, progress=progress)
        if remote and _used.get(backend):
            raise ServiceError(409, RESTART_MESSAGE)
        def report(state, identifier):
            # Width and circuit validation/transpilation have already passed.
            # Claim before submission: a lost reply must never trigger a retry.
            if remote and state == "submitting":
                _used[backend] = True
                if progress:
                    progress("remote_reserved", "")
            if progress:
                progress(state, identifier)
        return selected_execute(backend, circuit, shots, **kwargs, progress=report)
    return routed


# Qollab selection and the player’s Run action authorize this backend.
selected_execute = partial(execute, allow_hardware=True)


def shor(backend, action, body, *, executor=selected_execute):
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
                         executor=lambda circuit, shots: executor(backend, circuit, shots))


def dispatch(backend, path, body, progress=None):
    executor = route_executor(backend, path, body, progress)
    def shor_with_policy(backend, action, body):
        return shor(backend, action, body, executor=executor)
    return shared.dispatch(backend, path, body, shor_handler=shor_with_policy, executor=executor)


def dispatch_json(backend, path, body_json, progress=None):
    try:
        body = json.loads(body_json or "{}")
        if not isinstance(body, dict):
            raise ServiceError(422, "Invalid request body")
        return json.dumps({"status": 200, "data": dispatch(backend, path, body, progress)}, allow_nan=False)
    except ServiceError as error:
        return json.dumps({"status": error.status, "data": {"detail": error.detail}})
    except Exception as error:
        return json.dumps({"status": 502, "data": {"detail": f"Quantum execution failed: {error}"}})
