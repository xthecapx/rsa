"""Timeout ownership: queued work is removed; active work stays serialized."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest

from app.quantum import worker


@pytest.fixture
def isolated_worker(monkeypatch):
    executor = ThreadPoolExecutor(max_workers=1)
    monkeypatch.setattr(worker, "_executor", executor)
    yield executor
    executor.shutdown(wait=True, cancel_futures=True)


def test_timed_out_queue_never_executes_and_next_request_recovers(isolated_worker):
    started, release, obsolete = Event(), Event(), Event()
    def blocked():
        started.set()
        assert release.wait(2)
    running = isolated_worker.submit(blocked)
    assert started.wait(1)
    try:
        with worker.request_timings("/queued") as timings:
            with pytest.raises(worker.QuantumTimeout, match="cancelled before execution"):
                worker.run_on_worker(obsolete.set, timeout=.01)
        assert timings["queue_ms"] > 0
        assert timings["execution_ms"] is None
    finally:
        release.set()
    running.result(timeout=1)
    assert worker.run_on_worker(lambda: "fresh", timeout=1) == "fresh"
    assert not obsolete.is_set()


def test_active_timeout_does_not_release_the_worker_or_resubmit(isolated_worker):
    release, completed = Event(), Event()
    def work():
        assert release.wait(2)
        completed.set()
    try:
        with pytest.raises(worker.QuantumTimeout, match="may still finish"):
            worker.run_on_worker(work, timeout=.01)
        with pytest.raises(worker.QuantumTimeout, match="cancelled before execution"):
            worker.run_on_worker(lambda: pytest.fail("Queued retry executed"), timeout=.01)
    finally:
        release.set()
    assert worker.run_on_worker(lambda: completed.is_set(), timeout=1)


def test_work_timeout_error_is_not_misreported_as_worker_timeout(isolated_worker):
    def fail():
        raise TimeoutError("provider diagnostic")
    with pytest.raises(TimeoutError, match="provider diagnostic") as exc:
        worker.run_on_worker(fail, timeout=1)
    assert not isinstance(exc.value, worker.QuantumTimeout)


def test_http_timings_are_per_request_and_do_not_contain_inputs(monkeypatch):
    from fastapi.testclient import TestClient
    from app.api.routes import campus
    from app.main import app
    monkeypatch.setattr(campus, "campus", lambda *args: {"counts": {"0": 16}})
    with TestClient(app) as client:
        response = client.post("/api/campus/run", json={})
        assert response.status_code == 200
        header = response.headers["Server-Timing"]
        assert "quantum_queue;dur=" in header
        assert "quantum_execution;dur=" in header
        assert "app;dur=" in header
        assert "Server-Timing" not in client.get("/api/health").headers
