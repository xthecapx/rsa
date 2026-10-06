"""Shared one-qubit teaching circuit; providers supply observed counts."""

def teaching_circuit(start, gates):
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector

    if start not in ("0", "1", "+", "-") or any(gate not in ("X", "Z", "H") for gate in gates):
        raise ValueError("Invalid single-qubit circuit")
    circuit = QuantumCircuit(1, 1)
    if start in ("1", "-"):
        circuit.x(0)
    if start in ("+", "-"):
        circuit.h(0)
    circuit.barrier()
    for gate in gates:
        getattr(circuit, gate.lower())(0)
        # Preserve the player's gate sequence, including H followed by H.
        circuit.barrier()
    probabilities = Statevector.from_instruction(circuit).probabilities()
    ideal = {str(bit): round(float(value), 12) for bit, value in enumerate(probabilities)}
    circuit.measure(0, 0)
    return circuit, ideal
