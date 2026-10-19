import os

# Warm-up occupies the single quantum worker; tests that measure queueing or
# timeouts must not compete with it. test_quantum_warmup.py exercises it directly.
os.environ.setdefault("QUANTUM_WARMUP", "0")
