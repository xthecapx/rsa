"""Thin adapter over qward.algorithms.Shor."""

from __future__ import annotations

from typing import Any, Dict, Optional


def _import_shor():
    try:
        from qward.algorithms.shor import (  # type: ignore
            Shor,
            analyze_counts,
            build_step_plan,
            classical_order,
            classical_precheck,
            factors_from_order,
        )
    except ImportError as exc:
        raise ImportError(
            "qward is required. In Docker it is bind-mounted at /qward; "
            "locally: pip install -e ../qiskit-qward"
        ) from exc
    return (
        Shor,
        analyze_counts,
        build_step_plan,
        classical_order,
        classical_precheck,
        factors_from_order,
    )


def plan_shor(N: int, a: int, num_control: Optional[int] = None) -> Dict[str, Any]:
    (
        Shor,
        _analyze,
        build_step_plan,
        classical_order,
        classical_precheck,
        factors_from_order,
    ) = _import_shor()
    pre = classical_precheck(N, a)
    if num_control is None:
        import math

        num_target = math.floor(math.log2(N - 1)) + 1
        num_control = 2 * num_target
    plan = build_step_plan(N, a, num_control)
    step_plan = []
    for e in plan:
        d = e.to_dict()
        # Frontend PipelineStrip expects `slot`
        d["slot"] = d.get("control_index", d.get("k"))
        step_plan.append(d)
    out: Dict[str, Any] = {
        "N": N,
        "a": a,
        "num_control": num_control,
        "precheck": pre.to_dict(),
        "step_plan": step_plan,
        "identity_skipped": sum(1 for e in plan if e.status == "identity"),
        "quantum_required_slots": sum(1 for e in plan if e.status != "identity"),
    }
    if not pre.needs_quantum:
        out["factor"] = pre.factor
        out["factors"] = list(pre.factors) if pre.factors else None
        return out
    try:
        r = classical_order(a, N)
        out["classical_order"] = r
        out["factors_from_classical_order"] = factors_from_order(a, r, N)
    except Exception as exc:  # noqa: BLE001
        out["classical_order_error"] = str(exc)
    # Also attach Shor.plan_dict for consistency
    shor = Shor(N, a, num_control=num_control)
    out["shor_plan"] = shor.plan_dict()
    return out


def classical_shor(N: int, a: int) -> Dict[str, Any]:
    (
        _Shor,
        _analyze,
        _plan,
        classical_order,
        classical_precheck,
        factors_from_order,
    ) = _import_shor()
    pre = classical_precheck(N, a)
    if not pre.needs_quantum:
        return {"precheck": pre.to_dict(), "order": None, "factoring": None}
    r = classical_order(a, N)
    return {
        "precheck": pre.to_dict(),
        "order": r,
        "factoring": factors_from_order(a, r, N),
        "method": "classical_brute_force_order",
    }


def simulate_shor(
    N: int,
    a: int,
    *,
    num_control: Optional[int] = None,
    strategy: str = "permutation",
    shots: int = 1024,
    include_statevector: bool = False,
) -> Dict[str, Any]:
    (
        Shor,
        analyze_counts,
        _plan,
        _order,
        classical_precheck,
        _factors,
    ) = _import_shor()
    pre = classical_precheck(N, a)
    if not pre.needs_quantum:
        return {
            "precheck": pre.to_dict(),
            "circuit_built": False,
            "factor": pre.factor,
            "factors": list(pre.factors) if pre.factors else None,
        }

    shor = Shor(N, a, num_control=num_control, strategy=strategy)
    from qiskit import transpile
    from qiskit_aer import AerSimulator

    sim = AerSimulator(method="statevector")
    circuit = transpile(shor.circuit, backend=sim, optimization_level=1)

    job = sim.run(circuit, shots=shots)
    result = job.result()
    counts = {k.replace(" ", ""): v for k, v in result.get_counts().items()}
    analysis = analyze_counts(
        counts,
        a,
        N,
        shor.num_control,
        true_order=shor.true_order,
    )

    # Prefer outcomes that recover the true order / full factor pair.
    # Tallest bar is often phase 0 (r=1, fail); r=2 can give a partial factor.
    outcomes = analysis.get("outcomes") or []
    successful = [
        o
        for o in outcomes
        if (o.get("factoring") or {}).get("nontrivial")
    ]
    order_hits = [o for o in successful if o.get("order_matches_true")]
    success_shots = int(sum(o.get("count", 0) for o in successful))
    order_hit_shots = int(sum(o.get("count", 0) for o in order_hits))

    def _hit_score(o: Dict[str, Any]) -> tuple:
        fac = (o.get("factoring") or {}).get("factors") or []
        return (
            1 if o.get("order_matches_true") else 0,
            len(fac),
            int(o.get("count") or 0),
        )

    ranked = sorted(successful, key=_hit_score, reverse=True)
    shor_hit = ranked[0] if ranked else None

    circuit_text = str(circuit.draw(output="text", fold=-1))
    out: Dict[str, Any] = {
        "precheck": pre.to_dict(),
        "plan": shor.plan_dict(),
        "backend": "AerSimulator",
        "engine": "qward.algorithms.Shor",
        "method": "phase_estimation + continued_fractions",
        "strategy": strategy,
        "num_control": shor.num_control,
        "num_target": shor.num_target,
        "num_qubits": shor.num_qubits,
        "true_order": shor.true_order,
        "shots": shots,
        "counts": counts,
        "analysis": analysis,
        "successful_outcomes": ranked[:8],
        "success_shots": success_shots,
        "success_rate": success_shots / shots if shots else 0.0,
        "order_hit_shots": order_hit_shots,
        "order_hit_rate": order_hit_shots / shots if shots else 0.0,
        "shor_result": {
            "order_guess": (shor_hit or {}).get("order_guess"),
            "factors": ((shor_hit or {}).get("factoring") or {}).get("factors"),
            "bitstring": (shor_hit or {}).get("bitstring"),
            "phase": (shor_hit or {}).get("phase"),
            "fraction": (shor_hit or {}).get("fraction"),
            "found": shor_hit is not None,
            "order_matches_true": bool((shor_hit or {}).get("order_matches_true")),
            "true_order": shor.true_order,
        },
        "expected_distribution": shor.expected_distribution(),
        "circuit_text": circuit_text,
        "circuit_depth": circuit.depth(),
        "jobs_run": 1,
        "strategy_note": (
            "One Aer job runs the full QWARD Shor circuit (QPE ladder). "
            "Colored pipeline tiles are controlled-M_b *gates inside that one circuit*, "
            "not separate jobs. The histogram is the measured control register "
            "(512 shots of the same circuit); peaks → phase ≈ s/r → order r → factors. "
            + (
                "swap_network uses the N=15,a=7 teaching gates (M_7/M_4)."
                if strategy == "swap_network"
                else "permutation builds each M_b from the modular multiplication table."
            )
        ),
    }

    if include_statevector:
        try:
            from qiskit.quantum_info import Statevector

            # Rebuild without measures for amplitudes on an ideal prep+ops slice
            # is complex; expose probabilities from counts as practical deep-tier data.
            out["statevector_note"] = (
                "Amplitudes omitted for measured circuit; "
                "use expected_distribution and counts for deep tier."
            )
            probs = {
                b: abs(Statevector.from_label("0" * shor.num_qubits)[0])  # placeholder
                for b in list(counts)[:0]
            }
            out["measurement_probabilities"] = {
                b: c / shots for b, c in counts.items()
            }
            _ = probs
        except Exception as exc:  # noqa: BLE001
            out["statevector_error"] = str(exc)

    return out
