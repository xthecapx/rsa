"""Shared game services. Adapters supply a simulator and device-token policy.

No HTTP framework, credentials, or runtime-specific dependencies belong here.
"""
from __future__ import annotations

import base64
import json
import math
import random
import secrets

from . import (
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
    simulator = fake or basic or braket_local or ("ionq" in module and "simulator" in name.lower()) or bool(getattr(config, "simulator", False)) or bool(getattr(backend, "simulator", False))
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


def execute(backend, circuit, shots, *, memory=False, vault=False, allow_hardware=False, progress=None):
    from qiskit import transpile
    info = describe(backend)
    if info["kind"] == "hardware" and not allow_hardware:
        raise ServiceError(400, "Choose a simulator. This execution does not submit paid hardware jobs.")
    if info["qubits"] and circuit.num_qubits > info["qubits"]:
        if vault:
            raise ServiceError(400, "Ghost Key needs 26 qubits. Keep your checkpoint code and select a compatible backend with at least 26 qubits.")
        raise ServiceError(400, f"This circuit needs {circuit.num_qubits} qubits; {info['backend']} supports {info['qubits']}. Keep your checkpoint code and select a larger backend.")
    if progress:
        progress("preparing", "")
    compiled = transpile(circuit, backend=backend, optimization_level=1)
    options = {"shots": shots}
    # Aer-backed fake IBM devices support MPS. Keep the selected backend and
    # its noise model, while avoiding a dense 26-qubit statevector allocation.
    if vault and info["fake"]:
        options["method"] = "matrix_product_state"
    if memory and info["kind"] != "hardware" and "ionq" not in type(backend).__module__.lower():
        options["memory"] = True
    if progress:
        progress("submitting", "")
    job = backend.run(compiled, **options)
    if progress:
        identifier = getattr(job, "job_id", None)
        identifier = identifier() if callable(identifier) else identifier
        identifier = str(identifier or "")
        progress("waiting", identifier)
        # Provider polling reports real states; local jobs need no polling.
        remote = info["kind"] == "hardware" or "ionq" in type(backend).__module__.lower()
        if remote and callable(getattr(job, "wait_for_final_state", None)):
            def report(job_id, job_status, *args, **kwargs):
                progress(str(getattr(job_status, "name", job_status)).lower(), identifier)
            job.wait_for_final_state(wait=5, callback=report)
        progress("retrieving", identifier)
    if info["kind"] == "hardware":
        job_id = getattr(job, "job_id", None)
        job_id = job_id() if callable(job_id) else job_id
        print(f"Submitted QPU job {job_id or '(provider ID unavailable)'} on {info['backend']}. Waiting for measurements…", flush=True)
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


def coin(backend, action, body, *, executor=execute):
    if action == "circuit":
        from .coin_circuit import teaching_circuit
        starts, gates = body.get("starts"), body.get("gates")
        if not isinstance(starts, list) or not 1 <= len(starts) <= 4 or any(start not in ("0", "1", "+", "-") for start in starts):
            raise ServiceError(422, "Invalid starting states")
        if not isinstance(gates, list) or len(gates) > 8 or any(gate not in ("X", "Z", "H") for gate in gates):
            raise ServiceError(422, "Invalid gates")
        shots = integer(body, "shots", 256, 1, 1024)
        circuits = []
        for start in starts:
            circuit, ideal = teaching_circuit(start, gates)
            counts, _, _, info = executor(backend, circuit, shots)
            circuits.append({"start": start, "counts": {"0": counts.get("0", 0), "1": counts.get("1", 0)}, "probabilities": ideal})
        return {"source": "hardware" if info["kind"] == "hardware" else "simulator", "backend": info["backend"], "kind": info["kind"], "shots": shots, "circuits": circuits}
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
    counts, memory, _, info = executor(backend, qc, shots, memory=True)
    reconstructed = memory is None and shots > 1
    if memory is None:
        memory = [key for key, count in counts.items() for _ in range(count)]
        random.shuffle(memory)
    return {"source": "hardware" if info["kind"] == "hardware" else "simulator", "backend": info["backend"], "kind": info["kind"], "hadamard": h, "shots": shots,
            "bits": [int(bit) for bit in memory], "memory_reconstructed": reconstructed,
            "counts": {"0": counts.get("0", 0), "1": counts.get("1", 0)},
            "probabilities": {"0": 0.5 if h else 1.0, "1": 0.5 if h else 0.0}}


def device(kind, body, *, read_device=read_token, write_device=token):
    avoid = read_device(body["previous"], kind)[0] if body.get("previous") else None
    secret = avoid
    while secret == avoid or kind == "vault" and secret == 0:
        secret = secrets.randbelow(16 if kind == "grover" else 2 ** BITS)
    return {"token": write_device(kind, secret, secrets.randbits(32))}


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


def grover(backend, action, body, *, read_device=read_token, write_device=token, executor=execute):
    if action == "device":
        return device("grover", body, read_device=read_device, write_device=write_device)
    secret, seed = read_device(body.get("token"), "grover")
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
    # Preview measurements use fresh preparations; the final PIN remains one shot.
    full.measure_all()
    shots = 1 if measure else 256
    counts, _, _, info = executor(backend, full, shots)
    if measure:
        measured = next(key for key, value in counts.items() if value)
    return {"steps": steps, "measured": measured, "labels": [format(i, "04b") for i in order] if measure else None,
            "counts": {str(position): counts.get(format(i, "04b"), 0) for position, i in enumerate(order)},
            "shots": shots, "backend": info["backend"], "kind": info["kind"],
            "source": "hardware" if info["kind"] == "hardware" else "simulator"}


def vault(backend, action, body, *, read_device=read_token, write_device=token, executor=execute):
    if action == "device":
        return device("vault", body, read_device=read_device, write_device=write_device)
    secret, _ = read_device(body.get("token"), "vault")
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
    counts, _, _, info = executor(backend, qc, 1, vault=True)
    measured = next(key for key, value in counts.items() if value)[::-1]
    phases = ["-" if secret >> i & 1 else "+" for i in range(BITS)]
    return {"frames": [{"block": "prep", "phases": ["+"] * BITS}, {"block": "oracle", "phases": phases},
                       {"block": "out", "bits": "".join("1" if p == "-" else "0" for p in phases)}],
            "measured": measured, "queries": 1, "counts": {key[::-1]: value for key, value in counts.items()},
            "shots": 1, "backend": info["backend"], "kind": info["kind"],
            "source": "hardware" if info["kind"] == "hardware" else "simulator"}



def dispatch(backend, path, body, *, shor_handler=None, executor=execute):
    if path == "/api/lab/run":
        return lab(backend, body, executor=executor)
    if path == "/api/health":
        return describe(backend)
    if path == "/api/plaintext":
        return plaintext(body["char"])
    if path == "/api/keyboard":
        return keyboard(body.get("modulus"), body.get("require_coprime", False))
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
            return crack_rsa(N, integer(body, "bits", 2048, 16, 8192))
    if path.startswith("/api/shor/") and shor_handler is not None:
        return shor_handler(backend, path.rsplit("/", 1)[1], body)
    for family, handler in (("coin", coin), ("grover", grover), ("vault", vault), ("register", register)):
        if path.startswith(f"/api/{family}/"):
            return handler(backend, path.rsplit("/", 1)[1], body, executor=executor)
    raise ServiceError(404, "Unknown game operation")


def dispatch_json(backend, path, body_json, *, shor_handler=None, executor=execute):
    try:
        body = json.loads(body_json)
        if not isinstance(body, dict):
            raise ServiceError(422, "Invalid request")
        return json.dumps({"status": 200, "data": dispatch(backend, path, body, shor_handler=shor_handler, executor=executor)}, allow_nan=False)
    except ServiceError as error:
        return json.dumps({"status": error.status, "data": {"detail": error.detail}})
    except (ValueError, KeyError, TypeError) as error:
        return json.dumps({"status": 422, "data": {"detail": str(error)}})
    except Exception as error:
        return json.dumps({"status": 503, "data": {"detail": f"Quantum execution failed: {error}"}})


def plaintext(char):
    c = char.strip().upper()
    return {"char": c, "value": char_to_message(c), "encrypted": False,
            "packet": {"payload": c, "readable_by_hacker": True},
            "trace": [{"step": "send", "detail": f"Ale sends '{c}' in the clear"}]}


def keyboard(modulus=None, require_coprime=False):
    return {"keys": keyboard_state(modulus=modulus, require_coprime=require_coprime)}


def crack_rsa(N, bits):
    return {"toy": rsa_crack_toy(N), "rsa2048_projection": rsa_projected_crack_time(bits)}


def register(backend, action, body, *, executor=execute):
    if action != "circuit":
        raise ServiceError(404, "Unknown register operation")
    from .register_circuit import teaching_register
    qubits = integer(body, "qubits", 2, 2, 4)
    shots = integer(body, "shots", 256, 1, 1024)
    operations = body.get("operations")
    if not isinstance(operations, list) or len(operations) > 32:
        raise ServiceError(422, "Invalid register operations")
    circuit, ideal = teaching_register(qubits, body.get("start"), operations)
    counts, _, _, info = executor(backend, circuit, shots)
    return {"bits": qubits, "counts": counts, "probabilities": ideal, "shots": shots,
            "backend": info["backend"], "kind": info["kind"],
            "source": "hardware" if info["kind"] == "hardware" else "simulator"}


def lab(backend, body, *, executor=execute):
    from .register_circuit import lab_circuit
    circuit, ideal, shots, text = lab_circuit(body)
    counts, _, compiled, info = executor(backend, circuit, shots)
    return {"bits": circuit.num_qubits, "shots": shots, "counts": counts,
            "probabilities": ideal, "backend": info["backend"], "kind": info["kind"],
            "source": "hardware" if info["kind"] == "hardware" else "simulator",
            "circuit_text": text, "depth": compiled.depth()}
