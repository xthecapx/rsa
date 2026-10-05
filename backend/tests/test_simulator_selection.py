"""User-selected backends drive every real teaching circuit independently."""
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.api.routes.grover import make_token as grover_token
from app.api.routes.vault import make_token as vault_token

client = TestClient(app)
NOISE = {"X-Quantum-Simulator": "noise"}


@pytest.mark.parametrize('path,payload', [
    ("/api/coin/circuit", {"starts": ["0"], "gates": ["H", "H"], "shots": 1024}),
    ("/api/coin/simulate", {"hadamard": False, "shots": 1024}),
    ("/api/register/circuit", {"qubits": 2, "start": "00", "operations": ["H", "oracle:10", "D"], "shots": 1024}),
    ("/api/grover/run", {"token": grover_token(6, 42), "circuit": {"init": "h", "loop": ["oracle", "diffuser"], "repeat": 3}}),
    ("/api/vault/run", {"token": vault_token(5), "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True}}),
    ("/api/shor/simulate", {"N": 15, "a": 7, "num_control": 4, "shots": 128}),
])
def test_each_quantum_endpoint_honors_preference_per_request(path, payload):
    noisy = client.post(path, json=payload, headers=NOISE)
    assert noisy.status_code == 200, noisy.text
    result = noisy.json()
    assert result['kind'] == 'noise' and result['backend'] == 'Aer teaching noise'
    assert result['source'] == 'simulator'
    ideal = client.post(path, json=payload)
    assert ideal.status_code == 200, ideal.text
    assert ideal.json()['kind'] == 'ideal'
    assert ideal.json()['backend'] == 'AerSimulator'
    if path == '/api/coin/circuit':
        assert result['circuits'][0]['counts']['1'] > 0
        assert ideal.json()['circuits'][0]['counts'] == {'0': 1024, '1': 0}


@pytest.mark.parametrize('start,ops,expected', [
    ('00', ['X1'], '10'), ('00', ['X2'], '01'),
    ('10', ['CX1'], '11'), ('00', ['H', 'oracle:10', 'D'], '10'),
    ('000', ['h1', 'h2', 'X3', 'h3', 'ghost:10', 'h1', 'h2'], None),
])
def test_small_register_wiring_and_ideal_reference(start, ops, expected):
    res = client.post('/api/register/circuit', json={'qubits': len(start), 'start': start, 'operations': ops, 'shots': 100})
    assert res.status_code == 200, res.text
    result = res.json()
    assert sum(result['counts'].values()) == 100
    assert sum(result['probabilities'].values()) == pytest.approx(1)
    if expected:
        assert result['counts'] == {expected: 100}
    else:
        assert set(result['counts']) <= {'100', '101'}


@pytest.mark.parametrize('payload', [
    {'qubits': 5, 'start':'00000', 'operations': []},
    {'qubits': 2, 'start':'00', 'operations': ['CX2']},
    {'qubits': 2, 'start':'00', 'operations': ['X3']},
    {'qubits': 2, 'start':'00', 'operations': ['oracle:111']},
    {'qubits': 2, 'start':'bad', 'operations': []},
])
def test_register_rejects_invalid_circuits(payload):
    assert client.post('/api/register/circuit', json=payload).status_code == 422


def test_unknown_backend_choice_is_rejected():
    assert client.post('/api/coin/simulate', json={'shots': 1}, headers={'X-Quantum-Simulator': 'physical'}).status_code == 422
