"""Campus physics is shared by Aer and browser BasicSimulator."""
import numpy as np
import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit.quantum_info import Statevector, partial_trace
from app.core.register_circuit import campus_circuit
from app.core.game_services import campus, dispatch, ServiceError
from app.quantum.simulators import simulator

@pytest.mark.parametrize("d", [0, .25, .5, .75, 1])
def test_dephasing_reduces_coherence_monotonically(d):
    qc, ideal, _, _ = campus_circuit({"mode": "dephasing", "disturbance": d, "basis": "Z"})
    state = Statevector.from_instruction(qc.remove_final_measurements(inplace=False))
    rho = partial_trace(state, [0]).data
    assert np.allclose(rho, [[.5, .5*(1-d)], [.5*(1-d), .5]])
    assert ideal == {"0": .5, "1": .5}
    assert qc.num_clbits == 1 and qc.num_qubits == 2
    _, expected, _, _ = campus_circuit({"mode": "dephasing", "disturbance": d, "basis": "X"})
    assert expected == {"0": 1-d/2, "1": d/2}

@pytest.mark.parametrize("pair,basis,expected", [
    ("independent", "Z", [.25]*4), ("independent", "X", [1,0,0,0]),
    ("bell", "Z", [.5,0,0,.5]), ("bell", "X", [.5,0,0,.5]),
    ("envelopes", "Z", [.5,0,0,.5]), ("envelopes", "X", [.25]*4),
])
def test_correlations_and_mixture_in_both_bases(pair, basis, expected):
    result = campus(BasicSimulator(), {"mode": "correlation", "pair": pair, "basis": basis, "shots": 256})
    assert list(result["probabilities"].values()) == expected
    assert sum(result["counts"].values()) == 256 and result["bits"] == 2
    assert all(len(key) == 2 for key in result["counts"])

@pytest.mark.parametrize("choice", ["ideal", "noise"])
def test_http_and_dispatch_honor_backend_without_helper_bits(choice):
    from fastapi.testclient import TestClient
    from app.main import app
    body = {"mode": "dephasing", "disturbance": .5, "basis": "X", "shots": 256}
    response = TestClient(app).post("/api/campus/run", json=body, headers={"X-Quantum-Simulator": choice})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["kind"] == choice and result["probabilities"] == {"0": .75, "1": .25}
    assert sum(result["counts"].values()) == 256
    shared = dispatch(simulator(choice), "/api/campus/run", body)
    assert shared["probabilities"] == result["probabilities"] and shared["bits"] == 1

@pytest.mark.parametrize("body", [
    *({"mode": "dephasing", "disturbance": x} for x in [-1, 1.1, True, float('nan'), float('inf')]),
    {"mode": "correlation", "pair": "other"}, {"mode": "dephasing", "basis": "Y"},
    {"mode": "circuit", "recipe": {"qubits": 5}}, {"mode": "unknown"},
])
def test_invalid_requests_never_submit(body):
    def forbidden(*args, **kwargs):
        pytest.fail("Invalid request reached provider")
    with pytest.raises(ServiceError):
        campus(BasicSimulator(), body, executor=forbidden)


def test_displayed_wire_order():
    result = campus(BasicSimulator(), {"mode": "circuit", "recipe": {"qubits": 2, "start": "00", "operations": [{"gate": "X", "wire": 0}], "shots": 16}})
    assert result["counts"] == {"10": 16}
