"""Qollab service adapter. The runner owns the backend; this module never creates one.

Call dispatch_json through Pyodide's callPromising, including from event handlers.
Classical helpers are copied from backend/app/core when building the distribution.
"""
from __future__ import annotations

import base64
import json
import math
import random
import secrets

from core import (
    caesar_crack, caesar_decrypt, caesar_encrypt, char_to_message, keyboard_state,
    rsa_crack_toy, rsa_decrypt, rsa_encrypt, rsa_keygen, rsa_projected_crack_time,
)

BITS = 25


class ServiceError(ValueError):
    def __init__(self, status, detail):
        super().__init__(str(detail))
        self.status, self.detail = status, detail


def describe(backend):
    name = getattr(backend, "name", type(backend).__name__)
    name = name() if callable(name) else str(name)
    module = type(backend).__module__.lower()
    fake = "fake" in module or name.lower().startswith("fake_")
    config = backend.configuration() if hasattr(backend, "configuration") else None
    basic = "basic_provider" in module
    braket_local = "braket" in module and "local" in type(backend).__name__.lower()
    simulator = fake or basic or braket_local or bool(getattr(config, "simulator", False)) or bool(getattr(backend, "simulator", False))
    qubits = getattr(backend, "num_qubits", None) or getattr(config, "n_qubits", None) or (24 if basic else 25 if braket_local else None)
    noise = fake or "ionq" in module or "aer" in module and bool(getattr(getattr(backend, "options", None), "noise_model", None))
    return {"status": "ok", "backend": name, "kind": "noise" if simulator and noise else "ideal" if simulator else "hardware",
            "qubits": qubits, "vault_qubits": BITS + 1, "fake": fake}


def describe_json(backend):
    return json.dumps(describe(backend))


def integer(body, key, default, low, high):
    value = body.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ServiceError(422, f"Invalid {key}: expected an integer from {low} to {high}")
    return value


def bitstring(value, width):
    if not isinstance(value, str) or len(value) != width or set(value) - {"0", "1"}:
        raise ServiceError(422, "Invalid bitstring")
    return value


def token(kind, secret, seed=0):
    payload = json.dumps({"k": kind, "s": secret, "p": seed}, separators=(",", ":")).encode()
    return "qollab-v1." + base64.urlsafe_b64encode(payload).decode()


def read_token(value, kind):
    try:
        prefix, payload = value.split(".", 1)
        if prefix != "qollab-v1":
            raise ValueError("version")
        data = json.loads(base64.urlsafe_b64decode(payload))
        limit = 16 if kind == "grover" else 2 ** BITS
        if data["k"] != kind or type(data["s"]) is not int or not 0 <= data["s"] < limit:
            raise ValueError("secret")
        if kind == "vault" and data["s"] == 0:
            raise ValueError("empty secret")
        if type(data.get("p")) is not int:
            raise ValueError("seed")
        return data["s"], data["p"]
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ServiceError(400, "Unknown device") from None


def execute(backend, circuit, shots, *, memory=False, vault=False):
    from qiskit import transpile
    info = describe(backend)
    if info["kind"] == "hardware":
        raise ServiceError(400, "Choose a simulator in Qollab. This game does not submit paid hardware jobs.")
    if info["qubits"] and circuit.num_qubits > info["qubits"]:
        raise ServiceError(400, "Ghost Key needs 26 qubits. Stop and select an IBM noise-model or compatible larger simulator in Qollab.")
    compiled = transpile(circuit, backend=backend, optimization_level=1)
    options = {"shots": shots}
    # Aer-backed fake IBM devices support MPS. Keep the selected backend and
    # its noise model, while avoiding a dense 26-qubit statevector allocation.
    if vault and info["fake"]:
        options["method"] = "matrix_product_state"
    if memory and "ionq" not in type(backend).__module__.lower():
        options["memory"] = True
    job = backend.run(compiled, **options)
    result = job.result()
    raw = result.get_counts()
    counts = {}
    width = circuit.num_clbits
    for key, value in raw.items():
        key = str(key).replace(" ", "")
        if key.startswith("0x"):
            key = format(int(key, 16), f"0{width}b")
        key = key.zfill(width)
        if len(key) != width or set(key) - {"0", "1"} or value < 0 or int(value) != value:
            raise ServiceError(502, "The simulator returned invalid measurement counts.")
        counts[key] = counts.get(key, 0) + int(value)
    if sum(counts.values()) != shots:
        raise ServiceError(502, "The simulator returned an unexpected shot count.")
    bits = None
    if memory and "memory" in options:
        try:
            bits = [str(value).replace(" ", "").zfill(width) for value in result.get_memory()]
        except Exception:
            # Providers may expose get_memory but not implement it.
            bits = None
    return counts, bits, compiled, info


def coin(backend, action, body):
    if action == "classical":
        flips = integer(body, "flips", 6, 1, 100)
        seed = integer(body, "seed", 42, 0, 2 ** 32 - 1)
        rng = random.Random(seed)
        return {"seed": seed, "bits": [rng.randint(0, 1) for _ in range(flips)], "source": "python_seeded_prng"}
    if action != "simulate":
        raise ServiceError(404, "Unknown coin operation")
    from qiskit import QuantumCircuit
    shots = integer(body, "shots", 1, 1, 1024)
    h = body.get("hadamard", True)
    if not isinstance(h, bool):
        raise ServiceError(422, "Invalid hadamard")
    qc = QuantumCircuit(1, 1)
    if h:
        qc.h(0)
    qc.measure(0, 0)
    counts, memory, _, info = execute(backend, qc, shots, memory=True)
    reconstructed = memory is None and shots > 1
    if memory is None:
        memory = [key for key, count in counts.items() for _ in range(count)]
        random.shuffle(memory)
    return {"source": "simulator", "backend": info["backend"], "hadamard": h, "shots": shots,
            "bits": [int(bit) for bit in memory], "memory_reconstructed": reconstructed,
            "counts": {"0": counts.get("0", 0), "1": counts.get("1", 0)},
            "probabilities": {"0": 0.5 if h else 1.0, "1": 0.5 if h else 0.0}}


def device(kind, body):
    avoid = read_token(body["previous"], kind)[0] if body.get("previous") else None
    secret = avoid
    while secret == avoid or kind == "vault" and secret == 0:
        secret = secrets.randbelow(16 if kind == "grover" else 2 ** BITS)
    return {"token": token(kind, secret, secrets.randbits(32))}


def grover_block(name, secret):
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(4)
    if name == "h":
        qc.h(range(4))
    elif name == "x":
        qc.x(range(4))
    elif name in ("oracle", "diffuser"):
        if name == "diffuser":
            qc.h(range(4))
        zeros = [q for q in range(4) if name == "diffuser" or not (secret >> q) & 1]
        qc.x(zeros)
        qc.h(3)
        qc.mcx([0, 1, 2], 3)
        qc.h(3)
        qc.x(zeros)
        if name == "diffuser":
            qc.h(range(4))
            qc.global_phase += math.pi
    else:
        raise ServiceError(422, "Unknown Grover block")
    return qc


def grover(backend, action, body):
    if action == "device":
        return device("grover", body)
    secret, seed = read_token(body.get("token"), "grover")
    if action == "query":
        return {"match": bitstring(body.get("guess"), 4) == format(secret, "04b")}
    if action != "run":
        raise ServiceError(404, "Unknown Grover operation")
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
    circuit = body.get("circuit", {})
    repeat = integer(circuit, "repeat", 1, 0, 5)
    loop = circuit.get("loop", [])
    if not isinstance(loop, list) or len(loop) > 4 or any(x not in ("h", "x", "oracle", "diffuser") for x in loop):
        raise ServiceError(422, "Invalid Grover circuit")
    if circuit.get("init") not in (None, "h") or type(circuit.get("measure", False)) is not bool:
        raise ServiceError(422, "Invalid Grover circuit")
    measure = circuit.get("measure", False)
    if measure and (circuit.get("init") != "h" or loop != ["oracle", "diffuser"]):
        raise ServiceError(409, {"reason": "circuit"})
    if measure and repeat != 3:
        raise ServiceError(409, {"reason": "rounds"})
    order = list(range(16))
    random.Random(seed).shuffle(order)
    state = Statevector.from_label("0000")
    full = QuantumCircuit(4)
    steps = []
    def snapshot(round_, block):
        steps.append({"round": round_, "block": block, "amplitudes": [round(float(state.data[i].real), 6) for i in order]})
    snapshot(0, "start")
    if circuit.get("init") == "h":
        gate = grover_block("h", secret)
        state = state.evolve(gate)
        full.compose(gate, inplace=True)
        snapshot(0, "h")
    for round_ in range(1, repeat + 1):
        for block in loop:
            gate = grover_block(block, secret)
            state = state.evolve(gate)
            full.compose(gate, inplace=True)
            snapshot(round_, block)
    measured = None
    if measure:
        full.measure_all()
        counts, _, _, _ = execute(backend, full, 1)
        measured = next(key for key, value in counts.items() if value)
    return {"steps": steps, "measured": measured, "labels": [format(i, "04b") for i in order] if measure else None}


def vault(backend, action, body):
    if action == "device":
        return device("vault", body)
    secret, _ = read_token(body.get("token"), "vault")
    def from_bits(value):
        return sum(1 << i for i, bit in enumerate(bitstring(value, BITS)) if bit == "1")
    if action == "key":
        return {"open": from_bits(body.get("key")) == secret}
    if action == "ask":
        x = from_bits(body.get("x"))
        if not x:
            raise ServiceError(422, "Light at least one candle")
        return {"knock": (secret & x).bit_count() % 2}
    if action != "run":
        raise ServiceError(404, "Unknown vault operation")
    c = body.get("circuit", {})
    reason = "extra" if c.get("extra") else "prep" if c.get("prep") != "h" else "helper" if c.get("helper") != "minus" else "output" if c.get("out") != "h" else "measure" if not c.get("measure") else None
    if reason:
        raise ServiceError(409, {"reason": reason})
    from qiskit import QuantumCircuit
    qc = QuantumCircuit(BITS + 1, BITS)
    qc.h(range(BITS))
    qc.x(BITS)
    qc.h(BITS)
    for i in range(BITS):
        if secret >> i & 1:
            qc.cx(i, BITS)
    qc.h(range(BITS))
    qc.measure(range(BITS), range(BITS))
    counts, _, _, _ = execute(backend, qc, 1, vault=True)
    measured = next(key for key, value in counts.items() if value)[::-1]
    phases = ["-" if secret >> i & 1 else "+" for i in range(BITS)]
    return {"frames": [{"block": "prep", "phases": ["+"] * BITS}, {"block": "oracle", "phases": phases},
                       {"block": "out", "bits": "".join("1" if p == "-" else "0" for p in phases)}],
            "measured": measured, "queries": 1}


def shor(backend, action, body):
    from vendor.shor import Shor, analyze_counts, build_step_plan, classical_order, classical_precheck, factors_from_order
    N = integer(body, "N", 15, 3, 255)
    a = integer(body, "a", 7, 2, 255)
    m = body.get("num_control")
    m = 2 * (N - 1).bit_length() if m is None else integer(body, "num_control", 4, 1, 12)
    # General permutation synthesis can become very deep in a browser.
    if N != 15:
        raise ServiceError(400, "The Qollab Shor experiment supports N=15. Use the web build for other moduli.")
    pre = classical_precheck(N, a)
    if action == "plan":
        entries = [{**entry.to_dict(), "slot": entry.control_index} for entry in build_step_plan(N, a, m)]
        out = {"N": N, "a": a, "num_control": m, "precheck": pre.to_dict(), "step_plan": entries,
               "identity_skipped": sum(e["status"] == "identity" for e in entries),
               "quantum_required_slots": sum(e["status"] != "identity" for e in entries)}
        if not pre.needs_quantum:
            out.update(factor=pre.factor, factors=list(pre.factors) if pre.factors else None)
        else:
            r = classical_order(a, N)
            out.update(classical_order=r, factors_from_classical_order=factors_from_order(a, r, N), shor_plan=Shor(N, a, num_control=m).plan_dict())
        return out
    if action != "simulate":
        raise ServiceError(404, "Unknown Shor operation")
    shots = integer(body, "shots", 1024, 1, 8192)
    if not pre.needs_quantum:
        return {"precheck": pre.to_dict(), "circuit_built": False, "factor": pre.factor, "factors": list(pre.factors) if pre.factors else None}
    experiment = Shor(N, a, num_control=m, strategy="permutation")
    counts, _, circuit, info = execute(backend, experiment.circuit, shots)
    analysis = analyze_counts(counts, a, N, m, true_order=experiment.true_order)
    success = [o for o in analysis["outcomes"] if (o.get("factoring") or {}).get("nontrivial")]
    success.sort(key=lambda o: (bool(o.get("order_matches_true")), len((o.get("factoring") or {}).get("factors") or []), o["count"]), reverse=True)
    hit = success[0] if success else {}
    successes = sum(o["count"] for o in success)
    orders = sum(o["count"] for o in success if o.get("order_matches_true"))
    return {"precheck": pre.to_dict(), "plan": experiment.plan_dict(), "backend": info["backend"],
            "engine": "qward.algorithms.Shor 0.28.1", "method": "phase_estimation + continued_fractions", "strategy": "permutation",
            "num_control": m, "num_target": experiment.num_target, "num_qubits": experiment.num_qubits,
            "true_order": experiment.true_order, "shots": shots, "counts": counts, "analysis": analysis,
            "successful_outcomes": success[:8], "success_shots": successes, "success_rate": successes / shots,
            "order_hit_shots": orders, "order_hit_rate": orders / shots, "jobs_run": 1,
            "shor_result": {"order_guess": hit.get("order_guess"), "factors": (hit.get("factoring") or {}).get("factors"),
                            "bitstring": hit.get("bitstring"), "phase": hit.get("phase"), "fraction": hit.get("fraction"),
                            "found": bool(hit), "order_matches_true": bool(hit.get("order_matches_true")), "true_order": experiment.true_order},
            "expected_distribution": experiment.expected_distribution(), "circuit_depth": circuit.depth(),
            "circuit_text": str(circuit.draw(output="text", fold=-1))[:80000] if circuit.depth() <= 400 else "[deep circuit drawing omitted]"}


def dispatch(backend, path, body):
    if path == "/api/health":
        return describe(backend)
    if path == "/api/plaintext":
        c = body["char"].strip().upper()
        return {"char": c, "value": char_to_message(c), "encrypted": False,
                "packet": {"payload": c, "readable_by_hacker": True}, "trace": [{"step": "send", "detail": f"Ale sends '{c}' in the clear"}]}
    if path == "/api/keyboard":
        return {"keys": keyboard_state(modulus=body.get("modulus"), require_coprime=body.get("require_coprime", False))}
    if path.startswith("/api/caesar/"):
        action = path.rsplit("/", 1)[1]
        if action == "crack":
            return caesar_crack(body["ciphertext"], body.get("expected_plaintext"))
        if action in ("encrypt", "decrypt"):
            return (caesar_encrypt if action == "encrypt" else caesar_decrypt)(body["char"], integer(body, "shift", 1, -1000000, 1000000))
    if path.startswith("/api/rsa/"):
        action = path.rsplit("/", 1)[1]
        N = integer(body, "N", 15, 3, 255)
        if action == "keygen":
            return rsa_keygen(N)
        if action in ("encrypt", "decrypt"):
            return (rsa_encrypt if action == "encrypt" else rsa_decrypt)(integer(body, "m" if action == "encrypt" else "c", 1, 0, 254), integer(body, "e" if action == "encrypt" else "d", 3, 1, 1000000), N)
        if action == "crack":
            return {"toy": rsa_crack_toy(N), "rsa2048_projection": rsa_projected_crack_time(integer(body, "bits", 2048, 16, 8192))}
    for family, handler in (("coin", coin), ("grover", grover), ("vault", vault), ("shor", shor)):
        if path.startswith(f"/api/{family}/"):
            return handler(backend, path.rsplit("/", 1)[1], body)
    raise ServiceError(404, "Unknown game operation")


def dispatch_json(backend, path, body_json):
    try:
        body = json.loads(body_json)
        if not isinstance(body, dict):
            raise ServiceError(422, "Invalid request")
        return json.dumps({"status": 200, "data": dispatch(backend, path, body)}, allow_nan=False)
    except ServiceError as error:
        return json.dumps({"status": error.status, "data": {"detail": error.detail}})
    except (ValueError, KeyError, TypeError) as error:
        return json.dumps({"status": 422, "data": {"detail": str(error)}})
    except Exception as error:
        return json.dumps({"status": 503, "data": {"detail": f"Simulator execution failed: {error}"}})
