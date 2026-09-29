"""Exercise the real Grover circuit through the API, as the page does."""

from fastapi.testclient import TestClient
import pytest

from app.api.routes.grover import bar_order, make_token, read_token
from app.main import app

client = TestClient(app)

SEARCH = {"init": "h", "loop": ["oracle", "diffuser"]}
# P(target) = sin^2((2k + 1) asin(1/4)) for k rounds.
EXPECTED = [0.0625, 0.4727, 0.9084, 0.9613, 0.5817, 0.1254]


def run(token, **circuit):
    return client.post("/api/grover/run", json={"token": token, "circuit": circuit})


def by_state(step, seed):
    """Undo the display shuffle so tests can read |state> directly."""
    amps = [0.0] * 16
    for position, state in enumerate(bar_order(seed)):
        amps[state] = step["amplitudes"][position]
    return amps


def test_token_round_trips_and_rejects_tampering():
    token = make_token(11, 1234)
    assert read_token(token) == (11, 1234)
    body, signature = token.split(".")
    forged = make_token(3, 1234).split(".")[0]
    for bad in (f"{forged}.{signature}", f"{body}.x{signature[1:]}", "nonsense", ""):
        response = client.post("/api/grover/query", json={"token": bad, "guess": "0000"})
        assert response.status_code in (400, 422)


def test_device_hides_the_pin_and_the_lock_answers_yes_or_no():
    token = client.post("/api/grover/device", json={}).json()["token"]
    secret, _ = read_token(token)
    answers = {
        format(guess, "04b"): client.post(
            "/api/grover/query", json={"token": token, "guess": format(guess, "04b")}
        ).json()["match"]
        for guess in range(16)
    }
    assert [pin for pin, hit in answers.items() if hit] == [format(secret, "04b")]


def test_backup_cipher_draws_a_different_pin():
    first = make_token(5, 1)
    for _ in range(20):
        token = client.post("/api/grover/device", json={"previous": first}).json()["token"]
        assert read_token(token)[0] != 5


@pytest.mark.parametrize("rounds", range(6))
def test_target_probability_follows_the_grover_rotation(rounds):
    secret, seed = 9, 77
    data = run(make_token(secret, seed), **SEARCH, repeat=rounds).json()
    final = by_state(data["steps"][-1], seed)
    assert final[secret] ** 2 == pytest.approx(EXPECTED[rounds], abs=1e-3)
    assert sum(a * a for a in final) == pytest.approx(1, abs=1e-4)


def test_oracle_flips_the_sign_and_diffuser_reflects_about_the_mean():
    secret, seed = 6, 3
    steps = run(make_token(secret, seed), **SEARCH, repeat=1).json()["steps"]
    assert [s["block"] for s in steps] == ["start", "h", "oracle", "diffuser"]
    after_oracle = by_state(steps[2], seed)
    assert after_oracle[secret] == pytest.approx(-0.25)
    assert all(a == pytest.approx(0.25) for i, a in enumerate(after_oracle) if i != secret)
    after_diffuser = by_state(steps[3], seed)
    assert after_diffuser[secret] == pytest.approx(0.6875)
    assert after_diffuser[0 if secret else 1] == pytest.approx(0.1875)


def test_bars_are_shuffled_per_device():
    orders = {tuple(bar_order(seed)) for seed in range(10)}
    assert len(orders) > 1
    assert {bar_order(seed).index(0) for seed in range(40)} != {0}


def test_wrong_builds_run_for_real():
    no_h = by_state(run(make_token(4, 8), init=None, loop=["oracle", "diffuser"], repeat=3).json()["steps"][-1], 8)
    # Without H the search never spreads over all PINs: the PIN stays unlikely.
    assert no_h[4] ** 2 < 0.1
    diffuser_only = by_state(run(make_token(4, 8), init="h", loop=["diffuser"], repeat=3).json()["steps"][-1], 8)
    assert all(a == pytest.approx(0.25) for a in diffuser_only)


def test_measurement_only_for_three_rounds_of_the_full_search():
    token = make_token(12, 5)
    assert run(token, **SEARCH, repeat=2, measure=True).status_code == 409
    assert run(token, init="h", loop=["diffuser", "oracle"], repeat=3, measure=True).json()["detail"] == {"reason": "circuit"}
    hits = 0
    for _ in range(10):
        data = run(token, **SEARCH, repeat=3, measure=True).json()
        assert len(data["measured"]) == 4 and set(data["measured"]) <= {"0", "1"}
        assert sorted(data["labels"]) == [format(i, "04b") for i in range(16)]
        hits += data["measured"] == "1100"
    assert hits >= 7


@pytest.mark.parametrize("circuit", [
    {"repeat": 6}, {"repeat": -1}, {"loop": ["oracle"] * 5}, {"loop": ["cnot"]}, {"init": "x"},
])
def test_work_is_bounded(circuit):
    assert run(make_token(0, 0), **circuit).status_code == 422
