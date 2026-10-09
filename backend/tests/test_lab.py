import math
import pytest
from qiskit.providers.basic_provider import BasicSimulator
from app.core.game_services import lab, ServiceError
from app.quantum.simulators import simulator

@pytest.mark.parametrize('axis', [None, 'X', 'Y', 'Z'])
@pytest.mark.parametrize('angle,one',[ (0,0),(math.pi/2,.5),(math.pi,1),(2*math.pi,0),(-math.pi/2,.5)])
def test_lab_rotations_match_qiskit_and_return_provider_counts(angle,one,axis):
    rotation = {'gate':'RY','wire':0,'angle':angle} if axis is None else {'gate':'ROTATION','axis':axis,'wire':0,'angle':angle}
    recipe={'qubits':1,'start':'0','operations':[rotation],'shots':256}
    if axis == 'Z':
        one = 0
    for backend in (BasicSimulator(), simulator('ideal'), simulator('noise')):
        result=lab(backend,recipe)
        assert sum(result['counts'].values())==256
        assert result['probabilities']['1']==pytest.approx(one)
        assert result['backend']
        assert result['depth']>0

@pytest.mark.parametrize('ops,start,qubits,expected',[
    ([{'gate':'H','wire':0},{'gate':'H','wire':1},{'gate':'ORACLE','bits':'10'},{'gate':'D'}],'00',2,'10'),
    ([{'gate':'X','wire':0},{'gate':'CX','wire':2,'control':0}],'000',3,'101'),
    ([{'gate':'X','wire':2},{'gate':'H','wire':0},{'gate':'H','wire':1},{'gate':'H','wire':2},{'gate':'PARITY','bits':'10'},{'gate':'H','wire':0},{'gate':'H','wire':1}],'000',3,'10'),
])
def test_lab_algorithm_boxes_and_wire_order(ops,start,qubits,expected):
    result=lab(BasicSimulator(),{'qubits':qubits,'start':start,'operations':ops,'shots':100})
    assert sum(c for b,c in result['counts'].items() if b.startswith(expected))==100

@pytest.mark.parametrize('body',[
    {'qubits':5}, {'shots':1025}, {'start':'invalid'}, {'operations':[{'gate':'PYTHON'}]},
    {'operations':[{'gate':'RY','wire':0,'angle':float('nan')}]},
    {'operations':[{'gate':'RY','wire':0,'angle':True}]},
    {'operations':[{'gate':'CX','wire':0,'control':0}]},
    {'operations':[{'gate':'H','wire':True}]},
    {'operations':[{'gate':'H','wire':0}]*33},
])
def test_invalid_lab_recipes_never_submit(body):
    def forbidden(*args,**kwargs):
        pytest.fail('Invalid recipe reached provider')
    with pytest.raises((ServiceError,ValueError)):
        lab(BasicSimulator(),body,executor=forbidden)


@pytest.mark.parametrize("choice,kind", [("ideal", "ideal"), ("noise", "noise")])
@pytest.mark.parametrize("axis", ["X", "Y", "Z"])
def test_http_lab_selects_backend_per_request_and_preserves_shared_contract(choice, kind, axis):
    from fastapi.testclient import TestClient
    from app.main import app
    # H · Rz(π) · H converts phase into a deterministic measured one.
    rotation = {"gate": "ROTATION", "axis": axis, "wire": 0, "angle": math.pi}
    ops = [{"gate": "H", "wire": 0}, rotation, {"gate": "H", "wire": 0}] if axis == "Z" else [rotation]
    recipe = {"qubits": 1, "start": "0", "operations": ops, "shots": 256}
    response = TestClient(app).post("/api/lab/run", json=recipe, headers={"X-Quantum-Simulator": choice})
    assert response.status_code == 200
    result = response.json()
    assert result["kind"] == kind
    assert result["backend"] == ("AerSimulator" if choice == "ideal" else "Aer teaching noise")
    assert result["probabilities"]["1"] == 1
    assert sum(result["counts"].values()) == 256
    assert "M" in result["circuit_text"]
    if choice == "ideal":
        assert result["counts"] == {"1": 256}


@pytest.mark.parametrize("axis", [None, "A", 1, True, [], {}])
def test_invalid_rotation_axes_never_submit(axis):
    def forbidden(*args, **kwargs):
        pytest.fail("Invalid rotation reached provider")
    with pytest.raises(ServiceError):
        lab(BasicSimulator(), {"operations": [{"gate": "ROTATION", "wire": 0, "axis": axis, "angle": 0}]}, executor=forbidden)


def test_http_lab_rejects_invalid_recipe_and_backend():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    assert client.post("/api/lab/run", json={"qubits": 5}).status_code == 422
    assert client.post("/api/lab/run", json={}, headers={"X-Quantum-Simulator": "unknown"}).status_code == 422
