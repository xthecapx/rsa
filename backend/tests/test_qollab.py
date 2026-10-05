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


def test_hardware_is_never_submitted():
    class Hardware:
        name = "physical_device"
        num_qubits = 36

        def run(self, *_args, **_kwargs):
            pytest.fail("Paid hardware must not be submitted")

    result = call("/api/coin/simulate", {"shots": 1}, Hardware())
    assert result["status"] == 400 and "paid hardware" in result["data"]["detail"]


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
