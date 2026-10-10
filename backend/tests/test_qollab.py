"""Execute the shipped browser services with real local Qiskit providers."""
import json
import importlib.util
import random
import sys
from pathlib import Path

import pytest
from qiskit.providers.basic_provider import BasicSimulator
from qiskit_aer import AerSimulator

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "game/qollab/python"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))
spec = importlib.util.spec_from_file_location("qollab_services", Path(__file__).resolve().parents[2] / "game/qollab/python/quantum/services.py")
services = importlib.util.module_from_spec(spec)
spec.loader.exec_module(services)


def call(path, body=None, backend=None):
    return json.loads(services.dispatch_json(backend or BasicSimulator(), path, json.dumps(body or {})))


def test_browser_classical_contracts_match_existing_helpers():
    rng = random.Random(42)
    result = call("/api/coin/classical", {"seed": 42, "flips": 6})
    assert result["data"]["bits"] == [rng.randint(0, 1) for _ in range(6)]
    assert call("/api/coin/classical", {"seed": 42, "flips": 6}) == result
    assert call("/api/plaintext", {"char": "a"})["data"]["value"] == 1
    assert len(call("/api/keyboard")["data"]["keys"]) == 26
    assert call("/api/caesar/encrypt", {"char": "Z", "shift": 1})["data"]["ciphertext"] == "A"
    keys = call("/api/rsa/keygen", {"N": 15})["data"]
    encrypted = call("/api/rsa/encrypt", {"m": 2, "e": keys["e"], "N": 15})["data"]
    assert call("/api/rsa/decrypt", {"c": encrypted["c"], "d": keys["d"], "N": 15})["data"]["m"] == 2


def test_builtin_simulator_is_identified_and_coin_runs_without_aer():
    assert services.describe(BasicSimulator())["kind"] == "ideal"
    assert services.describe(BasicSimulator())["qubits"] == 24
    zero = call("/api/coin/simulate", {"hadamard": False, "shots": 100})
    assert zero["status"] == 200
    assert zero["data"]["counts"] == {"0": 100, "1": 0}
    assert zero["data"]["backend"] == "basic_simulator"
    h = call("/api/coin/simulate", {"hadamard": True, "shots": 1000})["data"]
    assert sum(h["counts"].values()) == len(h["bits"]) == 1000
    assert 400 < h["counts"]["0"] < 600
    assert call("/api/coin/simulate", {"shots": 1025})["status"] == 422


def test_grover_preserves_refusals_shuffled_amplitudes_and_measurement():
    device = services.token("grover", 6, 42)
    body = {"token": device, "circuit": {"init": "h", "loop": ["oracle", "diffuser"], "repeat": 3, "measure": False}}
    result = call("/api/grover/run", body)["data"]
    assert len(result["steps"]) == 8
    assert max(a * a for a in result["steps"][-1]["amplitudes"]) == pytest.approx(0.96131897, abs=1e-5)
    assert result["measured"] is None and result["labels"] is None
    body["circuit"]["measure"] = True
    result = call("/api/grover/run", body)["data"]
    assert len(result["measured"]) == 4 and len(result["labels"]) == 16
    body["circuit"]["repeat"] = 2
    assert call("/api/grover/run", body) == {"status": 409, "data": {"detail": {"reason": "rounds"}}}
    body["circuit"]["loop"] = ["h"]
    assert call("/api/grover/run", body)["data"]["detail"]["reason"] == "circuit"


def test_vault_preserves_25_bits_and_blocks_small_devices_before_submission():
    device = services.token("vault", 5)
    bits = "101" + "0" * 22
    assert call("/api/vault/key", {"token": device, "key": bits})["data"]["open"]
    assert call("/api/vault/ask", {"token": device, "x": "1" + "0" * 24})["data"]["knock"] == 1
    body = {"token": device, "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True, "extra": []}}
    refused = call("/api/vault/run", body)
    assert refused["status"] == 400 and "26 qubits" in refused["data"]["detail"]
    result = call("/api/vault/run", body, AerSimulator(method="stabilizer"))
    assert result["status"] == 200
    assert result["data"]["queries"] == 1 and result["data"]["measured"] == bits
    assert len(result["data"]["frames"][1]["phases"]) == 25
    body["circuit"]["helper"] = "plus"
    assert call("/api/vault/run", body)["data"]["detail"]["reason"] == "helper"


def test_shor_executes_qpe_and_checks_measured_periods():
    result = call("/api/shor/simulate", {"N": 15, "a": 7, "num_control": 4, "shots": 128})
    assert result["status"] == 200, result
    data = result["data"]
    assert data["jobs_run"] == 1 and sum(data["counts"].values()) == 128
    assert set(data["counts"]) <= {"0000", "0100", "1000", "1100"}
    assert data["shor_result"]["found"] and data["shor_result"]["factors"] == [3, 5]
    assert all(len(key) == 4 for key in data["counts"])
    shortcut = call("/api/shor/simulate", {"N": 15, "a": 5})["data"]
    assert shortcut["circuit_built"] is False and shortcut["factor"] == 5


def test_shared_executor_requires_hardware_authorization():
    from qiskit import QuantumCircuit
    class Hardware:
        name = "physical_device"
        num_qubits = 36
        def run(self, *_args, **_kwargs):
            pytest.fail("No authorized hardware submission")
    with pytest.raises(services.ServiceError, match="paid hardware"):
        services.execute(Hardware(), QuantumCircuit(1, 1), 1)


def test_qollab_selected_hardware_submits_one_job_and_labels_results():
    from types import SimpleNamespace
    from unittest.mock import patch
    class Hardware(BasicSimulator):
        def configuration(self):
            return SimpleNamespace(simulator=False, n_qubits=24)
    backend = Hardware()
    backend.name = "test_qpu"
    assert services.describe(backend)["kind"] == "hardware"
    with patch.object(backend, "run", wraps=backend.run) as submitted:
        result = call("/api/coin/simulate", {"shots": 1, "hadamard": False, "finalChallenge": True}, backend)
    assert result["status"] == 200, result
    submitted.assert_called_once()
    assert "memory" not in submitted.call_args.kwargs
    assert result["data"]["source"] == result["data"]["kind"] == "hardware"
    assert result["data"]["counts"] == {"0": 1, "1": 0}


def test_fake_ibm_uses_selected_backend_with_mps_and_full_vault_width():
    from qiskit_ibm_runtime.fake_provider import FakeMarrakesh
    backend = FakeMarrakesh()
    assert services.describe(backend)["kind"] == "noise"
    body = {"token": services.token("vault", 0x1ABCDE), "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True}}
    result = call("/api/vault/run", body, backend)
    assert result["status"] == 200, result
    assert len(result["data"]["measured"]) == 25
    # The noisy outcome need not equal the secret. Never assert ideal certainty.
    assert result["data"]["queries"] == 1


def test_bench_contract_matches_http_and_preserves_player_gates():
    from app.api.routes.coin import simulate_bench
    from app.core.coin_circuit import teaching_circuit
    payload = {"starts": ["+", "-"], "gates": ["H"], "shots": 256}
    browser = call("/api/coin/circuit", payload)["data"]
    http = simulate_bench(payload["starts"], payload["gates"], payload["shots"])
    assert browser["circuits"] == http["circuits"]
    assert browser["source"] == http["source"] == "simulator"
    circuit, ideal = teaching_circuit("0", ["H", "H"])
    assert [instruction.operation.name for instruction in circuit.data].count("h") == 2
    assert [instruction.operation.name for instruction in circuit.data].count("barrier") == 3
    assert ideal == {"0": 1.0, "1": 0.0}


def test_bench_counts_include_actual_selected_simulator_noise():
    from qiskit_aer.noise import NoiseModel, ReadoutError
    from unittest.mock import patch
    noise = NoiseModel()
    noise.add_all_qubit_readout_error(ReadoutError([[0.75, 0.25], [0.35, 0.65]]))
    backend = AerSimulator(noise_model=noise, seed_simulator=42)
    with patch.object(backend, "run", wraps=backend.run) as submitted:
        result = call("/api/coin/circuit", {"starts": ["0"], "gates": ["H", "H"], "shots": 256}, backend)
    assert result["status"] == 200
    submitted.assert_called_once()
    assert result["data"]["kind"] == "noise"
    reading = result["data"]["circuits"][0]
    assert reading["probabilities"] == {"0": 1.0, "1": 0.0}
    assert 0 < reading["counts"]["1"] < 256
    assert sum(reading["counts"].values()) == 256


@pytest.mark.parametrize("payload", [
    {"starts": [], "gates": []}, {"starts": ["bad"], "gates": []},
    {"starts": ["0"] * 5, "gates": []}, {"starts": ["0"], "gates": ["Y"]},
    {"starts": ["0"], "gates": ["H"] * 9}, {"starts": ["0"], "gates": [], "shots": 1025},
])
def test_browser_bench_validates_before_submission(payload):
    assert call("/api/coin/circuit", payload)["status"] == 422


def test_shared_lessons_match_http_with_existing_signed_tokens():
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api.routes.grover import make_token as signed_grover
    from app.api.routes.vault import make_token as signed_vault
    client = TestClient(app)
    circuit = {"init": "h", "loop": ["oracle", "diffuser"], "repeat": 3, "measure": False}
    http = client.post("/api/grover/run", json={"token": signed_grover(6, 42), "circuit": circuit})
    browser = call("/api/grover/run", {"token": services.token("grover", 6, 42), "circuit": circuit})
    assert http.status_code == browser["status"] == 200
    assert http.json()["steps"] == browser["data"]["steps"]
    assert sum(http.json()["counts"].values()) == sum(browser["data"]["counts"].values()) == 256
    vault = {"prep": "h", "helper": "minus", "out": "h", "measure": True}
    http = client.post("/api/vault/run", json={"token": signed_vault(5), "circuit": vault})
    browser = call("/api/vault/run", {"token": services.token("vault", 5), "circuit": vault}, AerSimulator(method="stabilizer"))
    assert http.status_code == browser["status"] == 200
    assert http.json()["frames"] == browser["data"]["frames"]
    assert http.json()["counts"] == browser["data"]["counts"]


def test_shared_shor_plan_and_classical_processing_match_http():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    for action in ("plan", "classical"):
        body = {"N": 15, "a": 7, "num_control": 4}
        http = client.post(f"/api/shor/{action}", json=body)
        browser = call(f"/api/shor/{action}", body)
        assert http.status_code == browser["status"] == 200
        assert http.json() == browser["data"]


def test_remote_progress_reports_provider_states_without_resubmitting():
    from types import SimpleNamespace
    from qiskit.providers import JobStatus

    events = []
    submissions = []
    local = BasicSimulator()

    class Remote(BasicSimulator):
        def configuration(self):
            return SimpleNamespace(simulator=False, n_qubits=24)

        def run(self, circuit, **options):
            submissions.append(options)
            actual = local.run(circuit, **options)

            class Job:
                def job_id(self):
                    return "test-progress-job"

                def wait_for_final_state(self, *, wait, callback):
                    assert wait == 5
                    for state in (JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.DONE):
                        callback(self.job_id(), state, self)

                def result(self):
                    return actual.result()

            return Job()

    result = json.loads(services.dispatch_json(Remote(), "/api/coin/simulate",
        json.dumps({"hadamard": False, "shots": 100, "finalChallenge": True}), lambda state, identifier: events.append((state, identifier))))
    assert result["status"] == 200
    assert len(submissions) == 1
    assert [state for state, _ in events] == ["preparing", "remote_reserved", "submitting", "waiting", "queued", "running", "done", "retrieving"]
    assert all(identifier == "test-progress-job" for _, identifier in events[3:])


@pytest.mark.parametrize("path,body,expected", [
    ("/api/coin/circuit", {"starts": ["0", "1"], "gates": ["H"]}, False),
    ("/api/coin/simulate", {"shots": 1}, False),
    ("/api/coin/simulate", {"finalChallenge": True}, True),
    ("/api/grover/run", {"circuit": {"measure": False}}, False),
    ("/api/grover/run", {"circuit": {"measure": True}}, True),
    ("/api/vault/run", {}, True),
    ("/api/shor/simulate", {}, True),
    ("/api/register/circuit", {}, False),
])
def test_remote_final_challenge_routes(path, body, expected):
    assert bool(services.final_challenge(path, body)) is expected


def test_ionq_practice_does_not_consume_remote_job_and_second_final_is_blocked():
    from unittest.mock import patch
    class IonQ(BasicSimulator):
        pass
    IonQ.__module__ = "qiskit_ionq.ionq_backend"
    backend = IonQ()
    backend.name = "ionq_simulator"
    with patch.object(backend, "run", wraps=backend.run) as submitted:
        practice = call("/api/coin/circuit", {"starts": ["0", "1"], "gates": ["H"], "shots": 100}, backend)
        assert practice["status"] == 200
        assert practice["data"]["backend"] == "basic_simulator"
        submitted.assert_not_called()
        final = call("/api/coin/simulate", {"shots": 1, "finalChallenge": True}, backend)
        assert final["status"] == 200
        assert final["data"]["backend"] == "ionq_simulator"
        submitted.assert_called_once()
        again = call("/api/coin/simulate", {"shots": 1, "finalChallenge": True}, backend)
        assert again["status"] == 409
        assert again["data"]["detail"] == services.RESTART_MESSAGE
        submitted.assert_called_once()
        assert call("/api/coin/circuit", {"starts": ["0"], "gates": []}, backend)["status"] == 200
        submitted.assert_called_once()
    # A fresh runtime/provider starts with an unused allowance.
    fresh = IonQ()
    fresh.name = "ionq_simulator"
    assert call("/api/coin/simulate", {"shots": 1, "finalChallenge": True}, fresh)["status"] == 200


def test_remote_vault_width_failure_does_not_consume_allowance():
    class IonQ(BasicSimulator):
        @property
        def num_qubits(self):
            return 25
    IonQ.__module__ = "qiskit_ionq.ionq_backend"
    backend = IonQ()
    backend.name = "ionq_simulator"
    body = {"token": services.token("vault", 42), "circuit": {"prep": "h", "helper": "minus", "out": "h", "measure": True}}
    assert call("/api/vault/run", body, backend)["status"] == 400
    assert not services._used.get(backend)


def test_lab_uses_selected_ionq_and_shares_one_job_with_final_challenges():
    from unittest.mock import patch
    class IonQ(BasicSimulator):
        pass
    IonQ.__module__ = "qiskit_ionq.ionq_backend"
    backend = IonQ()
    backend.name = "ionq_simulator"
    recipe = {"qubits": 1, "start": "0", "operations": [{"gate": "RY", "wire": 0, "angle": 3.141592653589793}], "shots": 100}
    with patch.object(backend,"run",wraps=backend.run) as submitted:
        invalid = call("/api/lab/run", {**recipe, "operations": [{"gate": "RY", "wire": 0, "angle": 99}]}, backend)
        assert invalid["status"] == 422
        submitted.assert_not_called()
        result = call("/api/lab/run", recipe, backend)
        assert result["status"] == 200
        assert result["data"]["backend"] == "ionq_simulator"
        assert result["data"]["counts"] == {"1": 100}
        submitted.assert_called_once()
        assert call("/api/lab/run", recipe, backend)["status"] == 409
        assert call("/api/coin/simulate", {"finalChallenge": True}, backend)["status"] == 409
        submitted.assert_called_once()


@pytest.mark.parametrize("axis", ["X", "Y", "Z"])
def test_lab_rotation_axes_execute_through_qollab_dispatch(axis):
    import math
    rotation = {"gate": "ROTATION", "axis": axis, "wire": 0, "angle": math.pi}
    ops = [{"gate": "H", "wire": 0}, rotation, {"gate": "H", "wire": 0}] if axis == "Z" else [rotation]
    result = call("/api/lab/run", {"qubits": 1, "start": "0", "operations": ops, "shots": 100})
    assert result["status"] == 200
    assert result["data"]["counts"] == {"1": 100}
    assert result["data"]["backend"] == "basic_simulator"

@pytest.mark.parametrize("provider", ["ionq", "hardware"])
def test_campus_repeated_practice_never_uses_remote_allowance(provider):
    from unittest.mock import patch
    class Remote(BasicSimulator):
        @property
        def simulator(self):
            return provider != "hardware"
    if provider == "ionq":
        Remote.__module__ = "qiskit_ionq.ionq_backend"
    backend = Remote()
    backend.name = "ionq_simulator" if provider == "ionq" else "ibm_hardware"
    assert services.describe(backend)["remote_final_only"]
    with patch.object(backend, "run", wraps=backend.run) as submitted:
        for body in [
            {"mode": "dephasing", "disturbance": 0, "basis": "X"},
            {"mode": "dephasing", "disturbance": 1, "basis": "X"},
            {"mode": "correlation", "pair": "envelopes", "basis": "X"},
            {"mode": "circuit", "recipe": {"qubits": 1, "start": "0", "operations": [{"gate": "H", "wire": 0}], "shots": 16}},
        ]:
            result = call("/api/campus/run", body, backend)
            assert result["status"] == 200, result
            assert result["data"]["backend"] == "basic_simulator"
            assert sum(result["data"]["counts"].values()) == result["data"]["shots"]
        submitted.assert_not_called()
        assert not services._used.get(backend)
