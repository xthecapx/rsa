"""The no-credentials path: real hardware runs served from the image.

This is what a deployment without IBM secrets shows, so the tests care about
two things: that the mode is chosen correctly, and that what comes back is the
same shape the live path produces -- the frontend has one renderer for both.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.quantum import ibm_recorded, ibm_runner


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def recorded_mode(monkeypatch):
    """Pin auto-detection on, so a stray .env cannot change what is tested."""
    monkeypatch.setattr(get_settings(), "ibm_mode", "auto")
    monkeypatch.setattr(get_settings(), "ibm_quantum_token", None)
    monkeypatch.setattr(get_settings(), "ibm_batch_ids", [])


# --- choosing between live and recorded ---


def test_auto_uses_recorded_without_credentials():
    settings = Settings(ibm_mode="auto", ibm_quantum_token=None, ibm_batch_ids=[])
    assert settings.use_recorded_ibm is True


def test_auto_uses_live_when_token_and_batches_are_present():
    settings = Settings(
        ibm_mode="auto", ibm_quantum_token="tok", ibm_batch_ids=[("m4", "abc")]
    )
    assert settings.can_reach_ibm is True
    assert settings.use_recorded_ibm is False


def test_a_token_without_batch_ids_is_not_enough():
    """This app only reads named batches; it never discovers them."""
    settings = Settings(ibm_mode="auto", ibm_quantum_token="tok", ibm_batch_ids=[])
    assert settings.use_recorded_ibm is True


def test_recorded_can_be_forced_over_working_credentials():
    settings = Settings(
        ibm_mode="recorded", ibm_quantum_token="tok", ibm_batch_ids=[("m4", "abc")]
    )
    assert settings.use_recorded_ibm is True


def test_live_can_be_forced_without_credentials():
    """An operator asking for live gets live, and the failure that comes with it."""
    settings = Settings(ibm_mode="live", ibm_quantum_token=None, ibm_batch_ids=[])
    assert settings.use_recorded_ibm is False


# --- the fixtures themselves ---


def test_the_recorded_batches_shipped():
    assert ibm_recorded.available() is True
    labels = {row["label"] for row in ibm_recorded.listed_batches()}
    assert labels == {"m3", "m4", "m6", "m8"}


def test_a_batch_can_be_fetched_by_id_or_by_label():
    by_label = ibm_recorded.get_batch("m4")
    by_id = ibm_recorded.get_batch(by_label["batch_id"])
    assert by_id["batch_id"] == by_label["batch_id"]


def test_an_unknown_batch_is_none_rather_than_an_exception():
    assert ibm_recorded.get_batch("no-such-batch") is None


def test_the_default_batch_is_the_widest_register():
    assert ibm_recorded.default_label() == "m8"


@pytest.mark.parametrize("label", ["m3", "m4", "m6", "m8"])
def test_every_batch_carries_real_counts_and_post_processing(label):
    batch = ibm_recorded.get_batch(label)

    assert batch["N"] == 15
    assert batch["a"] == 7
    assert batch["recorded"] is True
    assert batch["backend_name"] == "ibm_marrakesh"
    assert batch["num_control"] == int(label[1:])
    assert batch["jobs"], "a recorded batch with no jobs shows nothing"

    for job in batch["jobs"]:
        counts = job["counts"]
        assert counts, f"{label}: job {job['job_id']} has no counts"
        # A measurement of m control qubits is an m-bit string, and 4096 shots
        # were requested; anything else means the import mangled the data.
        assert all(len(bits) == batch["num_control"] for bits in counts)
        assert sum(counts.values()) == 4096

        analysis = job["analysis"]
        assert analysis["true_order"] == 4
        assert analysis["shots"] == 4096
        assert len(analysis["outcomes"]) == len(counts)
        assert analysis["best"]["bitstring"] in counts


@pytest.mark.parametrize("label", ["m3", "m4", "m6", "m8"])
def test_every_batch_carries_the_two_comparison_curves(label):
    """The readout is meaningless without something to compare noise against."""
    references = ibm_recorded.get_batch(label)["references"]

    assert references["true_order"] == 4
    # r = 4 puts weight on k/4 for k in 0..3, so four peaks, evenly split.
    assert len(references["ideal"]) == 4
    assert sum(references["ideal"].values()) == pytest.approx(1.0)
    assert references["aer_noiseless"], "no noiseless baseline to compare with"


def test_hardware_noise_is_preserved_rather_than_cleaned_up():
    """The recorded runs are honest: the QPU does not always find r = 4.

    If this ever passes trivially, the fixtures have been replaced by
    simulator output and the talk loses its point.
    """
    batch = ibm_recorded.get_batch("m8")
    counts = batch["jobs"][0]["counts"]
    # 2^8 outcomes, and a noisy device spreads weight across most of them.
    assert len(counts) > 4


# --- the routes ---


def test_mode_endpoint_reports_recorded(client):
    body = client.get("/api/ibm/mode").json()
    assert body["mode"] == "recorded"
    assert body["has_credentials"] is False
    assert body["recorded_available"] is True


def test_batches_lists_the_recorded_runs(client):
    body = client.get("/api/ibm/batches").json()
    assert body["mode"] == "recorded"
    assert [row["label"] for row in body["batches"]] == ["m3", "m4", "m6", "m8"]
    assert all(row["console_url"] for row in body["batches"])


def test_batch_route_serves_a_recorded_run(client):
    batch_id = ibm_recorded.get_batch("m6")["batch_id"]
    body = client.get(f"/api/ibm/batch/{batch_id}").json()
    assert body["recorded"] is True
    assert body["num_control"] == 6
    assert body["jobs"][0]["counts"]


def test_unknown_batch_is_a_404_that_explains_why(client):
    response = client.get("/api/ibm/batch/not-a-real-batch")
    assert response.status_code == 404
    assert "credentials" in response.json()["detail"]


def test_cached_prefers_a_recorded_run_over_the_demo_file(client):
    body = client.get("/api/ibm/cached").json()
    assert body["recorded"] is True
    assert body["backend_name"] == "ibm_marrakesh"


def test_jobs_carry_console_links_built_from_settings(client):
    body = client.get("/api/ibm/cached").json()
    assert body["console_url"].startswith("https://quantum.cloud.ibm.com")
    assert all(job["console_url"] for job in body["jobs"])


def test_a_failed_live_read_falls_back_to_the_recorded_run(client, monkeypatch):
    """Credentials that stop working mid-talk must not blank the readout."""
    monkeypatch.setattr(get_settings(), "ibm_mode", "live")

    def boom(*args, **kwargs):
        raise RuntimeError("connection reset")

    monkeypatch.setattr(ibm_runner, "fetch_batch_cached", boom)

    batch_id = ibm_recorded.get_batch("m4")["batch_id"]
    body = client.get(f"/api/ibm/batch/{batch_id}").json()

    assert body["recorded"] is True
    assert body["num_control"] == 4
    # The failure is reported rather than hidden, so the operator can see it.
    assert "connection reset" in body["live_error"]
