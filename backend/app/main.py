"""FastAPI entrypoint for the RSA teaching game."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import classical, ibm, rsa, shor

app = FastAPI(title="RSA Quantum Teaching Game", version="0.1.0")

# Secondary fallback for local non-Docker runs; Docker uses Next.js rewrite proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classical.router, prefix="/api", tags=["classical"])
app.include_router(rsa.router, prefix="/api/rsa", tags=["rsa"])
app.include_router(shor.router, prefix="/api/shor", tags=["shor"])
app.include_router(ibm.router, prefix="/api/ibm", tags=["ibm"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
