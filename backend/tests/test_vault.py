"""Exercise the parity vault and the real Bernstein-Vazirani run through the API."""

import random
import time

from fastapi.testclient import TestClient
import pytest

from app.api.routes.grover import make_token as grover_token
from app.api.routes.vault import BITS, from_bits, make_token, read_token, to_bits
from app.main import app

client = TestClient(app)

BV = {"prep": "h", "helper": "minus", "out": "h", "measure": True}


def run(token, **circuit):
    return client.post("/api/vault/run", json={"token": token, "circuit": circuit})


def unit(i):
    return "".join("1" if j == i else "0" for j in range(BITS))


def test_bits_read_left_to_right():
    assert to_bits(1) == "1" + "0" * (BITS - 1)
    assert from_bits(to_bits(0b1011)) == 0b1011
    assert to_bits(from_bits("1011001110100101101001101")) == "1011001110100101101001101"


def test_token_round_trips_and_rejects_tampering_and_other_devices():
    token = make_token(12345)
    assert read_token(token) == 12345
    body, signature = token.split(".")
    for bad in (f"{make_token(7).split('.')[0]}.{signature}", f"{body}.x{signature[1:]}", "nonsense", "", grover_token(3, 1)):
        response = client.post("/api/vault/key", json={"token": bad, "key": "0" * BITS})
        assert response.status_code in (400, 422)


def test_vault_tokens_are_not_grover_devices():
    response = client.post("/api/grover/query", json={"token": make_token(3), "guess": "0000"})
    assert response.status_code == 400


def test_device_draws_a_fresh_non_zero_mask_after_a_freeze():
    first = make_token(5)
    for _ in range(20):
        token = client.post("/api/vault/device", json={"previous": first}).json()["token"]
        secret = read_token(token)
        assert secret not in (0, 5)


def test_door_opens_only_for_the_mask():
    secret = from_bits("1011001110100101101001101")
    token = make_token(secret)
    assert client.post("/api/vault/key", json={"token": token, "key": to_bits(secret)}).json() == {"open": True}
    assert client.post("/api/vault/key", json={"token": token, "key": to_bits(secret ^ 4)}).json() == {"open": False}


def test_ghost_knocks_the_parity():
    rng = random.Random(4)
    secret = rng.getrandbits(BITS) | 1
    token = make_token(secret)
    for i in range(BITS):
        knock = client.post("/api/vault/ask", json={"token": token, "x": unit(i)}).json()["knock"]
        assert knock == (secret >> i) & 1
    for _ in range(10):
        x = rng.getrandbits(BITS) | 1
        knock = client.post("/api/vault/ask", json={"token": token, "x": to_bits(x)}).json()["knock"]
        assert knock == bin(secret & x).count("1") % 2
    assert client.post("/api/vault/ask", json={"token": token, "x": "0" * BITS}).status_code == 422


def test_one_query_reads_the_whole_mask():
    rng = random.Random(25)
    for _ in range(8):
        secret = rng.getrandbits(BITS) | (1 << rng.randrange(BITS))
        data = run(make_token(secret), **BV).json()
        assert data["measured"] == to_bits(secret)
        assert data["queries"] == 1
        prep, oracle, out = data["frames"]
        assert prep["phases"] == ["+"] * BITS
        # O(n) kickback tracking agrees with the stabilizer shot.
        assert "".join("1" if p == "-" else "0" for p in oracle["phases"]) == data["measured"]
        assert out["bits"] == data["measured"]


def test_twenty_six_qubits_run_quickly_without_a_statevector():
    start = time.perf_counter()
    run(make_token(from_bits("1" * BITS)), **BV)
    assert time.perf_counter() - start < 5


@pytest.mark.parametrize("circuit,reason", [
    ({**BV, "extra": ["diffuser"]}, "extra"),
    ({**BV, "extra": ["repeat"]}, "extra"),
    ({**BV, "prep": None}, "prep"),
    ({**BV, "helper": "zero"}, "helper"),
    ({**BV, "helper": "plus"}, "helper"),
    ({**BV, "helper": None}, "helper"),
    ({**BV, "out": None}, "output"),
    ({**BV, "measure": False}, "measure"),
])
def test_execute_only_runs_the_bv_wiring(circuit, reason):
    response = run(make_token(9), **circuit)
    assert response.status_code == 409
    assert response.json()["detail"] == {"reason": reason}


@pytest.mark.parametrize("body", [
    {"key": "0" * (BITS - 1)}, {"key": "2" * BITS}, {"key": "0" * (BITS + 1)},
])
def test_key_shape_is_bounded(body):
    assert client.post("/api/vault/key", json={"token": make_token(9), **body}).status_code == 422


def test_run_vocabulary_is_bounded():
    assert run(make_token(9), **{**BV, "helper": "one"}).status_code == 422
    assert run(make_token(9), **{**BV, "extra": ["diffuser"] * 3}).status_code == 422
