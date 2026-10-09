"""Adapter contracts: errors and timeouts do not turn into implicit retries."""
import pytest
from fastapi import HTTPException
from app.api import quantum_execution
from app.core.game_services import ServiceError
from app.quantum.worker import QuantumTimeout


def test_result_and_timeout_forwarded_once(monkeypatch):
    calls = []
    def worker(work, *, timeout):
        calls.append(timeout)
        return work()
    monkeypatch.setattr(quantum_execution, "run_on_worker", worker)
    assert quantum_execution.run_quantum(lambda: {"counts": {"1": 256}}, timeout=30) == {"counts": {"1": 256}}
    assert calls == [30]


@pytest.mark.parametrize("error,status,detail,options", [
    (QuantumTimeout("waiting"), 504, "waiting", {}),
    (ImportError("missing"), 503, "Qiskit Aer is unavailable", {}),
    (ServiceError(409, {"reason": "helper"}), 409, {"reason": "helper"}, {"service_errors": True}),
])
def test_http_error_contract(monkeypatch, error, status, detail, options):
    calls = []
    def worker(work, *, timeout):
        calls.append(timeout)
        raise error
    monkeypatch.setattr(quantum_execution, "run_on_worker", worker)
    with pytest.raises(HTTPException) as result:
        quantum_execution.run_quantum(lambda: None, **options)
    assert result.value.status_code == status
    assert result.value.detail == detail
    assert len(calls) == 1


@pytest.mark.parametrize("error,options", [
    (ImportError("missing"), {"aer_unavailable": False}),
    (ServiceError(400, "invalid"), {}),
    (RuntimeError("unexpected"), {}),
])
def test_untranslated_errors_propagate(monkeypatch, error, options):
    def worker(work, *, timeout):
        raise error
    monkeypatch.setattr(quantum_execution, "run_on_worker", worker)
    with pytest.raises(type(error)) as result:
        quantum_execution.run_quantum(lambda: None, **options)
    assert result.value is error
