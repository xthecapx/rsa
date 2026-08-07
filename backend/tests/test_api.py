"""Contract tests for the HTTP surface.

The game reads specific fields out of these responses, so the point here is to
pin the shape and the status codes, not to re-test the maths that
test_core.py already covers.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.quantum import ibm_runner
from app.quantum.ibm_cache import UpstreamTimeout


@pytest.fixture
def client():
    return TestClient(app)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


# --- classical ---


def test_plaintext_maps_a_letter_to_its_number(client):
    body = client.post("/api/plaintext", json={"char": "h"}).json()
    assert body["char"] == "H"
    assert body["value"] == 8
    assert body["encrypted"] is False


def test_plaintext_rejects_multiple_characters(client):
    assert client.post("/api/plaintext", json={"char": "HI"}).status_code == 422


def test_keyboard_returns_the_whole_alphabet(client):
    keys = client.post("/api/keyboard", json={}).json()["keys"]
    assert len(keys) == 26
    assert keys[0] == {"char": "A", "value": 1, "enabled": True, "disabled_reason": None}


def test_keyboard_disables_values_a_modulus_cannot_carry(client):
    keys = client.post(
        "/api/keyboard", json={"modulus": 15, "require_coprime": True}
    ).json()["keys"]
    by_char = {k["char"]: k for k in keys}
    assert by_char["C"]["enabled"] is False  # 3 shares a factor with 15
    assert by_char["O"]["enabled"] is False  # 15 is not below the modulus


def test_caesar_roundtrip(client):
    enc = client.post("/api/caesar/encrypt", json={"char": "H", "shift": 3}).json()
    assert enc["ciphertext"] == "K"
    dec = client.post(
        "/api/caesar/decrypt", json={"char": enc["ciphertext"], "shift": 3}
    ).json()
    assert dec["plaintext"] == "H"


def test_caesar_crack_finds_the_shift(client):
    body = client.post(
        "/api/caesar/crack", json={"ciphertext": "K", "expected_plaintext": "H"}
    ).json()
    assert body["found_shift"] == 3


# --- rsa ---


@pytest.mark.parametrize("modulus", [15, 21])
def test_rsa_roundtrip_over_http(client, modulus):
    keys = client.post("/api/rsa/keygen", json={"N": modulus}).json()
    assert keys["N"] == modulus
    assert keys["p"] * keys["q"] == modulus

    enc = client.post(
        "/api/rsa/encrypt", json={"m": 2, "e": keys["e"], "N": modulus}
    ).json()
    dec = client.post(
        "/api/rsa/decrypt", json={"c": enc["c"], "d": keys["d"], "N": modulus}
    ).json()
    assert dec["m"] == 2


def test_rsa_keygen_rejects_a_non_semiprime(client):
    assert client.post("/api/rsa/keygen", json={"N": 16}).status_code == 400


def test_rsa_crack_reports_factors_and_a_projection(client):
    body = client.post("/api/rsa/crack", json={"N": 15, "bits": 2048}).json()
    assert set(body["toy"]["factors"]) == {3, 5}
    assert body["rsa2048_projection"]


# --- shor ---


def test_shor_plan_flags_a_base_that_needs_no_quantum(client):
    body = client.post("/api/shor/plan", json={"N": 15, "a": 5}).json()
    assert body["factor"] == 5


def test_shor_plan_for_a_coprime_base(client):
    body = client.post(
        "/api/shor/plan", json={"N": 15, "a": 7, "num_control": 4}
    ).json()
    assert body["num_control"] == 4
    assert body["quantum_required_slots"] >= 1
    assert body["classical_order"] == 4


def test_repeated_plans_do_not_crash_the_process(client):
    """Regression: this sequence used to segfault the interpreter.

    Building a Shor circuit on a freshly created thread crashes inside
    Qiskit's decomposition, and FastAPI's thread pool supplies exactly those.
    The quantum worker thread is what makes this safe; if it is ever removed,
    this test does not fail, it kills the test run.
    """
    assert client.post("/api/shor/plan", json={"N": 15, "a": 5}).status_code == 200
    for N, a, m in [(15, 7, 4), (15, 7, 8), (21, 5, 6), (21, 11, 8)]:
        response = client.post(
            "/api/shor/plan", json={"N": N, "a": a, "num_control": m}
        )
        assert response.status_code == 200, (N, a, m)
        assert response.json()["num_control"] == m


def test_shor_simulate_recovers_the_period(client):
    body = client.post(
        "/api/shor/simulate",
        json={"N": 15, "a": 7, "num_control": 4, "shots": 256},
    ).json()
    assert body["true_order"] == 4
    assert body["shor_result"]["found"] is True
    assert set(body["shor_result"]["factors"]) == {3, 5}

    # The game's outcome table is built from analysis.outcomes; every row needs
    # these fields to be renderable.
    outcomes = body["analysis"]["outcomes"]
    assert outcomes
    for outcome in outcomes:
        assert set(outcome) >= {"bitstring", "count", "phase", "fraction", "factoring"}


@pytest.mark.parametrize(
    "payload",
    [
        {"num_control": 99},  # would build an unusable circuit
        {"shots": 10_000_000},  # would exhaust memory
        {"strategy": "nonsense"},
        {"N": 1},
    ],
)
def test_shor_simulate_rejects_out_of_range_input(client, payload):
    body = {"N": 15, "a": 7, **payload}
    assert client.post("/api/shor/simulate", json=body).status_code == 422


# --- ibm ---


def test_batches_lists_configured_ids(client, monkeypatch):
    monkeypatch.setattr(
        ibm_runner,
        "listed_batches",
        lambda *a, **k: [{"label": "m4", "batch_id": "abc", "console_url": "u"}],
    )
    body = client.get("/api/ibm/batches").json()
    assert body["batches"][0]["label"] == "m4"


def test_batch_reports_freshness(client, monkeypatch):
    monkeypatch.setattr(
        ibm_runner,
        "fetch_batch_cached",
        lambda *a, **k: {"batch_id": "abc", "from_cache": True, "stale": False},
    )
    body = client.get("/api/ibm/batch/abc").json()
    assert body["from_cache"] is True
    assert body["stale"] is False


def test_batch_returns_504_when_ibm_does_not_answer(client, monkeypatch):
    """A hung upstream must surface as a gateway timeout, not a hung request."""

    def timeout(*args, **kwargs):
        raise UpstreamTimeout("ibm did not respond within 15s")

    monkeypatch.setattr(ibm_runner, "fetch_batch_cached", timeout)
    assert client.get("/api/ibm/batch/abc").status_code == 504


def test_batch_returns_502_when_ibm_errors(client, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("connection reset")

    monkeypatch.setattr(ibm_runner, "fetch_batch_cached", boom)
    assert client.get("/api/ibm/batch/abc").status_code == 502


def test_batch_returns_503_without_the_quantum_dependencies(client, monkeypatch):
    def missing(*args, **kwargs):
        raise ImportError("qward is required")

    monkeypatch.setattr(ibm_runner, "fetch_batch_cached", missing)
    assert client.get("/api/ibm/batch/abc").status_code == 503


def test_cached_run_is_served(client):
    body = client.get("/api/ibm/cached").json()
    assert "jobs" in body


def test_cached_run_missing_is_404_not_a_200_with_an_error(client, monkeypatch):
    def missing():
        raise FileNotFoundError("no cached run at /nowhere")

    monkeypatch.setattr(ibm_runner, "load_cached", missing)
    assert client.get("/api/ibm/cached").status_code == 404
