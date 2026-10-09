"""Small-register teaching circuits; wire 1 is the leftmost displayed bit."""
import re


def phase_oracle(qc, marked):
    """Flip one displayed bitstring's phase; shared by lessons and free play."""
    n = qc.num_qubits
    zeros = [n - 1 - i for i, bit in enumerate(marked) if bit == "0"]
    if zeros:
        qc.x(zeros)
    qc.h(n - 1)
    if n == 1:
        qc.x(0)
    else:
        qc.mcx(list(range(n - 1)), n - 1)
    qc.h(n - 1)
    if zeros:
        qc.x(zeros)


def diffuse(qc):
    import math
    qc.h(range(qc.num_qubits))
    phase_oracle(qc, "0" * qc.num_qubits)
    qc.h(range(qc.num_qubits))
    qc.global_phase += math.pi


def parity_oracle(qc, mask):
    for wire, bit in enumerate(mask):
        if bit == "1":
            qc.cx(qc.num_qubits - 1 - wire, 0)


def teaching_register(qubits, start, operations):
    from .game_services import ServiceError, bitstring
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
    qc = QuantumCircuit(qubits, qubits)
    if start == "even":
        qc.h(range(qubits))
    else:
        bitstring(start, qubits)
        for wire, bit in enumerate(start):
            if bit == "1":
                qc.x(qubits - 1 - wire)
    qc.barrier()
    for op in operations:
        if op == "H":
            qc.h(range(qubits))
        elif op == "D":
            diffuse(qc)
        elif isinstance(op, str) and op.startswith("oracle:"):
            phase_oracle(qc, bitstring(op[7:], qubits))
        elif isinstance(op, str) and op.startswith("ghost:"):
            secret = bitstring(op[6:], qubits - 1)
            parity_oracle(qc, secret)
        elif isinstance(op, str) and (match := re.fullmatch(r"(X|Z|h|CX)([1-4])", op)):
            gate, wire = match[1], int(match[2])
            if wire > qubits or gate == "CX" and wire == qubits:
                raise ServiceError(422, "Invalid register wire")
            q = qubits - wire
            if gate == "CX":
                qc.cx(q, 0)
            else:
                getattr(qc, gate.lower())(q)
        else:
            raise ServiceError(422, "Invalid register operation")
        qc.barrier()
    state = Statevector.from_instruction(qc)
    ideal = {format(i, f"0{qubits}b"): round(float(p), 12) for i, p in enumerate(state.probabilities())}
    qc.measure(range(qubits), range(qubits))
    return qc, ideal


def lab_circuit(body):
    """Bounded free-play circuit. UI wire zero is the highest-index Qiskit wire."""
    import math
    from .game_services import ServiceError, integer, bitstring
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
    n = integer(body, "qubits", 1, 1, 4)
    shots = integer(body, "shots", 256, 1, 1024)
    start = bitstring(body.get("start", "0" * n), n)
    operations = body.get("operations", [])
    if not isinstance(operations, list) or len(operations) > 32:
        raise ServiceError(422, "Lab circuits support at most 32 operations.")
    qc = QuantumCircuit(n, n)
    for i, bit in enumerate(start):
        if bit == "1":
            qc.x(n - 1 - i)
    qc.barrier()
    def wire(op, key="wire"):
        value = op.get(key)
        if type(value) is not int or not 0 <= value < n:
            raise ServiceError(422, "Invalid lab wire.")
        return n - 1 - value
    for op in operations:
        if not isinstance(op, dict):
            raise ServiceError(422, "Invalid lab operation.")
        name = op.get("gate")
        if name in ("X", "Z", "H"):
            getattr(qc, name.lower())(wire(op))
        elif name in ("RY", "ROTATION"):
            axis = "Y" if name == "RY" else op.get("axis")
            if axis not in ("X", "Y", "Z"):
                raise ServiceError(422, "Invalid lab rotation axis.")
            angle = op.get("angle")
            if isinstance(angle, bool) or not isinstance(angle, (int, float)) or not math.isfinite(angle) or abs(angle) > 2 * math.pi:
                raise ServiceError(422, "Lab rotation must be between -2π and 2π radians.")
            getattr(qc, "r" + axis.lower())(angle, wire(op))
        elif name == "CX":
            control, target = wire(op, "control"), wire(op)
            if control == target:
                raise ServiceError(422, "Control and target must be different wires.")
            qc.cx(control, target)
        elif name == "ORACLE":
            phase_oracle(qc, bitstring(op.get("bits"), n))
        elif name == "D":
            diffuse(qc)
        elif name == "PARITY" and n >= 2:
            mask = bitstring(op.get("bits"), n - 1)
            parity_oracle(qc, mask)
        else:
            raise ServiceError(422, "Unknown lab component.")
        qc.barrier()
    ideal = {format(i, f"0{n}b"): round(float(p), 12) for i, p in enumerate(Statevector.from_instruction(qc).probabilities())}
    qc.measure(range(n), range(n))
    text = str(qc.draw(output="text", reverse_bits=True))
    return qc, ideal, shots, text
