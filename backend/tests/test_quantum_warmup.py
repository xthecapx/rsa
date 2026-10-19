import asyncio
import logging

from fastapi.testclient import TestClient

from app.main import app
from app.quantum import warmup


def test_warmup_can_be_disabled(monkeypatch):
    monkeypatch.setenv("QUANTUM_WARMUP", "0")
    assert not warmup.enabled()
    monkeypatch.setenv("QUANTUM_WARMUP", "1")
    assert warmup.enabled()


def test_warmup_runs_a_real_circuit_on_the_worker():
    # Raises if Aer, the ideal simulator or the noise model cannot run a shot.
    asyncio.run(warmup.warm_up())


def test_failed_warmup_only_logs(monkeypatch, caplog):
    def broken():
        raise RuntimeError("no aer")

    monkeypatch.setattr(warmup, "_warm", broken)
    with caplog.at_level(logging.WARNING):
        asyncio.run(warmup.warm_up())
    assert "warm-up failed" in caplog.text


def test_server_serves_while_warming_up(monkeypatch):
    monkeypatch.setenv("QUANTUM_WARMUP", "1")
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
