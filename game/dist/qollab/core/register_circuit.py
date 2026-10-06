"""Small-register teaching circuits; wire 1 is the leftmost displayed bit."""
import re


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
    def phase_oracle(marked):
        zeros = [q for q in range(qubits) if marked[qubits - 1 - q] == "0"]
        if zeros:
            qc.x(zeros)
        qc.h(qubits - 1)
        qc.mcx(list(range(qubits - 1)), qubits - 1)
        qc.h(qubits - 1)
        if zeros:
            qc.x(zeros)
    for op in operations:
        if op == "H":
            qc.h(range(qubits))
        elif op == "D":
            qc.h(range(qubits))
            phase_oracle("0" * qubits)
            qc.h(range(qubits))
            qc.global_phase += 3.141592653589793
        elif isinstance(op, str) and op.startswith("oracle:"):
            phase_oracle(bitstring(op[7:], qubits))
        elif isinstance(op, str) and op.startswith("ghost:"):
            secret = bitstring(op[6:], qubits - 1)
            for wire, bit in enumerate(secret):
                if bit == "1":
                    qc.cx(qubits - 1 - wire, 0)
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
