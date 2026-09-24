"""Exercise the actual seeded function and actual one-qubit Aer circuit."""

from fastapi.testclient import TestClient
import pytest

from app.main import app

client = TestClient(app)


def test_known_seed_replays_and_predicts_the_sixth_flip():
    practice = client.post("/api/coin/classical", json={"seed": 42, "flips": 5}).json()
    prediction = client.post("/api/coin/classical", json={"seed": 42, "flips": 6}).json()
    replay = client.post("/api/coin/classical", json={"seed": 42, "flips": 6}).json()
    assert practice["bits"] == [0, 0, 1, 0, 0]
    assert prediction["bits"][:5] == practice["bits"]
    assert prediction["bits"][5] == 0
    assert replay == prediction


@pytest.mark.parametrize("hadamard", [False, True])
def test_real_circuit_returns_every_measurement(hadamard):
    response = client.post("/api/coin/simulate", json={"hadamard": hadamard, "shots": 100})
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "simulator"
    assert len(data["bits"]) == sum(data["counts"].values()) == 100
    assert data["counts"]["0"] == data["bits"].count(0)
    assert set(data["bits"]) <= {0, 1}
    if not hadamard:
        assert data["counts"] == {"0": 100, "1": 0}
    else:
        assert data["probabilities"] == {"0": 0.5, "1": 0.5}


def test_final_toss_is_one_measurement():
    data = client.post("/api/coin/simulate", json={"shots": 1}).json()
    assert len(data["bits"]) == 1
    assert sum(data["counts"].values()) == 1


@pytest.mark.parametrize("path,payload", [
    ("simulate", {"shots": 0}), ("simulate", {"shots": 1025}),
    ("classical", {"flips": 101}), ("classical", {"seed": -1}),
])
def test_work_is_bounded(path, payload):
    assert client.post(f"/api/coin/{path}", json=payload).status_code == 422
