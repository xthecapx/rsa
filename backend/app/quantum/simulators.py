"""Server simulator selection. Each request carries its own preference."""
from typing import Literal

SimulatorChoice = Literal["ideal", "noise"]


def simulator(choice: SimulatorChoice = "ideal", *, vault=False):
    from qiskit_aer import AerSimulator
    if choice == "ideal":
        return AerSimulator(method="stabilizer" if vault else "automatic")
    from qiskit_aer.noise import NoiseModel, ReadoutError, depolarizing_error
    # A reproducible teaching model, not a calibration of a physical device.
    noise = NoiseModel()
    noise.add_all_qubit_quantum_error(depolarizing_error(0.003, 1), ["h", "x", "z", "sx", "rz"])
    noise.add_all_qubit_quantum_error(depolarizing_error(0.01, 2), ["cx"])
    noise.add_all_qubit_readout_error(ReadoutError([[0.98, 0.02], [0.02, 0.98]]))
    return AerSimulator(noise_model=noise, method="matrix_product_state" if vault else "automatic")


def display_name(choice: SimulatorChoice):
    return "Aer teaching noise" if choice == "noise" else "AerSimulator"
